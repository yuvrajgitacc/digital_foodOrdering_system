import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, Receipt } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Bill() {
    const navigate = useNavigate();
    const { tableId, tableNumber } = useCart();
    const [bills, setBills] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tableId) { navigate('/'); return; }
        Promise.all([
            api.getTableBills(tableId),
            api.getTableOrders(tableId),
        ]).then(([b, o]) => {
            setBills(b);
            setOrders(o);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [tableId]);

    if (loading) return <div className="customer-app bill-page"><div className="loading-screen"><div className="spinner"></div></div></div>;

    const latestBill = bills.length > 0 ? bills[0] : null;

    // If no bill exists yet, show order summary
    const allItems = [];
    orders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const existing = allItems.find(i => i.item_name === item.item_name && i.price === item.price);
                if (existing) existing.quantity += item.quantity;
                else allItems.push({ ...item, total: item.price * item.quantity });
            });
        }
    });
    allItems.forEach(i => i.total = i.price * i.quantity);
    const calcSubtotal = allItems.reduce((s, i) => s + i.total, 0);
    const calcTax = Math.round(calcSubtotal * 5) / 100;
    const calcTotal = calcSubtotal + calcTax;

    const displayBill = latestBill || {
        items: allItems.map(i => ({ item_name: i.item_name, quantity: i.quantity, price: i.price, total: i.total })),
        subtotal: calcSubtotal,
        tax_amount: calcTax,
        service_charge: 0,
        discount: 0,
        total: calcTotal,
        bill_number: 'Pending',
        payment_status: 'pending',
    };

    return (
        <div className="customer-app bill-page">
            <div className="flex items-center gap-12" style={{ marginBottom: 20 }}>
                <button onClick={() => navigate('/menu')} style={{ color: '#fff' }}><ArrowLeft size={22} /></button>
                <h2 style={{ color: '#fff', fontSize: 18 }}>Your Bill</h2>
            </div>

            <div className="bill-card">
                <div className="bill-header">
                    <Receipt size={32} color="#C5F82A" style={{ margin: '0 auto 8px' }} />
                    <h2>DineFlow</h2>
                    <p>Table {tableNumber} • {new Date().toLocaleDateString()}</p>
                    {displayBill.bill_number !== 'Pending' && (
                        <p style={{ fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>Bill: {displayBill.bill_number}</p>
                    )}
                </div>

                <div className="bill-items">
                    <div className="bill-item" style={{ fontWeight: 600, borderBottom: '2px solid #E5E7EB' }}>
                        <div className="bill-item-left"><span className="bill-item-qty">Qty</span><span>Item</span></div>
                        <span>Amount</span>
                    </div>
                    {(displayBill.items || allItems).map((item, i) => (
                        <div key={i} className="bill-item">
                            <div className="bill-item-left">
                                <span className="bill-item-qty">{item.quantity}×</span>
                                <span>{item.item_name}</span>
                            </div>
                            <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                    ))}
                </div>

                <div className="bill-totals">
                    <div className="summary-row"><span>Subtotal</span><span>₹{displayBill.subtotal.toFixed(0)}</span></div>
                    <div className="summary-row"><span>GST (5%)</span><span>₹{displayBill.tax_amount.toFixed(0)}</span></div>
                    {displayBill.service_charge > 0 && <div className="summary-row"><span>Service Charge</span><span>₹{displayBill.service_charge.toFixed(0)}</span></div>}
                    {displayBill.discount > 0 && <div className="summary-row" style={{ color: '#22C55E' }}><span>Discount</span><span>-₹{displayBill.discount.toFixed(0)}</span></div>}
                    <div className="summary-row total"><span>Total Payable</span><span>₹{displayBill.total.toFixed(0)}</span></div>
                </div>

                {displayBill.payment_status === 'completed' ? (
                    <div style={{ textAlign: 'center', marginTop: 24, padding: 16, background: '#F0FDF4', borderRadius: 12, color: '#15803D', fontWeight: 600 }}>
                        ✅ Payment Completed — {displayBill.payment_method === 'cash' ? 'Paid by Cash' : 'Paid Online'}
                    </div>
                ) : (
                    <div className="bill-payment-btns">
                        <button className="btn btn-dark" onClick={() => toast.success('Please pay at the counter', { icon: '💵' })}>
                            <Banknote size={18} /> Pay Cash
                        </button>
                        <button className="btn btn-primary" onClick={() => toast.success('Online payment coming soon!', { icon: '💳' })}>
                            <CreditCard size={18} /> Pay Online
                        </button>
                    </div>
                )}
            </div>

            <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 20 }}>
                Thank you for dining with us! 🙏
            </p>
        </div>
    );
}
