import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, UtensilsCrossed, Grid3X3, Receipt, Bell, LogOut, Menu, X, TrendingUp, ShoppingBag, DollarSign, Users, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
    { path: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/admin/orders', label: 'Live Orders', icon: <ClipboardList size={20} />, badge: 'pendingOrders' },
    { path: '/admin/assistance', label: 'Assistance', icon: <Users size={20} />, badge: 'waiterCalls' },
    { path: '/admin/menu', label: 'Menu Management', icon: <UtensilsCrossed size={20} /> },
    { path: '/admin/tables', label: 'Tables', icon: <Grid3X3 size={20} /> },
    { path: '/admin/billing', label: 'Billing', icon: <Receipt size={20} /> },
];

export default function AdminLayout({ children, title }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pendingOrders, setPendingOrders] = useState(0);
    const [waiterCalls, setWaiterCalls] = useState(0);
    const [unreadNotifs, setUnreadNotifs] = useState(0);
    const { user, logout } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        api.getOrders({ status: 'placed' }).then(orders => setPendingOrders(orders.length)).catch(() => { });
        api.getUnreadCount().then(d => setUnreadNotifs(d.count)).catch(() => { });
        api.getActiveWaiterCalls().then(calls => setWaiterCalls(calls.length)).catch(() => { });
    }, [location.pathname]);

    useEffect(() => {
        if (!socket) return;
        socket.emit('join-admin');
        const handleNewOrder = (order) => {
            setPendingOrders(prev => prev + 1);
            setUnreadNotifs(prev => prev + 1);
            toast.success(`New order from Table ${order.table_number}!`, { icon: '🔔', duration: 5000 });
            try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZaYk4x+c2ZiYmVvfIyXn6Cbl4+DdWheV1picoGPmqChn5mOgnZqYWBkb36MmJ+gnZiMgHRoYGJncH+NmJ6enJaLf3RpZGRpcoKOmJ2dnJeNg3hyb3B1fIaTmZqZlpGKgnp1c3V6gYqUmZqYlY+Ig3p2dXh9hI2VmZiWko2Gf3l2eHt/ho+WmJeTjoeAfXp5fICHj5WXlZGMhYB8enl8gIaPk5WTj4qEf317fH6ChpCUlJKOiYOAfX5/goaLkJOSkIyHg4B+f4GEh4yQkpGOioWBf36AgoWIjJCRkI6Kh4OCgYKEhomMj5CPjYmGg4KBgoSGiYyOj42LiIWDgoKDhYeKjI6NjIqHhYODg4SFh4mLjI2MioiFg4ODhIWGiIqLjIuKiIaEg4OEhYaIiouLioqIhoSDg4SFhoeJiouLiomHhoWEhIWFhoeJiYuKiomHhoWEhIWGh4eIiYqKiYiHhoWFhIWGh4iJiYqJiYiHhoWFhYaGh4iJiYmJiIeGhoWFhYaHh4iJiYmIiIeGhoWFhoaHiIiJiYiIh4eGhYaGhoaHiIiIiIiHh4aGhYaGhoaHiIiIiIeHh4aGhoaGhoeHiIiIiIeHhoaGhoaGh4eHiIiHh4eHhoaGhoaGh4eIiIiHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaGh4eHh4eHh4eHhoaGhoaGh4eHh4eHh4eGhoaG').play().catch(() => { }); } catch (e) { }
        };
        const handleCallWaiter = (data) => {
            setWaiterCalls(prev => prev + 1);
            toast(`Table ${data.table_number} is calling for a waiter!`, { icon: '🆘', duration: 8000 });
            // Alert sound for waiter call
            try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZaYk4x+c2ZiYmVvfIyXn6Cbl4+DdWheV1picoGPmqChn5mOgnZqYWBkb36MmJ+gnZiMgHRoYGJncH+NmJ6enJaLf3RpZGRpcoKOmJ2dnJeNg3hyb3B1fIaTmZqZlpGKgnp1c3V6gYqUmZqYlY+Ig3p2dXh9hI2VmZiWko2Gf3l2eHt/ho+WmJeTjoeAfXp5fICHj5WXlZGMhYB8enl8gIaPk5WTj4qEf317fH6ChpCUlJKOiYOAfX5/goaLkJOSkIyHg4B+f4GEh4yQkpGOioWBf36AgoWIjJCRkI6Kh4OCgYKEhomMj5CPjYmGg4KBgoSGiYyOj42LiIWDgoKDhYeKjI6NjIqHhYODg4SFh4mLjI2MioiFg4ODhIWGiIqLjIuKiIaEg4OEhYaIiouLioqIhoSDg4SFhoeJiouLiomHhoWEhIWFhoeJiYuKiomHhoWEhIWGh4eIiYqKiYiHhoWFhIWGh4iJiYqJiYiHhoWFhYaGh4iJiYmJiIeGhoWFhYaHh4iJiYmIiIeGhoWFhoaHiIiJiYiIh4eGhYaGhoaHiIiIiIiHh4aGhYaGhoaHiIiIiIeHh4aGhoaGhoeHiIiIiIeHhoaGhoaGh4eHiIiHh4eHhoaGhoaGh4eIiIiHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaHh4eHh4eHh4eGhoaGhoaHh4eHh4eHh4eGhoaG').play().catch(() => { }); } catch (e) { }
        };
        const handleResolveWaiter = () => {
            // Re-fetch count for accuracy when calls are resolved
            api.getActiveWaiterCalls().then(calls => setWaiterCalls(calls.length)).catch(() => {
                setWaiterCalls(prev => Math.max(0, prev - 1));
            });
        };
        socket.on('new-order', handleNewOrder);
        socket.on('new-waiter-call', handleCallWaiter);
        socket.on('waiter-call-resolved', handleResolveWaiter);
        return () => {
            socket.off('new-order', handleNewOrder);
            socket.off('new-waiter-call', handleCallWaiter);
            socket.off('waiter-call-resolved', handleResolveWaiter);
        };
    }, [socket]);

    const handleLogout = () => { logout(); navigate('/admin/login'); };

    return (
        <div className="admin-layout">
            <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h1 className="brand">Dine<span>Flow</span></h1>
                    <p>Restaurant Dashboard</p>
                </div>
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.path}
                            className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                        >
                            {item.icon}
                            {item.label}
                            {item.badge === 'pendingOrders' && pendingOrders > 0 && <span className="link-badge">{pendingOrders}</span>}
                            {item.badge === 'waiterCalls' && waiterCalls > 0 && <span className="link-badge red">{waiterCalls}</span>}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">{user?.name?.[0] || 'A'}</div>
                        <div className="sidebar-user-info">
                            <div className="name">{user?.name || 'Admin'}</div>
                            <div className="role">{user?.role || 'admin'}</div>
                        </div>
                    </div>
                    <button className="btn btn-sm" style={{ width: '100%', marginTop: 12, color: '#EF4444', justifyContent: 'center' }} onClick={handleLogout}>
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                <header className="admin-topbar">
                    <div className="flex items-center gap-12">
                        <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <h1>{title}</h1>
                    </div>
                    <div className="admin-topbar-actions">
                        <button className="notification-btn" onClick={() => { api.markNotificationsRead(); setUnreadNotifs(0); }}>
                            <Bell size={20} />
                            {unreadNotifs > 0 && <span className="nav-badge">{unreadNotifs}</span>}
                        </button>
                    </div>
                </header>
                <div className="admin-content">{children}</div>
            </main>
        </div>
    );
}

// === Dashboard Page ===
export function DashboardContent() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const { socket } = useSocket();

    const fetchStats = () => {
        api.getStats().then(data => { setStats(data); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(() => { fetchStats(); }, []);
    useEffect(() => {
        if (!socket) return;
        socket.on('new-order', fetchStats);
        socket.on('order-status-changed', fetchStats);
        return () => { socket.off('new-order', fetchStats); socket.off('order-status-changed', fetchStats); };
    }, [socket]);

    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
    if (!stats) return <p>Failed to load stats</p>;

    return (
        <>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header"><span className="label">Today's Orders</span><div className="stat-icon blue"><ShoppingBag size={22} /></div></div>
                    <div className="stat-value">{stats.todayOrders}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header"><span className="label">Active Orders</span><div className="stat-icon orange"><Clock size={22} /></div></div>
                    <div className="stat-value">{stats.activeOrders}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header"><span className="label">Today's Revenue</span><div className="stat-icon green"><DollarSign size={22} /></div></div>
                    <div className="stat-value">₹{stats.todayRevenue.toFixed(0)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-header"><span className="label">Active Tables</span><div className="stat-icon lime"><Users size={22} /></div></div>
                    <div className="stat-value">{stats.occupiedTables}/{stats.totalTables}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="admin-card">
                    <div className="admin-card-header"><h3>🔥 Popular Items Today</h3></div>
                    <div className="admin-card-body">
                        {stats.popularItems.length === 0 && <p style={{ color: '#9CA3AF', fontSize: 14 }}>No orders yet today</p>}
                        {stats.popularItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E5E7EB' }}>
                                <div className="flex items-center gap-12">
                                    <span style={{ width: 28, height: 28, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                                    <span style={{ fontWeight: 500 }}>{item.item_name}</span>
                                </div>
                                <span style={{ fontSize: 13, color: '#9CA3AF' }}>{item.total_ordered} orders</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="admin-card">
                    <div className="admin-card-header"><h3>📋 Recent Orders</h3></div>
                    <div className="admin-card-body">
                        {stats.recentOrders.length === 0 && <p style={{ color: '#9CA3AF', fontSize: 14 }}>No orders yet</p>}
                        {stats.recentOrders.slice(0, 6).map((order, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E5E7EB' }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 14 }}>Table {order.table_number}</div>
                                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{new Date(order.created_at).toLocaleTimeString()}</div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <span>₹{order.total_amount.toFixed(0)}</span>
                                    <span className={`status-badge status-${order.status}`}>{order.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
