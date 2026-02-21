import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function Cart() {
    const navigate = useNavigate();
    const { items, removeItem, updateQuantity, specialNotes, setNotes, clearCart, subtotal, tax, total, tableId, tableNumber, totalItems } = useCart();
    const [placing, setPlacing] = useState(false);

    const handlePlaceOrder = async () => {
        if (items.length === 0) return;
        setPlacing(true);
        try {
            const orderData = {
                table_id: tableId,
                items: items.map(item => ({
                    menu_item_id: item.menu_item_id,
                    quantity: item.quantity,
                    addons: item.selectedAddons || [],
                    special_instructions: '',
                })),
                special_notes: specialNotes,
            };
            const order = await api.placeOrder(orderData);
            clearCart();
            // Save active order so user can always come back to tracking
            const activeOrders = JSON.parse(localStorage.getItem('dineflow_active_orders') || '[]');
            activeOrders.unshift(order.order_id);
            localStorage.setItem('dineflow_active_orders', JSON.stringify(activeOrders));
            toast.success('Order placed successfully!', { icon: '🎉' });
            navigate(`/order/${order.order_id}`, { replace: true });
        } catch (err) {
            toast.error(err.message || 'Failed to place order');
        }
        setPlacing(false);
    };

    if (items.length === 0) {
        return (
            <div className="customer-app cart-page">
                <div className="cart-header">
                    <div className="flex items-center gap-12">
                        <button onClick={() => navigate('/menu')} style={{ color: '#fff' }}><ArrowLeft size={22} /></button>
                        <div>
                            <h1>Your Cart</h1>
                            <span className="cart-count">0 items</span>
                        </div>
                    </div>
                </div>
                <div className="empty-cart">
                    <div className="empty-icon">🛒</div>
                    <h2>Your cart is empty</h2>
                    <p>Add some delicious items from the menu!</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/menu')}>
                        Browse Menu
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="customer-app cart-page">
            <div className="cart-header">
                <div className="flex items-center gap-12">
                    <button onClick={() => navigate('/menu')} style={{ color: '#fff' }}><ArrowLeft size={22} /></button>
                    <div>
                        <h1>Your Cart</h1>
                        <span className="cart-count">{totalItems} item{totalItems !== 1 ? 's' : ''} • Table {tableNumber}</span>
                    </div>
                </div>
            </div>

            <div className="cart-items">
                {items.map((item, index) => (
                    <div key={index} className="cart-item">
                        <div className="cart-item-img">
                            <img
                                src={item.image || ''}
                                alt={item.name}
                                onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div class="img-fallback" style="font-size:28px">🍽️</div>'; }}
                            />
                        </div>
                        <div className="cart-item-info">
                            <div className="flex items-center gap-8">
                                <div className={`veg-badge ${!item.is_veg ? 'non-veg' : ''}`} style={{ width: 14, height: 14 }}></div>
                                <span className="cart-item-name">{item.name}</span>
                            </div>
                            {item.addons && item.addons.length > 0 && (
                                <span className="cart-item-addons">+ {item.addons.join(', ')}</span>
                            )}
                            <span className="cart-item-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                        <div className="cart-item-actions">
                            <button className="remove-btn" onClick={() => removeItem(index)}>
                                <Trash2 size={14} />
                            </button>
                            <div className="qty-selector">
                                <button onClick={() => updateQuantity(index, item.quantity - 1)}>
                                    <Minus size={14} />
                                </button>
                                <span>{item.quantity}</span>
                                <button onClick={() => updateQuantity(index, item.quantity + 1)}>
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="special-instructions">
                <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 6, display: 'block' }}>Special Instructions</label>
                <textarea
                    placeholder="Any allergies or special requests? Let us know..."
                    value={specialNotes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>

            <div className="cart-summary">
                <div className="summary-row"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                <div className="summary-row"><span>GST (5%)</span><span>₹{tax.toFixed(0)}</span></div>
                <div className="summary-row total"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
            </div>

            <div className="bottom-action-bar" style={{ background: '#fff', borderTop: '1px solid #E5E7EB' }}>
                <div className="price-display" style={{ color: '#1A1A1A' }}>
                    <span>₹</span>{total.toFixed(0)}
                </div>
                <button className="btn btn-primary btn-lg" onClick={handlePlaceOrder} disabled={placing}>
                    <ShoppingBag size={20} />
                    {placing ? 'Placing...' : 'Place Order'}
                </button>
            </div>
        </div>
    );
}
