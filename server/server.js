// ============================================================
// DineFlow - Restaurant Ordering System Backend
// Express + Socket.io + SQLite
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const QRCode = require('qrcode');

// ============================================================
// CONFIGURATION
// ============================================================
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dineflow_secret_key_2024';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `dish_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extValid = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeValid = allowed.test(file.mimetype);
        cb(null, extValid && mimeValid);
    },
});

// ============================================================
// DATABASE INITIALIZATION
// ============================================================
const db = new Database(path.join(__dirname, 'dineflow.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT '🍽️',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category_id INTEGER,
    image TEXT,
    is_veg BOOLEAN DEFAULT 0,
    spice_level INTEGER DEFAULT 1,
    ingredients TEXT,
    prep_time INTEGER DEFAULT 15,
    is_available BOOLEAN DEFAULT 1,
    stock_count INTEGER DEFAULT -1, -- -1 for infinite
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    is_available BOOLEAN DEFAULT 1,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number INTEGER NOT NULL UNIQUE,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available',
    current_order_session TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    table_id INTEGER NOT NULL,
    status TEXT DEFAULT 'placed',
    special_notes TEXT,
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    menu_item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL,
    addons TEXT DEFAULT '[]',
    special_instructions TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    table_id INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    tax_percent REAL DEFAULT 5,
    tax_amount REAL DEFAULT 0,
    service_charge REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS bill_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS waiter_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, resolved
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    table_id INTEGER,
    order_id TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ============================================================
// CATEGORY ROUTES
// ============================================================
app.get('/api/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', authenticateToken, (req, res) => {
    try {
        const { name, icon, sort_order } = req.body;
        const result = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)').run(name, icon || '🍽️', sort_order || 0);
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/categories/:id', authenticateToken, (req, res) => {
    try {
        const { name, icon, sort_order } = req.body;
        db.prepare('UPDATE categories SET name = ?, icon = ?, sort_order = ? WHERE id = ?').run(name, icon, sort_order, req.params.id);
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', authenticateToken, (req, res) => {
    try {
        db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// MENU ROUTES
// ============================================================
app.get('/api/menu', (req, res) => {
    try {
        const { category, search, veg, available } = req.query;
        let query = `
      SELECT m.*, c.name as category_name, c.icon as category_icon
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE 1=1
    `;
        const params = [];

        if (category && category !== 'all') {
            query += ' AND m.category_id = ?';
            params.push(category);
        }
        if (search) {
            query += ' AND (m.name LIKE ? OR m.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (veg === 'true') {
            query += ' AND m.is_veg = 1';
        } else if (veg === 'false') {
            query += ' AND m.is_veg = 0';
        }
        if (available === 'true') {
            query += ' AND m.is_available = 1';
        }

        query += ' ORDER BY m.category_id, m.name';

        const items = db.prepare(query).all(...params);

        // Get addons for each item
        const addonsStmt = db.prepare('SELECT * FROM addons WHERE menu_item_id = ? AND is_available = 1');
        const itemsWithAddons = items.map(item => ({
            ...item,
            addons: addonsStmt.all(item.id),
        }));

        res.json(itemsWithAddons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/menu/:id', (req, res) => {
    try {
        const item = db.prepare(`
      SELECT m.*, c.name as category_name, c.icon as category_icon
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = ?
    `).get(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        item.addons = db.prepare('SELECT * FROM addons WHERE menu_item_id = ?').all(item.id);
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/menu', authenticateToken, upload.single('image'), (req, res) => {
    try {
        const { name, description, price, category_id, is_veg, spice_level, ingredients, prep_time, addons } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;
        const result = db.prepare(`
      INSERT INTO menu_items (name, description, price, category_id, image, is_veg, spice_level, ingredients, prep_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description, parseFloat(price), parseInt(category_id), image, is_veg === 'true' ? 1 : 0, parseInt(spice_level) || 1, ingredients, parseInt(prep_time) || 15);

        // Add addons if provided
        if (addons) {
            const addonsList = JSON.parse(addons);
            const addonStmt = db.prepare('INSERT INTO addons (menu_item_id, name, price) VALUES (?, ?, ?)');
            addonsList.forEach(addon => {
                addonStmt.run(result.lastInsertRowid, addon.name, addon.price);
            });
        }

        const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?').get(result.lastInsertRowid);
        item.addons = db.prepare('SELECT * FROM addons WHERE menu_item_id = ?').all(item.id);
        io.emit('menu-updated');
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/menu/:id', authenticateToken, upload.single('image'), (req, res) => {
    try {
        const { name, description, price, category_id, is_veg, spice_level, ingredients, prep_time, is_available, addons } = req.body;
        const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Item not found' });

        const image = req.file ? `/uploads/${req.file.filename}` : existing.image;

        db.prepare(`
      UPDATE menu_items SET name = ?, description = ?, price = ?, category_id = ?, image = ?, 
      is_veg = ?, spice_level = ?, ingredients = ?, prep_time = ?, is_available = ?
      WHERE id = ?
    `).run(
            name || existing.name, description || existing.description, parseFloat(price) || existing.price,
            parseInt(category_id) || existing.category_id, image,
            is_veg !== undefined ? (is_veg === 'true' || is_veg === true ? 1 : 0) : existing.is_veg,
            parseInt(spice_level) || existing.spice_level, ingredients || existing.ingredients,
            parseInt(prep_time) || existing.prep_time,
            is_available !== undefined ? (is_available === 'true' || is_available === true ? 1 : 0) : existing.is_available,
            req.params.id
        );

        // Update addons if provided
        if (addons) {
            db.prepare('DELETE FROM addons WHERE menu_item_id = ?').run(req.params.id);
            const addonsList = JSON.parse(addons);
            const addonStmt = db.prepare('INSERT INTO addons (menu_item_id, name, price) VALUES (?, ?, ?)');
            addonsList.forEach(addon => {
                addonStmt.run(req.params.id, addon.name, addon.price);
            });
        }

        const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m LEFT JOIN categories c ON m.category_id = c.id WHERE m.id = ?').get(req.params.id);
        item.addons = db.prepare('SELECT * FROM addons WHERE menu_item_id = ?').all(item.id);
        io.emit('menu-updated');
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/menu/:id', authenticateToken, (req, res) => {
    try {
        db.prepare('DELETE FROM addons WHERE menu_item_id = ?').run(req.params.id);
        db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
        io.emit('menu-updated');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/menu/:id/availability', authenticateToken, (req, res) => {
    try {
        const { is_available } = req.body;
        db.prepare('UPDATE menu_items SET is_available = ? WHERE id = ?').run(is_available ? 1 : 0, req.params.id);
        io.emit('menu-updated');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// TABLE ROUTES
// ============================================================
app.get('/api/tables', (req, res) => {
    try {
        const tables = db.prepare('SELECT * FROM tables ORDER BY table_number ASC').all();
        // Get active orders count (in-progress) for each table
        const activeCountStmt = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('completed', 'cancelled')`);
        // Get total non-cancelled orders count (for billing - includes completed/served)
        const totalCountStmt = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status != 'cancelled'`);
        const tablesWithOrders = tables.map(table => ({
            ...table,
            active_orders: activeCountStmt.get(table.id).count,
            total_orders: totalCountStmt.get(table.id).count,
        }));
        res.json(tablesWithOrders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tables/:id', (req, res) => {
    try {
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        if (!table) return res.status(404).json({ error: 'Table not found' });
        const orders = db.prepare(`SELECT * FROM orders WHERE table_id = ? AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC`).all(req.params.id);
        res.json({ ...table, orders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public: customer checks in to a table (marks as occupied)
app.post('/api/tables/:id/checkin', (req, res) => {
    try {
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        if (!table) return res.status(404).json({ error: 'Table not found' });
        db.prepare(`UPDATE tables SET status = 'occupied' WHERE id = ?`).run(req.params.id);
        const updated = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        io.emit('table-updated', updated);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tables/:id/status', authenticateToken, (req, res) => {
    try {
        const { status } = req.body;
        db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, req.params.id);
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        io.emit('table-updated', table);
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tables/:id/clear', authenticateToken, (req, res) => {
    try {
        const tableId = req.params.id;
        // Mark all pending orders as completed
        db.prepare(`UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE table_id = ? AND status NOT IN ('completed', 'cancelled')`).run(tableId);
        
        // Resolve any pending waiter calls for this table
        db.prepare(`UPDATE waiter_calls SET status = 'resolved' WHERE table_id = ? AND status = 'pending'`).run(tableId);
        
        // Reset table status
        db.prepare(`UPDATE tables SET status = 'available', current_order_session = NULL WHERE id = ?`).run(tableId);
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
        
        io.emit('table-updated', table);
        io.emit('waiter-call-resolved', { tableId: parseInt(tableId) }); // Notify admins to refresh list if needed
        res.json({ success: true, table });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tables/:id/qr', async (req, res) => {
    try {
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        if (!table) return res.status(404).json({ error: 'Table not found' });
        const url = `${FRONTEND_URL}/table/${table.table_number}`;
        const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: '#0D0D0D', light: '#FFFFFF' } });
        res.json({ qr: qrDataUrl, url, table_number: table.table_number });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new table
app.post('/api/tables', authenticateToken, (req, res) => {
    try {
        const { table_number, capacity } = req.body;
        if (!table_number) return res.status(400).json({ error: 'Table number is required' });
        const existing = db.prepare('SELECT * FROM tables WHERE table_number = ?').get(table_number);
        if (existing) return res.status(400).json({ error: `Table #${table_number} already exists` });
        const result = db.prepare('INSERT INTO tables (table_number, capacity) VALUES (?, ?)').run(parseInt(table_number), parseInt(capacity) || 4);
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid);
        io.emit('table-updated', table);
        res.status(201).json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update table details (number, capacity)
app.put('/api/tables/:id', authenticateToken, (req, res) => {
    try {
        const { table_number, capacity } = req.body;
        const existing = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Table not found' });
        // Check if new table number conflicts with another table
        if (table_number && parseInt(table_number) !== existing.table_number) {
            const conflict = db.prepare('SELECT * FROM tables WHERE table_number = ? AND id != ?').get(parseInt(table_number), req.params.id);
            if (conflict) return res.status(400).json({ error: `Table #${table_number} already exists` });
        }
        db.prepare('UPDATE tables SET table_number = ?, capacity = ? WHERE id = ?').run(
            parseInt(table_number) || existing.table_number,
            parseInt(capacity) || existing.capacity,
            req.params.id
        );
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        io.emit('table-updated', table);
        res.json(table);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a table
app.delete('/api/tables/:id', authenticateToken, (req, res) => {
    try {
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
        if (!table) return res.status(404).json({ error: 'Table not found' });
        // Check if table has active orders
        const activeOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('completed', 'cancelled')`).get(req.params.id);
        if (activeOrders.count > 0) return res.status(400).json({ error: 'Cannot delete table with active orders. Clear the table first.' });
        db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
        io.emit('table-updated', { id: parseInt(req.params.id), deleted: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// ORDER ROUTES
// ============================================================
app.post('/api/orders', (req, res) => {
    try {
        const { table_id, items, special_notes } = req.body;

        if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id);
        if (!table) return res.status(404).json({ error: 'Table not found' });

        const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        let totalAmount = 0;

        // Use a transaction for stock safety
        const result = db.transaction(() => {
            // 1. Initial validation and stock deduction
            for (const item of items) {
                if (item.quantity <= 0) throw new Error(`Invalid quantity for ${item.name}`);

                const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
                if (!menuItem) throw new Error(`Item ${item.name} no longer exists`);
                if (!menuItem.is_available) throw new Error(`${item.name} is currently unavailable`);

                // Check stock
                if (menuItem.stock_count !== -1) { // -1 means unlimited stock
                    if (menuItem.stock_count < item.quantity) {
                        throw new Error(`Only ${menuItem.stock_count} units of ${menuItem.name} remaining`);
                    }
                    // Deduct stock
                    db.prepare('UPDATE menu_items SET stock_count = stock_count - ? WHERE id = ?').run(item.quantity, item.menu_item_id);
                }

                // Calculate total for this item
                let itemTotal = menuItem.price * item.quantity;
                if (item.addons && item.addons.length > 0) {
                    item.addons.forEach(addonId => {
                        const addon = db.prepare('SELECT * FROM addons WHERE id = ?').get(addonId);
                        if (addon) itemTotal += addon.price * item.quantity;
                    });
                }
                totalAmount += itemTotal;
            }

            // 2. Create order
            db.prepare(`INSERT INTO orders (order_id, table_id, status, special_notes, total_amount) VALUES (?, ?, 'placed', ?, ?)`).run(orderId, table_id, special_notes || null, totalAmount);

            // 3. Insert order items
            const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, addons, special_instructions) VALUES (?, ?, ?, ?, ?, ?, ?)');
            items.forEach(item => {
                const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
                let addonNames = [];
                let addonTotal = 0;
                if (item.addons && item.addons.length > 0) {
                    item.addons.forEach(addonId => {
                        const addon = db.prepare('SELECT * FROM addons WHERE id = ?').get(addonId);
                        if (addon) {
                            addonNames.push(addon.name);
                            addonTotal += addon.price;
                        }
                    });
                }
                insertItem.run(orderId, item.menu_item_id, menuItem.name, item.quantity, menuItem.price + addonTotal, JSON.stringify(addonNames), item.special_instructions || null);
            });

            // 4. Update table status
            db.prepare(`UPDATE tables SET status = 'occupied' WHERE id = ?`).run(table_id);

            // 5. Create notification
            db.prepare('INSERT INTO notifications (type, message, table_id, order_id) VALUES (?, ?, ?, ?)').run('new_order', `New order from Table ${table.table_number}`, table_id, orderId);

            return { orderId, totalAmount, table_number: table.table_number };
        })();

        // Get full order details for emission
        const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(result.orderId);
        order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(result.orderId);
        order.table_number = result.table_number;

        // Emit to admin dashboard
        io.emit('new-order', order);
        io.emit('notification', { type: 'new_order', message: `New order from Table ${table.table_number}`, order_id: orderId, table_number: table.table_number });

        res.status(201).json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders', authenticateToken, (req, res) => {
    try {
        const { status, table_id, date } = req.query;
        let query = `SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE 1=1`;
        const params = [];

        if (status && status !== 'all') {
            query += ' AND o.status = ?';
            params.push(status);
        }
        if (table_id) {
            query += ' AND o.table_id = ?';
            params.push(table_id);
        }
        if (date) {
            query += ' AND DATE(o.created_at) = ?';
            params.push(date);
        }

        query += ' ORDER BY o.created_at DESC';

        const orders = db.prepare(query).all(...params);
        const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        const ordersWithItems = orders.map(order => ({
            ...order,
            items: itemsStmt.all(order.order_id),
        }));

        res.json(ordersWithItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/table/:tableId', (req, res) => {
    try {
        const orders = db.prepare(`
      SELECT o.*, t.table_number FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.table_id = ? 
      ORDER BY o.created_at DESC
    `).all(req.params.tableId);

        const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        const ordersWithItems = orders.map(order => ({
            ...order,
            items: itemsStmt.all(order.order_id),
        }));

        res.json(ordersWithItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders/:orderId', (req, res) => {
    try {
        const order = db.prepare(`SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.order_id = ?`).get(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.order_id);
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:orderId/status', authenticateToken, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['placed', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

        db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?').run(status, req.params.orderId);
        const order = db.prepare('SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.order_id = ?').get(req.params.orderId);
        order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.order_id);

        // If all orders for a table are completed, update table status
        if (status === 'completed') {
            const pendingOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('completed', 'cancelled')`).get(order.table_id);
            if (pendingOrders.count === 0) {
                db.prepare(`UPDATE tables SET status = 'available' WHERE id = ?`).run(order.table_id);
            }
        }

        // Emit status update to customer
        io.emit(`order-update-${order.table_id}`, order);
        io.emit('order-status-changed', order);

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// BILL ROUTES
// ============================================================
app.post('/api/bills/generate/:tableId', authenticateToken, (req, res) => {
    try {
        const tableId = req.params.tableId;
        const { service_charge, discount } = req.body;

        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
        if (!table) return res.status(404).json({ error: 'Table not found' });

        // Get all completed/served orders for this table that haven't been billed yet
        const orders = db.prepare(`
      SELECT o.* FROM orders o 
      WHERE o.table_id = ? AND o.status IN ('served', 'completed', 'ready', 'preparing', 'accepted', 'placed')
    `).all(tableId);

        if (orders.length === 0) return res.status(400).json({ error: 'No orders to bill' });

        // Collect all order items
        const allItems = [];
        const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        orders.forEach(order => {
            const items = itemsStmt.all(order.order_id);
            items.forEach(item => {
                const existingItem = allItems.find(i => i.item_name === item.item_name && i.price === item.price);
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                    existingItem.total = existingItem.quantity * existingItem.price;
                } else {
                    allItems.push({
                        item_name: item.item_name,
                        quantity: item.quantity,
                        price: item.price,
                        total: item.quantity * item.price,
                    });
                }
            });
        });

        const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
        const taxPercent = 5;
        const taxAmount = Math.round(subtotal * taxPercent) / 100;
        const svcCharge = parseFloat(service_charge) || 0;
        const disc = parseFloat(discount) || 0;
        const total = subtotal + taxAmount + svcCharge - disc;

        const billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`;
        const result = db.prepare(`
      INSERT INTO bills (bill_number, table_id, subtotal, tax_percent, tax_amount, service_charge, discount, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(billNumber, tableId, subtotal, taxPercent, taxAmount, svcCharge, disc, total);

        // Insert bill items
        const insertBillItem = db.prepare('INSERT INTO bill_items (bill_id, item_name, quantity, price, total) VALUES (?, ?, ?, ?, ?)');
        allItems.forEach(item => {
            insertBillItem.run(result.lastInsertRowid, item.item_name, item.quantity, item.price, item.total);
        });

        const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid);
        bill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);
        bill.table_number = table.table_number;

        io.emit(`bill-generated-${tableId}`, bill);
        res.json(bill);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bills/table/:tableId', (req, res) => {
    try {
        const bills = db.prepare(`
      SELECT b.*, t.table_number FROM bills b 
      JOIN tables t ON b.table_id = t.id 
      WHERE b.table_id = ? 
      ORDER BY b.created_at DESC
    `).all(req.params.tableId);

        const itemsStmt = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?');
        const billsWithItems = bills.map(bill => ({
            ...bill,
            items: itemsStmt.all(bill.id),
        }));

        res.json(billsWithItems);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/bills/:id/pay', authenticateToken, (req, res) => {
    try {
        const { payment_method } = req.body;
        const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        db.transaction(() => {
            // Mark bill as paid
            db.prepare(`UPDATE bills SET payment_status = 'completed', payment_method = ? WHERE id = ?`).run(payment_method, bill.id);

            // Mark all orders for this table as completed
            db.prepare(`UPDATE orders SET status = 'completed' WHERE table_id = ? AND status != 'cancelled'`).run(bill.table_id);

            // Resolve any pending waiter calls
            db.prepare(`UPDATE waiter_calls SET status = 'resolved' WHERE table_id = ? AND status = 'pending'`).run(bill.table_id);

            // Vacate table
            db.prepare(`UPDATE tables SET status = 'available' WHERE id = ?`).run(bill.table_id);
        })();

        const updatedBill = db.prepare('SELECT b.*, t.table_number FROM bills b JOIN tables t ON b.table_id = t.id WHERE b.id = ?').get(bill.id);
        updatedBill.items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(bill.id);

        io.emit(`payment-completed-${bill.table_id}`, updatedBill);
        io.emit('table-updated', { id: bill.table_id, status: 'available' });
        io.emit('waiter-call-resolved', { tableId: bill.table_id });
        io.emit('order-status-changed');

        res.json(updatedBill);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- Waiter Call Routes ---
app.post('/api/waiter-calls', (req, res) => {
    try {
        const { table_id } = req.body;
        const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id);
        if (!table) return res.status(404).json({ error: 'Table not found' });

        // Check for existing pending call
        const existing = db.prepare(`SELECT * FROM waiter_calls WHERE table_id = ? AND status = 'pending'`).get(table_id);
        if (existing) return res.json({ success: true, message: 'Waiter is already notified' });

        const result = db.prepare('INSERT INTO waiter_calls (table_id, status) VALUES (?, ?)').run(table_id, 'pending');
        const call = db.prepare('SELECT w.*, t.table_number FROM waiter_calls w JOIN tables t ON w.table_id = t.id WHERE w.id = ?').get(result.lastInsertRowid);

        io.emit('new-waiter-call', call);
        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: 'Failed to notify waiter' });
    }
});

// Alias for legacy bell support
app.post('/api/call-waiter', (req, res) => {
    res.redirect(307, '/api/waiter-calls');
});

app.get('/api/waiter-calls/active', authenticateToken, (req, res) => {
    try {
        const calls = db.prepare(`
            SELECT w.*, t.table_number 
            FROM waiter_calls w 
            JOIN tables t ON w.table_id = t.id 
            WHERE w.status = 'pending' 
            ORDER BY w.created_at ASC
        `).all();
        res.json(calls);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/waiter-calls/:id/resolve', authenticateToken, (req, res) => {
    try {
        const call = db.prepare('SELECT * FROM waiter_calls WHERE id = ?').get(req.params.id);
        db.prepare(`UPDATE waiter_calls SET status = 'resolved' WHERE id = ?`).run(req.params.id);
        io.emit('waiter-call-resolved', { id: parseInt(req.params.id), tableId: call?.table_id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ============================================================
// NOTIFICATIONS ROUTES
// ============================================================
app.get('/api/notifications', authenticateToken, (req, res) => {
    try {
        const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/notifications/read', authenticateToken, (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
    try {
        const result = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get();
        res.json({ count: result.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// DASHBOARD STATS
// ============================================================
app.get('/api/stats', authenticateToken, (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const totalTables = db.prepare('SELECT COUNT(*) as count FROM tables').get().count;
        const occupiedTables = db.prepare(`SELECT COUNT(*) as count FROM tables WHERE status = 'occupied'`).get().count;
        const todayOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = ?`).get(today).count;
        const pendingOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status IN ('placed', 'accepted', 'preparing')`).get().count;
        const activeOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('completed', 'cancelled')`).get().count;
        const todayRevenue = db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM bills WHERE DATE(created_at) = ? AND payment_status = 'completed'`).get(today).total;
        const totalRevenue = db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM bills WHERE payment_status = 'completed'`).get().total;
        const completedOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status = 'completed' AND DATE(created_at) = ?`).get(today).count;

        // Popular items (top 5)
        const popularItems = db.prepare(`
      SELECT oi.item_name, SUM(oi.quantity) as total_ordered, oi.price
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      WHERE DATE(o.created_at) = ?
      GROUP BY oi.item_name
      ORDER BY total_ordered DESC
      LIMIT 5
    `).all(today);

        // Recent orders
        const recentOrders = db.prepare(`
      SELECT o.*, t.table_number FROM orders o
      JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC LIMIT 10
    `).all();

        res.json({
            totalTables, occupiedTables, todayOrders, pendingOrders,
            activeOrders, todayRevenue, totalRevenue, completedOrders,
            popularItems, recentOrders,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// ============================================================
// SOCKET.IO HANDLERS
// ============================================================
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join-table', (tableId) => {
        socket.join(`table-${tableId}`);
        console.log(`📋 Socket ${socket.id} joined table-${tableId}`);
    });

    socket.on('join-admin', () => {
        socket.join('admin');
        console.log(`👨‍💼 Admin connected: ${socket.id}`);
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// ============================================================
// SEED DATA
// ============================================================
function seedDatabase() {
    const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (existingCategories.count > 0) return;

    console.log('🌱 Seeding database...');

    // Create admin user
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_users (username, password, name, role) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'Restaurant Admin', 'admin');
    db.prepare('INSERT INTO admin_users (username, password, name, role) VALUES (?, ?, ?, ?)').run('staff', bcrypt.hashSync('staff123', 10), 'Staff Member', 'staff');

    // Create categories
    const categories = [
        { name: 'Starters', icon: '🥗', sort_order: 1 },
        { name: 'Main Course', icon: '🍛', sort_order: 2 },
        { name: 'Rice & Biryani', icon: '🍚', sort_order: 3 },
        { name: 'Breads', icon: '🫓', sort_order: 4 },
        { name: 'Beverages', icon: '🥤', sort_order: 5 },
        { name: 'Desserts', icon: '🍰', sort_order: 6 },
    ];

    const insertCat = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
    categories.forEach(cat => insertCat.run(cat.name, cat.icon, cat.sort_order));

    // Create menu items
    const menuItems = [
        // Starters
        { name: 'Paneer Tikka', description: 'Succulent cottage cheese cubes marinated in spices, grilled to perfection in tandoor', price: 249, category_id: 1, is_veg: 1, spice_level: 2, ingredients: 'Paneer, Bell Peppers, Onion, Yogurt, Spices', prep_time: 15, image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop' },
        { name: 'Chicken 65', description: 'Spicy, deep-fried chicken dish originating from South India with fiery red color', price: 299, category_id: 1, is_veg: 0, spice_level: 3, ingredients: 'Chicken, Red Chili, Curry Leaves, Ginger, Garlic', prep_time: 20, image: 'https://images.unsplash.com/photo-1610057099443-fde6c99db9e1?w=400&h=300&fit=crop' },
        { name: 'Veg Spring Rolls', description: 'Crispy golden rolls stuffed with fresh vegetables and glass noodles', price: 199, category_id: 1, is_veg: 1, spice_level: 1, ingredients: 'Cabbage, Carrots, Noodles, Spring Roll Sheets', prep_time: 12, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop' },
        { name: 'Crispy Samosa', description: 'Golden fried pastry filled with spiced potatoes and green peas', price: 129, category_id: 1, is_veg: 1, spice_level: 2, ingredients: 'Potato, Green Peas, Cumin, Coriander, Pastry', prep_time: 10, image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=300&fit=crop' },
        { name: 'Tandoori Chicken', description: 'Half chicken marinated overnight in yogurt and tandoori spices, roasted in clay oven', price: 349, category_id: 1, is_veg: 0, spice_level: 2, ingredients: 'Chicken, Yogurt, Tandoori Masala, Lemon, Butter', prep_time: 25, image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop' },

        // Main Course
        { name: 'Butter Chicken', description: 'Tender chicken in rich, creamy tomato-based gravy with a hint of sweetness', price: 349, category_id: 2, is_veg: 0, spice_level: 1, ingredients: 'Chicken, Tomato, Cream, Butter, Cashews, Spices', prep_time: 25, image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop' },
        { name: 'Dal Makhani', description: 'Slow-cooked black lentils simmered overnight in butter and cream', price: 249, category_id: 2, is_veg: 1, spice_level: 1, ingredients: 'Black Lentils, Kidney Beans, Butter, Cream, Tomato', prep_time: 20, image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop' },
        { name: 'Palak Paneer', description: 'Fresh spinach gravy with soft cottage cheese cubes and aromatic spices', price: 269, category_id: 2, is_veg: 1, spice_level: 1, ingredients: 'Spinach, Paneer, Onion, Garlic, Cream', prep_time: 18, image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop' },
        { name: 'Chicken Tikka Masala', description: 'Grilled chicken tikka pieces in spicy onion-tomato masala gravy', price: 329, category_id: 2, is_veg: 0, spice_level: 2, ingredients: 'Chicken, Onion, Tomato, Cream, Tikka Masala', prep_time: 22, image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop' },
        { name: 'Shahi Paneer', description: 'Royal cottage cheese curry in cashew-enriched creamy gravy', price: 289, category_id: 2, is_veg: 1, spice_level: 1, ingredients: 'Paneer, Cashews, Cream, Onion, Tomato, Saffron', prep_time: 20, image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=300&fit=crop' },

        // Rice & Biryani
        { name: 'Chicken Biryani', description: 'Fragrant basmati rice layered with spiced chicken, saffron, and caramelized onions', price: 329, category_id: 3, is_veg: 0, spice_level: 2, ingredients: 'Basmati Rice, Chicken, Saffron, Onion, Spices', prep_time: 30, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop' },
        { name: 'Veg Pulao', description: 'Aromatic rice cooked with seasonal vegetables and whole spices', price: 199, category_id: 3, is_veg: 1, spice_level: 1, ingredients: 'Basmati Rice, Mixed Vegetables, Ghee, Spices', prep_time: 18, image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop' },
        { name: 'Jeera Rice', description: 'Fluffy basmati rice tempered with cumin seeds and ghee', price: 149, category_id: 3, is_veg: 1, spice_level: 0, ingredients: 'Basmati Rice, Cumin Seeds, Ghee', prep_time: 12, image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&h=300&fit=crop' },
        { name: 'Mutton Biryani', description: 'Slow-cooked mutton pieces with long-grain rice and secret biryani spices', price: 399, category_id: 3, is_veg: 0, spice_level: 3, ingredients: 'Basmati Rice, Mutton, Saffron, Fried Onion, Spices', prep_time: 40, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop' },

        // Breads
        { name: 'Butter Naan', description: 'Soft leavened bread baked in tandoor and brushed with melted butter', price: 59, category_id: 4, is_veg: 1, spice_level: 0, ingredients: 'Refined Flour, Yogurt, Butter', prep_time: 8, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop' },
        { name: 'Garlic Naan', description: 'Fresh naan topped with chopped garlic, butter and coriander', price: 79, category_id: 4, is_veg: 1, spice_level: 0, ingredients: 'Refined Flour, Garlic, Butter, Coriander', prep_time: 8, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop' },
        { name: 'Tandoori Roti', description: 'Whole wheat bread baked in traditional clay oven', price: 39, category_id: 4, is_veg: 1, spice_level: 0, ingredients: 'Whole Wheat Flour', prep_time: 6, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop' },
        { name: 'Cheese Naan', description: 'Naan stuffed with melted cheese and herbs', price: 99, category_id: 4, is_veg: 1, spice_level: 0, ingredients: 'Refined Flour, Cheese, Herbs, Butter', prep_time: 10, image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop' },

        // Beverages
        { name: 'Mango Lassi', description: 'Creamy yogurt drink blended with sweet Alphonso mango pulp', price: 129, category_id: 5, is_veg: 1, spice_level: 0, ingredients: 'Yogurt, Mango Pulp, Sugar, Cardamom', prep_time: 5, image: 'https://images.unsplash.com/photo-1527585743534-7113e3211270?w=400&h=300&fit=crop' },
        { name: 'Fresh Lime Soda', description: 'Refreshing sparkling lemonade perfectly balanced between sweet and tangy', price: 79, category_id: 5, is_veg: 1, spice_level: 0, ingredients: 'Lime, Soda, Sugar, Salt, Mint', prep_time: 3, image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&h=300&fit=crop' },
        { name: 'Masala Chai', description: 'Authentic Indian spiced tea brewed with fresh ginger and cardamom', price: 59, category_id: 5, is_veg: 1, spice_level: 0, ingredients: 'Tea, Milk, Ginger, Cardamom, Cinnamon', prep_time: 5, image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&h=300&fit=crop' },
        { name: 'Cold Coffee', description: 'Chilled coffee blended with milk, ice cream and a drizzle of chocolate', price: 149, category_id: 5, is_veg: 1, spice_level: 0, ingredients: 'Coffee, Milk, Ice Cream, Chocolate', prep_time: 5, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop' },

        // Desserts
        { name: 'Gulab Jamun', description: 'Soft milk dumplings soaked in warm rose-flavored sugar syrup', price: 129, category_id: 6, is_veg: 1, spice_level: 0, ingredients: 'Khoya, Sugar, Rose Water, Cardamom', prep_time: 5, image: 'https://images.unsplash.com/photo-1666190051816-c5116b3ee624?w=400&h=300&fit=crop' },
        { name: 'Rasmalai', description: 'Delicate cheese patties immersed in thick, sweetened, cardamom-flavored milk', price: 149, category_id: 6, is_veg: 1, spice_level: 0, ingredients: 'Chenna, Milk, Sugar, Cardamom, Saffron, Pistachios', prep_time: 5, image: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400&h=300&fit=crop' },
        { name: 'Kulfi', description: 'Traditional Indian ice cream made with reduced milk, nuts and saffron', price: 119, category_id: 6, is_veg: 1, spice_level: 0, ingredients: 'Milk, Sugar, Pistachios, Almonds, Saffron', prep_time: 3, image: 'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=400&h=300&fit=crop' },
        { name: 'Chocolate Brownie', description: 'Warm, fudgy chocolate brownie served with vanilla ice cream', price: 179, category_id: 6, is_veg: 1, spice_level: 0, ingredients: 'Dark Chocolate, Butter, Flour, Eggs, Walnuts', prep_time: 8, image: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=300&fit=crop' },
    ];

    const insertItem = db.prepare(`
    INSERT INTO menu_items (name, description, price, category_id, is_veg, spice_level, ingredients, prep_time, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    menuItems.forEach(item => {
        insertItem.run(item.name, item.description, item.price, item.category_id, item.is_veg, item.spice_level, item.ingredients, item.prep_time, item.image);
    });

    // Add some addons
    const addons = [
        { menu_item_id: 1, name: 'Extra Cheese', price: 40 },
        { menu_item_id: 1, name: 'Mint Chutney', price: 20 },
        { menu_item_id: 6, name: 'Extra Gravy', price: 50 },
        { menu_item_id: 6, name: 'Boneless', price: 80 },
        { menu_item_id: 11, name: 'Extra Raita', price: 30 },
        { menu_item_id: 11, name: 'Boiled Egg', price: 25 },
        { menu_item_id: 18, name: 'Extra Cheese', price: 40 },
        { menu_item_id: 25, name: 'Extra Scoop', price: 40 },
    ];

    const insertAddon = db.prepare('INSERT INTO addons (menu_item_id, name, price) VALUES (?, ?, ?)');
    addons.forEach(addon => insertAddon.run(addon.menu_item_id, addon.name, addon.price));

    // Create tables (1-15)
    const insertTable = db.prepare('INSERT INTO tables (table_number, capacity) VALUES (?, ?)');
    for (let i = 1; i <= 15; i++) {
        insertTable.run(i, i <= 5 ? 2 : (i <= 10 ? 4 : 6));
    }

    console.log('✅ Database seeded successfully!');
    console.log('📋 Admin login: username=admin, password=admin123');
    console.log('📋 Staff login:  username=staff, password=staff123');
}

// Run seed
seedDatabase();

// ============================================================
// AUTO-CLEANUP: Delete orders & history older than 7 days
// ============================================================
function cleanupOldData() {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        console.log(`🧹 Running cleanup for data older than ${sevenDaysAgo.split('T')[0]}...`);

        // Get old completed/cancelled orders
        const oldOrders = db.prepare(`
            SELECT order_id FROM orders 
            WHERE status IN ('completed', 'cancelled') 
            AND created_at < ?
        `).all(sevenDaysAgo);

        if (oldOrders.length === 0) {
            console.log('🧹 No old data to clean up.');
            return;
        }

        const orderIds = oldOrders.map(o => o.order_id);

        // Delete in a transaction for safety
        const cleanup = db.transaction(() => {
            // Delete order items for old orders
            const deleteItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
            orderIds.forEach(id => deleteItems.run(id));

            // Delete the old orders themselves
            const deletedOrders = db.prepare(`
                DELETE FROM orders 
                WHERE status IN ('completed', 'cancelled') 
                AND created_at < ?
            `).run(sevenDaysAgo);

            // Delete old bills (completed payments older than 7 days)
            const oldBills = db.prepare(`
                SELECT id FROM bills WHERE created_at < ? AND payment_status = 'completed'
            `).all(sevenDaysAgo);

            if (oldBills.length > 0) {
                const deleteBillItems = db.prepare('DELETE FROM bill_items WHERE bill_id = ?');
                oldBills.forEach(b => deleteBillItems.run(b.id));
                db.prepare(`DELETE FROM bills WHERE created_at < ? AND payment_status = 'completed'`).run(sevenDaysAgo);
            }

            // Delete old notifications (older than 7 days)
            db.prepare('DELETE FROM notifications WHERE created_at < ?').run(sevenDaysAgo);

            console.log(`🧹 Cleanup complete: ${deletedOrders.changes} orders, ${oldBills.length} bills removed.`);
        });

        cleanup();
    } catch (err) {
        console.error('🧹 Cleanup error:', err.message);
    }
}

// Run cleanup on startup
cleanupOldData();

// Run cleanup every 24 hours
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms
setInterval(cleanupOldData, CLEANUP_INTERVAL);

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, () => {
    console.log('');
    console.log('🍽️  ══════════════════════════════════════════');
    console.log('   DineFlow Server running on port', PORT);
    console.log('   API:       http://localhost:' + PORT + '/api');
    console.log('   Frontend:  ' + FRONTEND_URL);
    console.log('   Auto-cleanup: Every 24h (orders > 7 days)');
    console.log('🍽️  ══════════════════════════════════════════');
    console.log('');
});
