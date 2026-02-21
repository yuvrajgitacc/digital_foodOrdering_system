import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/admin');
        } catch (err) {
            setError(err.message || 'Invalid credentials');
        }
        setLoading(false);
    };

    return (
        <div className="admin-login-page">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <UtensilsCrossed size={40} color="#C5F82A" strokeWidth={1.5} />
                </div>
                <h1 className="logo">Dine<span>Flow</span></h1>
                <p className="login-subtitle">Staff & Admin Dashboard</p>

                {error && <div className="login-error">{error}</div>}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Username</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                            <input
                                className="input input-dark"
                                style={{ paddingLeft: 40 }}
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                            <input
                                className="input input-dark"
                                style={{ paddingLeft: 40 }}
                                placeholder="Enter password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, marginTop: 24 }}>
                    Default: admin / admin123
                </p>
            </div>
        </div>
    );
}
