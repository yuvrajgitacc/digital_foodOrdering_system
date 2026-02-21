import { useState, useEffect, useCallback } from 'react';
import { Receipt, CreditCard, Banknote, FileText, X, RefreshCw } from 'lucide-react';
import AdminLayout from './AdminDashboard';
import { api } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

export default function AdminBilling() {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);
    const [bill, setBill] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [serviceCharge, setServiceCharge] = useState(0);
    const [discount, setDiscount] = useState(0);
    const { socket } = useSocket();

    const loadTables = useCallback(() => {
        api.getTables().then(data => {
            // Only show tables that are currently occupied or have active (in-progress) orders
            setTables(data.filter(t => t.status === 'occupied' || t.active_orders > 0));
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        loadTables();
    }, [loadTables]);

    // Refresh table list when orders or tables change
    useEffect(() => {
        if (!socket) return;
        const refresh = () => loadTables();
        socket.on('order-updated', refresh);
        socket.on('new-order', refresh);
        socket.on('table-updated', refresh);
        return () => {
            socket.off('order-updated', refresh);
            socket.off('new-order', refresh);
            socket.off('table-updated', refresh);
        };
    }, [socket, loadTables]);

    const generateBill = async (tableId) => {
        setGenerating(true);
        try {
            const billData = await api.generateBill(tableId, { service_charge: serviceCharge, discount });
            setBill(billData);
            toast.success('Bill generated!');
        } catch (err) {
            toast.error(err.message);
        }
        setGenerating(false);
    };

    const markPaid = async (billId, method) => {
        try {
            await api.markBillPaid(billId, method);
            toast.success(`Payment marked as ${method}`);
            setBill(prev => ({ ...prev, payment_status: 'completed', payment_method: method }));
            loadTables();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleTableClick = async (table) => {
        setSelectedTable(table.id);
        setBill(null);
        try {
            const bills = await api.getTableBills(table.id);
            const pendingBill = bills.find(b => b.payment_status !== 'completed');
            if (pendingBill) {
                setBill(pendingBill);
            }
        } catch (err) {
            // No existing bills, that's fine
        }
    };

    return (
        <AdminLayout title="Billing">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
                {/* Table Selection */}
                <div>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Select Table</h3>
                            <button className="modal-close" onClick={loadTables} title="Refresh">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <div className="admin-card-body">
                            {loading ? <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner"></div></div> : (
                                tables.length === 0 ? (
                                    <div className="empty-state" style={{ padding: 30 }}>
                                        <div className="empty-icon">🍽️</div>
                                        <h3>No active tables</h3>
                                        <p>Tables with orders will appear here</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                        {tables.map(table => (
                                            <button
                                                key={table.id}
                                                onClick={() => handleTableClick(table)}
                                                style={{
                                                    padding: 16, border: `2px solid ${selectedTable === table.id ? '#C5F82A' : '#E5E7EB'}`,
                                                    borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                                                    background: selectedTable === table.id ? 'rgba(197,248,42,0.1)' : '#fff',
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                <div style={{ fontSize: 20, fontWeight: 700 }}>#{table.table_number}</div>
                                                <div style={{ fontSize: 12, color: table.active_orders > 0 ? '#F59E0B' : '#9CA3AF' }}>
                                                    {table.active_orders} order{table.active_orders !== 1 ? 's' : ''}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {selectedTable && !bill && (
                        <div className="admin-card" style={{ marginTop: 20 }}>
                            <div className="admin-card-header"><h3>Bill Options</h3></div>
                            <div className="admin-card-body">
                                <div className="input-group" style={{ marginBottom: 12 }}>
                                    <label>Service Charge (₹)</label>
                                    <input className="input" type="number" value={serviceCharge} onChange={e => setServiceCharge(parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="input-group" style={{ marginBottom: 16 }}>
                                    <label>Discount (₹)</label>
                                    <input className="input" type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} />
                                </div>
                                <button className="btn btn-primary w-full" onClick={() => generateBill(selectedTable)} disabled={generating}>
                                    <Receipt size={18} /> {generating ? 'Generating...' : 'Generate Bill'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bill Display */}
                <div>
                    {bill ? (
                        <div className="admin-card">
                            <div className="admin-card-header">
                                <h3><FileText size={20} style={{ display: 'inline', marginRight: 8 }} />Bill #{bill.bill_number}</h3>
                                <button className="modal-close" onClick={() => { setBill(null); setSelectedTable(null); }}><X size={18} /></button>
                            </div>
                            <div className="admin-card-body">
                                <div style={{ textAlign: 'center', padding: '16px 0', borderBottom: '2px dashed #E5E7EB', marginBottom: 16 }}>
                                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24 }}>DineFlow</h2>
                                    <p style={{ color: '#9CA3AF', fontSize: 13 }}>Table {bill.table_number} • {new Date(bill.created_at).toLocaleString()}</p>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                                            <th style={{ textAlign: 'left', padding: 8, fontSize: 13, color: '#6B7280' }}>Item</th>
                                            <th style={{ textAlign: 'center', padding: 8, fontSize: 13, color: '#6B7280' }}>Qty</th>
                                            <th style={{ textAlign: 'right', padding: 8, fontSize: 13, color: '#6B7280' }}>Price</th>
                                            <th style={{ textAlign: 'right', padding: 8, fontSize: 13, color: '#6B7280' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bill.items?.map((item, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                                <td style={{ padding: 10, fontSize: 14 }}>{item.item_name}</td>
                                                <td style={{ padding: 10, fontSize: 14, textAlign: 'center' }}>{item.quantity}</td>
                                                <td style={{ padding: 10, fontSize: 14, textAlign: 'right' }}>₹{item.price.toFixed(0)}</td>
                                                <td style={{ padding: 10, fontSize: 14, textAlign: 'right', fontWeight: 600 }}>₹{item.total.toFixed(0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: 12 }}>
                                    <div className="summary-row"><span>Subtotal</span><span>₹{bill.subtotal.toFixed(0)}</span></div>
                                    <div className="summary-row"><span>GST ({bill.tax_percent}%)</span><span>₹{bill.tax_amount.toFixed(0)}</span></div>
                                    {bill.service_charge > 0 && <div className="summary-row"><span>Service Charge</span><span>₹{bill.service_charge.toFixed(0)}</span></div>}
                                    {bill.discount > 0 && <div className="summary-row" style={{ color: '#22C55E' }}><span>Discount</span><span>-₹{bill.discount.toFixed(0)}</span></div>}
                                    <div className="summary-row total"><span>Total</span><span>₹{bill.total.toFixed(0)}</span></div>
                                </div>

                                {bill.payment_status === 'completed' ? (
                                    <div style={{ textAlign: 'center', marginTop: 20, padding: 14, background: '#F0FDF4', borderRadius: 12, color: '#15803D', fontWeight: 600 }}>
                                        ✅ Paid — {bill.payment_method === 'cash' ? 'Cash' : 'Online'}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                                        <button className="btn btn-dark w-full" onClick={() => markPaid(bill.id, 'cash')}>
                                            <Banknote size={18} /> Cash
                                        </button>
                                        <button className="btn btn-primary w-full" onClick={() => markPaid(bill.id, 'online')}>
                                            <CreditCard size={18} /> Online
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="admin-card">
                            <div className="admin-card-body">
                                <div className="empty-state">
                                    <div className="empty-icon"><Receipt size={48} /></div>
                                    <h3>Select a table to generate bill</h3>
                                    <p>Choose an occupied table from the left panel</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

