import { useState, useEffect } from 'react';
import { CheckCircle, Clock, ChefHat, Truck, XCircle, RefreshCw } from 'lucide-react';
import AdminLayout from './AdminDashboard';
import { api } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

const STATUS_FLOW = {
    placed: { next: 'accepted', label: 'Accept', icon: <CheckCircle size={16} /> },
    accepted: { next: 'preparing', label: 'Start Preparing', icon: <ChefHat size={16} /> },
    preparing: { next: 'ready', label: 'Mark Ready', icon: <Truck size={16} /> },
    ready: { next: 'served', label: 'Mark Served', icon: <CheckCircle size={16} /> },
    served: { next: 'completed', label: 'Complete', icon: <CheckCircle size={16} /> },
};

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState('active');
    const [loading, setLoading] = useState(true);
    const { socket } = useSocket();

    const fetchOrders = () => {
        api.getOrders(filter === 'active' ? {} : (filter === 'all' ? {} : { status: filter })).then(data => {
            let filtered = data;
            if (filter === 'active') {
                filtered = data.filter(o => !['completed', 'cancelled'].includes(o.status));
            }
            // SORTING: Oldest orders first (Priority) 
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            setOrders(filtered);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchOrders(); }, [filter]);
    useEffect(() => {
        if (!socket) return;
        socket.on('new-order', fetchOrders);
        socket.on('order-status-changed', fetchOrders);
        return () => {
            socket.off('new-order', fetchOrders);
            socket.off('order-status-changed', fetchOrders);
        };
    }, [socket, filter]);

    const updateStatus = async (orderId, newStatus) => {
        try {
            await api.updateOrderStatus(orderId, newStatus);
            toast.success(`Order updated to ${newStatus}`);
            fetchOrders();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const cancelOrder = async (orderId) => {
        if (!confirm('Cancel this order?')) return;
        try {
            await api.updateOrderStatus(orderId, 'cancelled');
            toast.success('Order cancelled');
            fetchOrders();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const getMinutes = (dateStr) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);

    const timeSince = (dateStr) => {
        const diff = getMinutes(dateStr);
        if (diff < 1) return 'Just now';
        if (diff < 60) return `${diff}m ago`;
        return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
    };

    return (
        <AdminLayout title="Live Orders">
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                <div className="tabs">
                    {['active', 'placed', 'accepted', 'preparing', 'ready', 'completed'].map(f => (
                        <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <button className="btn btn-sm btn-outline" onClick={fetchOrders}><RefreshCw size={16} /> Refresh</button>
            </div>

            {loading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
            ) : orders.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No orders found</h3>
                    <p>Orders will appear here in real-time</p>
                </div>
            ) : (
                <div className="orders-grid">
                    {orders.map(order => {
                        const mins = order.created_at ? getMinutes(order.created_at) : 0;
                        const isUrgent = mins > 15 && !['completed', 'cancelled'].includes(order.status);

                        return (
                            <div key={order.id || order.order_id} className={`order-card ${isUrgent ? 'urgent' : ''}`} style={isUrgent ? { border: '2px solid #EF4444' } : {}}>
                                {isUrgent && (
                                    <div style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, textAlign: 'center', padding: '2px 0', textTransform: 'uppercase', borderRadius: '8px 8px 0 0', margin: '-16px -16px 12px -16px' }}>
                                        Urgent • Delayed by {mins - 15}m
                                    </div>
                                )}
                                <div className="order-card-header">
                                    <div className="order-table-badge">🍽️ Table {order.table_number || '?'}</div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className={`status-badge status-${order.status}`}>{order.status}</span>
                                        <div className="order-time"><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />{order.created_at ? timeSince(order.created_at) : 'N/A'}</div>
                                    </div>
                                </div>

                                <div className="order-items-list">
                                    {order.items?.map((item, i) => (
                                        <div key={i} className="order-item-row">
                                            <span><span className="order-item-qty">{item.quantity}×</span> {item.item_name}</span>
                                            <span>₹{((item.price || 0) * (item.quantity || 1)).toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>

                                {order.special_notes && (
                                    <div style={{ padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 13, marginBottom: 8, color: '#92400E' }}>
                                        📝 {order.special_notes}
                                    </div>
                                )}

                                <div className="order-total">
                                    <span>Total</span>
                                    <span>₹{(order.total_amount || 0).toFixed(0)}</span>
                                </div>

                                <div className="order-actions">
                                    {order.status && STATUS_FLOW[order.status] && (
                                        <button className="btn btn-primary btn-sm" onClick={() => updateStatus(order.order_id, STATUS_FLOW[order.status].next)}>
                                            {STATUS_FLOW[order.status].icon} {STATUS_FLOW[order.status].label}
                                        </button>
                                    )}
                                    {order.status && !['completed', 'cancelled', 'served'].includes(order.status) && (
                                        <button className="btn btn-danger btn-sm btn-outline" onClick={() => cancelOrder(order.order_id)}>
                                            <XCircle size={16} /> Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </AdminLayout>
    );
}


