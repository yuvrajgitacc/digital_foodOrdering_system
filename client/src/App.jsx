import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from './context/CartContext';
import { SocketProvider } from './context/SocketContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Customer pages
import TableSelect from './pages/customer/TableSelect';
import Menu from './pages/customer/Menu';
import ItemDetail from './pages/customer/ItemDetail';
import Cart from './pages/customer/Cart';
import OrderTracking from './pages/customer/OrderTracking';
import Bill from './pages/customer/Bill';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout, { DashboardContent } from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMenu from './pages/admin/AdminMenu';
import AdminTables from './pages/admin/AdminTables';
import AdminBilling from './pages/admin/AdminBilling';
import AdminAssistance from './pages/admin/AdminAssistance';

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
    if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
    return children;
}

export default function App() {
    return (
        <SocketProvider>
            <AuthProvider>
                <CartProvider>
                    <Toaster
                        position="top-center"
                        toastOptions={{
                            duration: 3000,
                            style: { background: '#1A1A1A', color: '#fff', borderRadius: '12px', fontSize: '14px' },
                            success: { iconTheme: { primary: '#C5F82A', secondary: '#1A1A1A' } },
                        }}
                    />
                    <Routes>
                        {/* Customer Routes */}
                        <Route path="/" element={<TableSelect />} />
                        <Route path="/table/:tableNumber" element={<TableSelect />} />
                        <Route path="/menu" element={<Menu />} />
                        <Route path="/menu/:id" element={<ItemDetail />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/order/:orderId" element={<OrderTracking />} />
                        <Route path="/bill" element={<Bill />} />

                        {/* Admin Routes */}
                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/admin" element={<ProtectedRoute><AdminLayout title="Dashboard"><DashboardContent /></AdminLayout></ProtectedRoute>} />
                        <Route path="/admin/orders" element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
                        <Route path="/admin/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />
                        <Route path="/admin/tables" element={<ProtectedRoute><AdminTables /></ProtectedRoute>} />
                        <Route path="/admin/billing" element={<ProtectedRoute><AdminBilling /></ProtectedRoute>} />
                        <Route path="/admin/assistance" element={<ProtectedRoute><AdminAssistance /></ProtectedRoute>} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </CartProvider>
            </AuthProvider>
        </SocketProvider>
    );
}
