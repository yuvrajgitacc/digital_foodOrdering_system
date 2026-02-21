import { useState, useEffect } from 'react';
import AdminLayout from './AdminDashboard';
import { api } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import { UserCheck, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminAssistance() {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const { socket } = useSocket();

    const fetchCalls = () => {
        api.getActiveWaiterCalls().then(data => {
            setCalls(data);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchCalls();
    }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on('new-waiter-call', (call) => {
            setCalls(prev => [...prev, call]);
        });
        socket.on('waiter-call-resolved', (data) => {
            if (data.id) {
                setCalls(prev => prev.filter(c => c.id !== data.id));
            } else if (data.tableId) {
                setCalls(prev => prev.filter(c => c.table_id !== data.tableId));
            }
        });
        return () => {
            socket.off('new-waiter-call');
            socket.off('waiter-call-resolved');
        };
    }, [socket]);

    const resolveCall = async (id) => {
        try {
            await api.resolveWaiterCall(id);
            toast.success('Assistance marked as resolved');
        } catch (err) {
            toast.error('Failed to resolve');
        }
    };

    return (
        <AdminLayout title="Assistance Requests">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Active Requests</h3>
                </div>
                <div className="admin-card-body">
                    {loading ? (
                        <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner"></div></div>
                    ) : calls.length === 0 ? (
                        <div className="empty-state" style={{ padding: '60px 0' }}>
                            <div className="empty-icon"><CheckCircle2 size={48} color="#22C55E" /></div>
                            <h3>All good!</h3>
                            <p>No tables currently need assistance.</p>
                        </div>
                    ) : (
                        <div className="waiter-calls-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                            {calls.map(call => (
                                <div key={call.id} className="waiter-call-card" style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FCA5A5',
                                    borderRadius: 16,
                                    padding: 20,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 16
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Table #{call.table_number}</h4>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#991B1B', fontSize: 13, marginTop: 4 }}>
                                                <Clock size={14} />
                                                Requested {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div style={{ background: '#EF4444', color: '#fff', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                                            Urgent
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-dark w-full"
                                        onClick={() => resolveCall(call.id)}
                                        style={{ background: '#111827', color: '#fff' }}
                                    >
                                        <UserCheck size={18} /> Mark as Resolved
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
