import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, ChefHat, Truck, UtensilsCrossed, ArrowLeft, FileText } from 'lucide-react';
import { api } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import { useCart } from '../../context/CartContext';

const STATUS_STEPS = [
    { key: 'placed', label: 'Order Placed', desc: 'Your order has been received', icon: <CheckCircle size={18} /> },
    { key: 'accepted', label: 'Accepted', desc: 'Restaurant has accepted your order', icon: <CheckCircle size={18} /> },
    { key: 'preparing', label: 'Preparing', desc: 'Chef is preparing your food', icon: <ChefHat size={18} /> },
    { key: 'ready', label: 'Ready to Serve', desc: 'Your food is ready!', icon: <Truck size={18} /> },
    { key: 'served', label: 'Served', desc: 'Enjoy your meal!', icon: <UtensilsCrossed size={18} /> },
];

export default function OrderTracking() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const { socket } = useSocket();
    const { tableId } = useCart();

    useEffect(() => {
        api.getOrder(orderId)
            .then(data => { setOrder(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [orderId]);

    // Clean up localStorage when order is served/completed
    useEffect(() => {
        if (!order) return;
        if (['served', 'completed'].includes(order.status)) {
            const activeOrders = JSON.parse(localStorage.getItem('dineflow_active_orders') || '[]');
            const filtered = activeOrders.filter(id => id !== orderId);
            localStorage.setItem('dineflow_active_orders', JSON.stringify(filtered));
        }
    }, [order?.status]);

    useEffect(() => {
        if (!socket || !order) return;
        const handler = (updatedOrder) => {
            if (updatedOrder.order_id === orderId) setOrder(updatedOrder);
        };
        socket.on(`order-update-${order.table_id}`, handler);
        socket.on('order-status-changed', handler);
        return () => {
            socket.off(`order-update-${order.table_id}`, handler);
            socket.off('order-status-changed', handler);
        };
    }, [socket, order, orderId]);

    const currentStepIndex = order ? STATUS_STEPS.findIndex(s => s.key === order.status) : -1;

    if (loading) return <div className="customer-app order-tracking-page"><div className="loading-screen"><div className="spinner"></div><p>Loading order...</p></div></div>;
    if (!order) return <div className="customer-app order-tracking-page"><div className="loading-screen"><p>Order not found</p></div></div>;

    return (
        <div className="customer-app order-tracking-page">
            <div className="flex items-center gap-12" style={{ marginBottom: 20 }}>
                <button onClick={() => navigate('/menu')} style={{ color: '#fff' }}><ArrowLeft size={22} /></button>
                <h2 style={{ color: '#fff', fontSize: 18 }}>Order Status</h2>
            </div>

            <div className="order-success-anim">
                <div className="check-circle"><CheckCircle size={36} color="#1A1A1A" /></div>
                <h2>{order.status === 'served' || order.status === 'completed' ? 'Enjoy your meal!' : 'Order Confirmed!'}</h2>
                <p>Your order is being processed</p>
            </div>

            <div className="order-id-display">Order ID: {order.order_id}</div>

            <div className="status-timeline">
                {STATUS_STEPS.map((step, i) => {
                    const isCompleted = i < currentStepIndex;
                    const isActive = i === currentStepIndex;
                    const isPending = i > currentStepIndex;
                    return (
                        <div key={step.key} className={`timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}>
                            {i < STATUS_STEPS.length - 1 && <div className="timeline-line"></div>}
                            <div className="timeline-dot">{step.icon}</div>
                            <div className="timeline-info">
                                <h4>{step.label}</h4>
                                <p>{step.desc}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {order.items && (
                <div style={{ marginTop: 24 }}>
                    <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Order Items</h3>
                    {order.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #333', color: '#E5E7EB', fontSize: 14 }}>
                            <span><span style={{ color: '#9CA3AF', marginRight: 8 }}>{item.quantity}×</span>{item.item_name}</span>
                            <span style={{ color: '#C5F82A', fontWeight: 600 }}>₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 8, borderTop: '2px solid #444', color: '#fff', fontWeight: 700, fontSize: 16 }}>
                        <span>Total</span>
                        <span>₹{order.total_amount.toFixed(0)}</span>
                    </div>
                </div>
            )}

            <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <button className="btn btn-primary w-full" onClick={() => navigate('/menu')}>
                    <UtensilsCrossed size={18} /> Order More
                </button>
                {(order.status === 'served' || order.status === 'completed') && (
                    <button className="btn btn-outline w-full" style={{ borderColor: '#444', color: '#fff' }} onClick={() => navigate('/bill')}>
                        <FileText size={18} /> View Bill
                    </button>
                )}
            </div>
        </div>
    );
}
