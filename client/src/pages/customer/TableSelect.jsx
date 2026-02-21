import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UtensilsCrossed, Users } from 'lucide-react';
import { api } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { useSocket } from '../../context/SocketContext';
import toast from 'react-hot-toast';

export default function TableSelect() {
    const [tables, setTables] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { tableNumber } = useParams();
    const { setTable } = useCart();
    const { socket } = useSocket();

    const fetchTables = () => {
        api.getTables().then(data => {
            setTables(data);
            if (tableNumber) {
                const t = data.find(t => t.table_number === parseInt(tableNumber));
                if (t) {
                    if (t.status === 'occupied') {
                        toast.error(`Table ${t.table_number} is already occupied.`);
                        navigate('/', { replace: true }); // Redirect to home/selection
                    } else {
                        setSelected(t);
                        handleAutoCheckin(t);
                    }
                }
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    const handleAutoCheckin = async (table) => {
        try {
            setTable(table.id, table.table_number);
            await api.checkinTable(table.id);
            navigate('/menu');
        } catch (err) {
            toast.error(err.message || 'Failed to select table');
            setSelected(null);
        }
    };

    useEffect(() => {
        fetchTables();
        
        if (socket) {
            socket.on('table-updated', (updatedTable) => {
                setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
                if (selected?.id === updatedTable.id && updatedTable.status === 'occupied') {
                   // If our selected table becomes occupied by someone else
                   // We don't do anything yet, maybe show a warning on 'Start'
                }
            });
        }

        return () => {
            if (socket) socket.off('table-updated');
        };
    }, [tableNumber, socket]);

    const handleStart = async () => {
        if (!selected) return toast.error('Please select a table');
        if (selected.status === 'occupied') return toast.error('Table is already occupied');
        
        try {
            setTable(selected.id, selected.table_number);
            await api.checkinTable(selected.id);
            toast.success(`Table ${selected.table_number} selected!`);
            navigate('/menu');
        } catch (err) {
            toast.error(err.message || 'Failed to select table');
            // Refresh tables to get latest status
            fetchTables();
        }
    };

    if (loading) return (
        <div className="table-select-page">
            <div className="spinner"></div>
        </div>
    );

    return (
        <div className="table-select-page">
            <div style={{ marginBottom: 12 }}>
                <UtensilsCrossed size={48} color="#C5F82A" strokeWidth={1.5} />
            </div>
            <h1 className="logo">Dine<span>Flow</span></h1>
            <p className="subtitle">Select your table to start ordering</p>

            <div className="table-grid">
                {tables.map((table, i) => {
                    const isOccupied = table.status === 'occupied';
                    return (
                        <button
                            key={table.id}
                            className={`table-btn ${selected?.id === table.id ? 'selected' : ''} ${isOccupied ? 'occupied' : ''}`}
                            style={{ '--i': i }}
                            onClick={() => !isOccupied && setSelected(table)}
                            disabled={isOccupied}
                        >
                            {isOccupied && <div className="occupied-badge"><Users size={12} /> OCCUPIED</div>}
                            <div className="table-number">{table.table_number}</div>
                            <span className="capacity">{table.capacity} seats</span>
                        </button>
                    );
                })}
            </div>

            <button className="btn btn-primary btn-lg w-full" style={{ maxWidth: 340 }} onClick={handleStart} disabled={!selected || selected.status === 'occupied'}>
                <UtensilsCrossed size={20} />
                {selected ? `Start Ordering — Table ${selected.table_number}` : 'Select a Table'}
            </button>

            <div style={{ marginTop: 32 }}>
                <button
                    onClick={() => navigate('/admin/login')}
                    style={{ color: '#9CA3AF', fontSize: 13, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    Admin / Staff Login →
                </button>
            </div>
        </div>
    );
}
