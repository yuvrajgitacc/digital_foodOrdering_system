import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Bell, Plus, Check, ClipboardList, X, Flame, Star, ArrowRight } from 'lucide-react';
import { api } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

export default function Menu() {
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [vegFilter, setVegFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();
    const { items: cartItems, addItem, totalItems, total, tableNumber, tableId } = useCart();
    const { socket } = useSocket();
    const searchRef = useRef(null);
    const categoriesRef = useRef(null);

    useEffect(() => {
        if (!tableId) { navigate('/'); return; }
        Promise.all([api.getMenu({ available: 'true' }), api.getCategories()])
            .then(([menu, cats]) => { setMenuItems(menu); setCategories(cats); setLoading(false); })
            .catch(() => setLoading(false));
        const activeOrders = JSON.parse(localStorage.getItem('dineflow_active_orders') || '[]');
        if (activeOrders.length > 0) setActiveOrderId(activeOrders[0]);
    }, [tableId]);

    useEffect(() => {
        if (!socket) return;
        socket.on('menu-updated', () => {
            api.getMenu({ available: 'true' }).then(setMenuItems);
        });
        return () => socket.off('menu-updated');
    }, [socket]);

    // Track scroll for sticky header shadow
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (showSearch && searchRef.current) searchRef.current.focus();
    }, [showSearch]);

    const filteredItems = useMemo(() => {
        let result = menuItems;
        if (activeCategory !== 'all') result = result.filter(i => i.category_id === parseInt(activeCategory));
        if (search) result = result.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()));
        if (vegFilter === 'veg') result = result.filter(i => i.is_veg);
        if (vegFilter === 'nonveg') result = result.filter(i => !i.is_veg);
        return result;
    }, [menuItems, activeCategory, search, vegFilter]);

    const groupedItems = useMemo(() => {
        const groups = {};
        filteredItems.forEach(item => {
            const cat = item.category_name || 'Other';
            if (!groups[cat]) groups[cat] = { icon: item.category_icon || '🍽️', items: [] };
            groups[cat].items.push(item);
        });
        return groups;
    }, [filteredItems]);

    const isInCart = (id) => cartItems.some(i => i.menu_item_id === id);
    const handleCallWaiter = () => {
        if (window.navigator.vibrate) window.navigator.vibrate(100);
        api.callWaiter(tableId)
            .then(() => toast.success('Waiter has been notified!', { icon: '🔔' }))
            .catch(err => toast.error(err.message || 'Failed to notify waiter'));
    };

    const handleAdd = (item) => {
        addItem({
            menu_item_id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            is_veg: item.is_veg,
            selectedAddons: [],
            addons: [],
        });
        toast.success(`${item.name} added!`, { icon: '🛒', duration: 1500 });
        if (window.navigator.vibrate) window.navigator.vibrate(50); // Haptic feedback
    };

    const renderSkeletons = () => (
        <div className="menu-body" style={{ padding: 20 }}>
            <div style={{ height: 30, width: '150px', background: '#e5e7eb', borderRadius: 8, marginBottom: 20 }}></div>
            {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20, background: '#fff', padding: 12, borderRadius: 16 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ height: 20, width: '70%', background: '#f3f4f6', borderRadius: 4, marginBottom: 8 }}></div>
                        <div style={{ height: 14, width: '40%', background: '#f3f4f6', borderRadius: 4, marginBottom: 12 }}></div>
                        <div style={{ height: 24, width: '30%', background: '#f3f4f6', borderRadius: 12 }}></div>
                    </div>
                    <div style={{ width: 100, height: 100, background: '#f3f4f6', borderRadius: 16 }}></div>
                </div>
            ))}
        </div>
    );

    if (loading) return (
        <div className="customer-app">
            <div className={`menu-sticky-header`}>
                <div className="menu-topbar">
                    <div className="menu-topbar-left"><h1 className="brand">Dine<span>Flow</span></h1></div>
                </div>
            </div>
            {renderSkeletons()}
        </div>
    );

    return (
        <div className="customer-app">
            {/* ===== STICKY HEADER ===== */}
            <div className={`menu-sticky-header ${scrolled ? 'scrolled' : ''}`}>
                {/* Top bar: Brand + Actions */}
                <div className="menu-topbar">
                    <div className="menu-topbar-left">
                        <h1 className="brand">Dine<span>Flow</span></h1>
                        <div className="menu-table-chip">
                            <span className="table-dot"></span>
                            Table {tableNumber}
                        </div>
                    </div>
                    <div className="menu-topbar-right">
                        <button
                            className={`menu-action-btn ${showSearch ? 'active' : ''}`}
                            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch(''); }}
                        >
                            {showSearch ? <X size={18} /> : <Search size={18} />}
                        </button>
                        <button className="menu-action-btn cart-btn" onClick={() => navigate('/cart')}>
                            <ShoppingCart size={18} />
                            {totalItems > 0 && <span className="menu-cart-badge">{totalItems}</span>}
                        </button>
                    </div>
                </div>

                {/* Search bar (expandable) */}
                <div className={`menu-search-wrap ${showSearch ? 'open' : ''}`}>
                    <div className="menu-search-inner">
                        <Search size={16} className="menu-search-icon" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search dishes, cuisines..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="menu-search-clear" onClick={() => setSearch('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Categories horizontal scroll */}
                <div className="menu-categories-wrap" ref={categoriesRef}>
                    <button className={`menu-cat-pill ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>
                        <span>🍽️</span> All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            className={`menu-cat-pill ${activeCategory === String(cat.id) ? 'active' : ''}`}
                            onClick={() => setActiveCategory(String(cat.id))}
                        >
                            <span>{cat.icon}</span> {cat.name}
                        </button>
                    ))}
                </div>

                {/* Veg/Non-veg filter */}
                <div className="menu-filter-strip">
                    <button className={`menu-filter-btn ${vegFilter === 'all' ? 'active' : ''}`} onClick={() => setVegFilter('all')}>All</button>
                    <button className={`menu-filter-btn veg ${vegFilter === 'veg' ? 'active' : ''}`} onClick={() => setVegFilter('veg')}>
                        <span className="filter-dot veg"></span> Veg
                    </button>
                    <button className={`menu-filter-btn nonveg ${vegFilter === 'nonveg' ? 'active' : ''}`} onClick={() => setVegFilter('nonveg')}>
                        <span className="filter-dot nonveg"></span> Non-Veg
                    </button>
                    <div className="menu-result-count">{filteredItems.length} dishes</div>
                </div>
            </div>

            {/* ===== Active Order Banner ===== */}
            {activeOrderId && (
                <div className="menu-order-banner" onClick={() => navigate(`/order/${activeOrderId}`)}>
                    <div className="order-banner-left">
                        <div className="order-banner-icon">
                            <ClipboardList size={16} />
                        </div>
                        <div>
                            <div className="order-banner-title">Your order is being prepared</div>
                            <div className="order-banner-sub">Tap to track live status</div>
                        </div>
                    </div>
                    <div className="order-banner-arrow">
                        <ArrowRight size={16} />
                    </div>
                </div>
            )}

            {/* ===== MENU CONTENT ===== */}
            <div className="menu-body">
                {Object.keys(groupedItems).length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <div className="empty-icon">🔍</div>
                        <h3>No dishes found</h3>
                        <p>Try adjusting your search or filters</p>
                    </div>
                ) : (
                    Object.entries(groupedItems).map(([catName, { icon, items }], gi) => (
                        <div key={catName} className="menu-section" style={{ animationDelay: `${gi * 0.05}s` }}>
                            <div className="menu-section-header">
                                <span className="menu-section-icon">{icon}</span>
                                <h3>{catName}</h3>
                                <span className="menu-section-count">{items.length}</span>
                            </div>
                            <div className="menu-items-list">
                                {items.map((item, ii) => (
                                    <div
                                        key={item.id}
                                        className={`menu-item-card ${!item.is_available ? 'sold-out' : ''}`}
                                        style={{ animationDelay: `${(gi * items.length + ii) * 0.03}s` }}
                                        onClick={() => navigate(`/menu/${item.id}`)}
                                    >
                                        <div className="menu-item-info">
                                            <div className="menu-item-badges">
                                                <div className={`veg-indicator ${item.is_veg ? 'veg' : 'nonveg'}`}>
                                                    <span></span>
                                                </div>
                                                {item.spice_level > 2 && (
                                                    <div className="spicy-tag"><Flame size={10} /> Spicy</div>
                                                )}
                                                {item.is_bestseller && (
                                                    <div className="bestseller-tag"><Star size={10} /> Bestseller</div>
                                                )}
                                            </div>
                                            <h4 className="menu-item-name">{item.name}</h4>
                                            <p className="menu-item-desc">{item.description}</p>
                                            <div className="menu-item-bottom">
                                                <span className="menu-item-price">₹{item.price}</span>
                                                {item.is_available && (
                                                    <button
                                                        className={`menu-add-btn ${isInCart(item.id) ? 'added' : ''}`}
                                                        onClick={(e) => { e.stopPropagation(); handleAdd(item); }}
                                                    >
                                                        {isInCart(item.id) ? <><Check size={14} /> Added</> : <><Plus size={14} /> ADD</>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="menu-item-img">
                                            <img
                                                src={item.image || ''}
                                                alt={item.name}
                                                onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<div class="img-fallback">${icon}</div>`; }}
                                            />
                                            {!item.is_available && <div className="soldout-overlay">Sold Out</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Call Waiter FAB */}
            <button className="call-waiter-fab" onClick={handleCallWaiter} title="Call Waiter">
                <Bell size={22} />
            </button>

            {/* Floating Cart Bar */}
            {totalItems > 0 && (
                <div className="floating-cart-bar" onClick={() => navigate('/cart')}>
                    <div className="cart-bar-left">
                        <span className="cart-bar-count">{totalItems}</span>
                        <span className="cart-bar-label">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="cart-bar-right">
                        <span className="cart-bar-total">₹{total.toFixed(0)}</span>
                        <span className="cart-bar-cta">View Cart <ArrowRight size={14} /></span>
                    </div>
                </div>
            )}
        </div>
    );
}
