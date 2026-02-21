import { useState, useEffect } from 'react';
import { QrCode, Trash2, Eye, X, RefreshCw, Plus, Edit2, Users } from 'lucide-react';
import AdminLayout from './AdminDashboard';
import { api } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

export default function AdminTables() {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [qrData, setQrData] = useState(null);
    const [selectedTable, setSelectedTable] = useState(null);
    const [showTableModal, setShowTableModal] = useState(false);
    const [editingTable, setEditingTable] = useState(null);
    const { socket } = useSocket();

    const fetchTables = () => {
        api.getTables().then(data => { setTables(data); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchTables(); }, []);
    useEffect(() => {
        if (!socket) return;
        socket.on('table-updated', fetchTables);
        socket.on('new-order', fetchTables);
        return () => { socket.off('table-updated', fetchTables); socket.off('new-order', fetchTables); };
    }, [socket]);

    const clearTable = async (id) => {
        if (!confirm('Clear this table? All pending orders will be completed.')) return;
        await api.clearTable(id);
        toast.success('Table cleared');
        fetchTables();
    };

    const deleteTable = async (id, tableNum) => {
        if (!confirm(`Delete Table #${tableNum}? This action cannot be undone.`)) return;
        try {
            await api.deleteTable(id);
            toast.success(`Table #${tableNum} deleted`);
            fetchTables();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const showQR = async (id) => {
        const data = await api.getTableQR(id);
        setQrData(data);
    };

    const viewHistory = async (tableId) => {
        const orders = await api.getTableOrders(tableId);
        setSelectedTable({ id: tableId, table_number: tables.find(t => t.id === tableId)?.table_number, orders });
    };

    const totalSeats = tables.reduce((sum, t) => sum + t.capacity, 0);
    const occupiedTables = tables.filter(t => t.status === 'occupied').length;

    return (
        <AdminLayout title="Table Management">
            {/* Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Tables</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A' }}>{tables.length}</div>
                </div>
                <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Seats</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A' }}>{totalSeats}</div>
                </div>
                <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Occupied</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#F59E0B' }}>{occupiedTables}</div>
                </div>
                <div style={{ padding: '16px 20px', background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Available</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#22C55E' }}>{tables.length - occupiedTables}</div>
                </div>
            </div>

            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                <div className="flex items-center gap-16">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: '#22C55E' }}></span>
                        <span style={{ fontSize: 13, color: '#6B7280' }}>Available</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: '#F59E0B' }}></span>
                        <span style={{ fontSize: 13, color: '#6B7280' }}>Occupied</span>
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <button className="btn btn-sm btn-outline" onClick={fetchTables}><RefreshCw size={16} /> Refresh</button>
                    <button className="btn btn-primary" onClick={() => { setEditingTable(null); setShowTableModal(true); }}>
                        <Plus size={18} /> Add Table
                    </button>
                </div>
            </div>

            {loading ? <div className="loading-screen"><div className="spinner"></div></div> : (
                <div className="tables-grid">
                    {tables.map(table => (
                        <div key={table.id} className={`admin-table-card ${table.status}`}>
                            <div className="admin-table-number">#{table.table_number}</div>
                            <div className={`admin-table-status ${table.status}`}>{table.status}</div>
                            <div className="admin-table-capacity">
                                <Users size={14} style={{ display: 'inline', marginRight: 4 }} />
                                {table.capacity} seats
                            </div>
                            {table.active_orders > 0 && (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
                                    📋 {table.active_orders} active order{table.active_orders !== 1 ? 's' : ''}
                                </div>
                            )}
                            <div className="admin-table-actions">
                                <button className="btn btn-sm btn-outline" onClick={() => { setEditingTable(table); setShowTableModal(true); }} title="Edit Table"><Edit2 size={14} /></button>
                                <button className="btn btn-sm btn-outline" onClick={() => showQR(table.id)} title="QR Code"><QrCode size={14} /></button>
                                <button className="btn btn-sm btn-outline" onClick={() => viewHistory(table.id)} title="View Orders"><Eye size={14} /></button>
                                {table.status === 'occupied' && (
                                    <button className="btn btn-sm" style={{ color: '#F59E0B', border: '1px solid #F59E0B', borderRadius: 8, padding: '4px 8px' }} onClick={() => clearTable(table.id)} title="Clear Table">Clear</button>
                                )}
                                {table.status === 'available' && table.active_orders === 0 && (
                                    <button className="btn btn-sm" style={{ color: '#EF4444' }} onClick={() => deleteTable(table.id, table.table_number)} title="Delete"><Trash2 size={14} /></button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Add Table Card */}
                    <div
                        onClick={() => { setEditingTable(null); setShowTableModal(true); }}
                        style={{
                            border: '2px dashed #D1D5DB', borderRadius: 16, padding: 24,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s ease', minHeight: 160,
                            color: '#9CA3AF', gap: 8,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#C5F82A'; e.currentTarget.style.color = '#C5F82A'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#9CA3AF'; }}
                    >
                        <Plus size={32} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Add New Table</span>
                    </div>
                </div>
            )}

            {/* Add/Edit Table Modal */}
            {showTableModal && (
                <TableModal
                    table={editingTable}
                    existingNumbers={tables.map(t => t.table_number)}
                    onClose={() => { setShowTableModal(false); setEditingTable(null); }}
                    onSave={() => { fetchTables(); setShowTableModal(false); setEditingTable(null); }}
                />
            )}

            {/* QR Code Modal */}
            {qrData && (
                <div className="modal-overlay" onClick={() => setQrData(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3>QR Code - Table {qrData.table_number}</h3>
                            <button className="modal-close" onClick={() => setQrData(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body qr-display">
                            <img src={qrData.qr} alt={`QR Code for Table ${qrData.table_number}`} />
                            <p>Scan to open menu for Table {qrData.table_number}</p>
                            <p style={{ fontSize: 11, marginTop: 4, wordBreak: 'break-all' }}>{qrData.url}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Order History Modal */}
            {selectedTable && (
                <div className="modal-overlay" onClick={() => setSelectedTable(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h3>Table {selectedTable.table_number} — Order History</h3>
                            <button className="modal-close" onClick={() => setSelectedTable(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            {selectedTable.orders.length === 0 ? (
                                <div className="empty-state"><p>No orders for this table</p></div>
                            ) : (
                                selectedTable.orders.map(order => (
                                    <div key={order.order_id} style={{ padding: 16, border: '1px solid #E5E7EB', borderRadius: 12, marginBottom: 12 }}>
                                        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#9CA3AF' }}>{order.order_id}</span>
                                            <span className={`status-badge status-${order.status}`}>{order.status}</span>
                                        </div>
                                        {order.items?.map((item, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
                                                <span>{item.quantity}× {item.item_name}</span>
                                                <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                                            </div>
                                        ))}
                                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 8, marginTop: 8, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Total</span><span>₹{order.total_amount.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

// ============================================================
// TABLE ADD/EDIT MODAL
// ============================================================
function TableModal({ table, existingNumbers, onClose, onSave }) {
    const [tableNumber, setTableNumber] = useState(table?.table_number || '');
    const [capacity, setCapacity] = useState(table?.capacity || 4);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isEditing = !!table;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const num = parseInt(tableNumber);
        if (!num || num < 1) { setError('Please enter a valid table number'); return; }
        if (!isEditing && existingNumbers.includes(num)) { setError(`Table #${num} already exists`); return; }
        if (isEditing && num !== table.table_number && existingNumbers.includes(num)) { setError(`Table #${num} already exists`); return; }
        if (capacity < 1 || capacity > 20) { setError('Seats must be between 1 and 20'); return; }

        setSaving(true);
        try {
            if (isEditing) {
                await api.updateTable(table.id, { table_number: num, capacity: parseInt(capacity) });
                toast.success(`Table #${num} updated!`);
            } else {
                await api.createTable({ table_number: num, capacity: parseInt(capacity) });
                toast.success(`Table #${num} created!`);
            }
            onSave();
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const seatPresets = [2, 4, 6, 8, 10];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h3>{isEditing ? `Edit Table #${table.table_number}` : 'Add New Table'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && (
                            <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, color: '#DC2626', fontSize: 13, marginBottom: 16 }}>
                                {error}
                            </div>
                        )}

                        <div className="input-group" style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Table Number</label>
                            <input
                                className="input"
                                type="number"
                                min="1"
                                value={tableNumber}
                                onChange={e => setTableNumber(e.target.value)}
                                placeholder="e.g. 1, 2, 3..."
                                required
                                style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', letterSpacing: 2 }}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, display: 'block' }}>Number of Seats</label>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                {seatPresets.map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setCapacity(num)}
                                        style={{
                                            flex: 1, padding: '10px 0', borderRadius: 10, border: '2px solid',
                                            borderColor: capacity === num ? '#C5F82A' : '#E5E7EB',
                                            background: capacity === num ? 'rgba(197,248,42,0.1)' : '#fff',
                                            fontWeight: 700, fontSize: 16, cursor: 'pointer',
                                            color: capacity === num ? '#1A1A1A' : '#6B7280',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 13, color: '#9CA3AF' }}>Or custom:</span>
                                <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={capacity}
                                    onChange={e => setCapacity(parseInt(e.target.value) || 1)}
                                    style={{ width: 80, textAlign: 'center', fontWeight: 600 }}
                                />
                                <span style={{ fontSize: 13, color: '#9CA3AF' }}>seats</span>
                            </div>
                        </div>

                        {/* Visual Preview */}
                        <div style={{
                            padding: 20, background: '#F9FAFB', borderRadius: 12, textAlign: 'center',
                            border: '1px solid #E5E7EB',
                        }}>
                            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Preview</div>
                            <div style={{ fontSize: 32, fontWeight: 800, color: '#1A1A1A' }}>
                                #{tableNumber || '?'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, color: '#6B7280', fontSize: 14 }}>
                                <Users size={16} />
                                <span>{capacity} seat{capacity !== 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 12 }}>
                                {Array.from({ length: Math.min(capacity, 10) }, (_, i) => (
                                    <div key={i} style={{
                                        width: 20, height: 20, borderRadius: '50%', background: '#C5F82A',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, fontWeight: 700, color: '#1A1A1A',
                                    }}>
                                        {i + 1}
                                    </div>
                                ))}
                                {capacity > 10 && <span style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>+{capacity - 10}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : (isEditing ? 'Update Table' : 'Add Table')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
