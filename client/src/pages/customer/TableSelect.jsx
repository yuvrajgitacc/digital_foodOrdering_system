import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { api } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';

export default function TableSelect() {
    const [tables, setTables] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { tableNumber } = useParams();
    const { setTable } = useCart();

    useEffect(() => {
        api.getTables().then(data => {
            setTables(data);
            if (tableNumber) {
                const t = data.find(t => t.table_number === parseInt(tableNumber));
                if (t) {
                    setSelected(t);
                    setTable(t.id, t.table_number);
                    // Mark table as occupied in backend
                    api.checkinTable(t.id).catch(() => { });
                    navigate('/menu');
                }
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [tableNumber]);

    const handleStart = () => {
        if (!selected) return toast.error('Please select a table');
        setTable(selected.id, selected.table_number);
        // Mark table as occupied in backend
        api.checkinTable(selected.id).catch(() => { });
        toast.success(`Table ${selected.table_number} selected!`);
        navigate('/menu');
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
                {tables.map((table, i) => (
                    <button
                        key={table.id}
                        className={`table-btn ${selected?.id === table.id ? 'selected' : ''} ${table.status === 'occupied' && !selected ? '' : ''}`}
                        style={{ '--i': i }}
                        onClick={() => setSelected(table)}
                    >
                        {table.table_number}
                        <span>{table.capacity} seats</span>
                    </button>
                ))}
            </div>

            <button className="btn btn-primary btn-lg w-full" style={{ maxWidth: 340 }} onClick={handleStart} disabled={!selected}>
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
