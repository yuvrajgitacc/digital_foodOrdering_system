import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Upload, X, Search } from 'lucide-react';
import AdminLayout from './AdminDashboard';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function AdminMenu() {
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        Promise.all([api.getMenu(), api.getCategories()])
            .then(([m, c]) => { setItems(m); setCategories(c); setLoading(false); });
    };

    useEffect(() => { fetchData(); }, []);

    const filtered = items.filter(i => {
        if (filter !== 'all' && i.category_id !== parseInt(filter)) return false;
        if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const toggleAvailability = async (item) => {
        await api.toggleAvailability(item.id, !item.is_available);
        toast.success(item.is_available ? `${item.name} marked unavailable` : `${item.name} is now available`);
        fetchData();
    };

    const deleteItem = async (id) => {
        if (!confirm('Delete this item?')) return;
        await api.deleteMenuItem(id);
        toast.success('Item deleted');
        fetchData();
    };

    return (
        <AdminLayout title="Menu Management">
            <div className="flex items-center justify-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div className="flex items-center gap-12">
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                        <input className="input" style={{ paddingLeft: 36, width: 250 }} placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="input" style={{ width: 180 }} value={filter} onChange={e => setFilter(e.target.value)}>
                        <option value="all">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditingItem(null); setShowModal(true); }}>
                    <Plus size={18} /> Add New Dish
                </button>
            </div>

            {loading ? <div className="loading-screen"><div className="spinner"></div></div> : (
                <div className="menu-management-grid">
                    {filtered.map(item => (
                        <div key={item.id} className="menu-manage-card">
                            <div className="menu-manage-img">
                                <img src={item.image || ''} alt={item.name} onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<div class="img-fallback">${item.category_icon || '🍽️'}</div>`; }} />
                                <div style={{ position: 'absolute', top: 8, left: 8 }}>
                                    <div className={`veg-badge ${!item.is_veg ? 'non-veg' : ''}`} style={{ background: '#fff', padding: 2 }}></div>
                                </div>
                            </div>
                            <div className="menu-manage-body">
                                <h4>{item.name}</h4>
                                <p className="category">{item.category_icon} {item.category_name}</p>
                                <span className="price">₹{item.price}</span>
                            </div>
                            <div className="menu-manage-footer">
                                <div className="flex items-center gap-8">
                                    <button className="btn btn-sm btn-outline" onClick={() => { setEditingItem(item); setShowModal(true); }}><Edit2 size={14} /> Edit</button>
                                    <button className="btn btn-sm" style={{ color: '#EF4444' }} onClick={() => deleteItem(item.id)}><Trash2 size={14} /></button>
                                </div>
                                <div className={`availability-toggle ${item.is_available ? 'active' : ''}`} onClick={() => toggleAvailability(item)}></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && <MenuItemModal item={editingItem} categories={categories} onClose={() => setShowModal(false)} onSave={fetchData} />}
        </AdminLayout>
    );
}

function MenuItemModal({ item, categories, onClose, onSave }) {
    const [form, setForm] = useState({
        name: item?.name || '', description: item?.description || '', price: item?.price || '',
        category_id: item?.category_id || (categories[0]?.id || ''), is_veg: item?.is_veg ? 'true' : 'false',
        spice_level: item?.spice_level || 1, ingredients: item?.ingredients || '', prep_time: item?.prep_time || 15,
        is_available: item?.is_available !== undefined ? (item.is_available ? 'true' : 'false') : 'true',
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(item?.image || null);
    const [saving, setSaving] = useState(false);
    const [addons, setAddons] = useState(item?.addons || []);
    const [newAddon, setNewAddon] = useState({ name: '', price: '' });

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const addAddon = () => {
        if (!newAddon.name || !newAddon.price) return;
        setAddons(prev => [...prev, { name: newAddon.name, price: parseFloat(newAddon.price) }]);
        setNewAddon({ name: '', price: '' });
    };

    const removeAddon = (i) => setAddons(prev => prev.filter((_, idx) => idx !== i));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const formData = new FormData();
            Object.entries(form).forEach(([k, v]) => formData.append(k, v));
            if (imageFile) formData.append('image', imageFile);
            if (addons.length > 0) formData.append('addons', JSON.stringify(addons));

            if (item) await api.updateMenuItem(item.id, formData);
            else await api.createMenuItem(formData);

            toast.success(item ? 'Item updated!' : 'Item created!');
            onSave();
            onClose();
        } catch (err) {
            toast.error(err.message);
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                <div className="modal-header">
                    <h3>{item ? 'Edit Dish' : 'Add New Dish'}</h3>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="image-upload" onClick={() => document.getElementById('dish-image').click()}>
                            <input id="dish-image" type="file" accept="image/*" onChange={handleImageChange} />
                            {imagePreview ? (
                                <div className="preview"><img src={imagePreview} alt="Preview" /></div>
                            ) : (
                                <>
                                    <div className="upload-icon"><Upload size={36} /></div>
                                    <p>Click to upload dish image</p>
                                </>
                            )}
                        </div>

                        <div className="form-grid" style={{ marginTop: 20 }}>
                            <div className="input-group">
                                <label>Dish Name *</label>
                                <input className="input" value={form.name} onChange={e => handleChange('name', e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>Price (₹) *</label>
                                <input className="input" type="number" value={form.price} onChange={e => handleChange('price', e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label>Category *</label>
                                <select className="input" value={form.category_id} onChange={e => handleChange('category_id', e.target.value)}>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Type</label>
                                <select className="input" value={form.is_veg} onChange={e => handleChange('is_veg', e.target.value)}>
                                    <option value="true">🟢 Vegetarian</option>
                                    <option value="false">🔴 Non-Vegetarian</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Spice Level</label>
                                <select className="input" value={form.spice_level} onChange={e => handleChange('spice_level', e.target.value)}>
                                    <option value={0}>None</option>
                                    <option value={1}>🌶️ Mild</option>
                                    <option value={2}>🌶️🌶️ Medium</option>
                                    <option value={3}>🌶️🌶️🌶️ Hot</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Prep Time (mins)</label>
                                <input className="input" type="number" value={form.prep_time} onChange={e => handleChange('prep_time', e.target.value)} />
                            </div>
                            <div className="input-group full-width">
                                <label>Description</label>
                                <textarea className="input" value={form.description} onChange={e => handleChange('description', e.target.value)} />
                            </div>
                            <div className="input-group full-width">
                                <label>Ingredients (comma separated)</label>
                                <input className="input" value={form.ingredients} onChange={e => handleChange('ingredients', e.target.value)} placeholder="e.g. Chicken, Tomato, Cream" />
                            </div>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Add-ons</label>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <input className="input" placeholder="Name" value={newAddon.name} onChange={e => setNewAddon(p => ({ ...p, name: e.target.value }))} style={{ flex: 2 }} />
                                <input className="input" placeholder="Price" type="number" value={newAddon.price} onChange={e => setNewAddon(p => ({ ...p, price: e.target.value }))} style={{ flex: 1 }} />
                                <button type="button" className="btn btn-primary btn-sm" onClick={addAddon}><Plus size={16} /></button>
                            </div>
                            {addons.map((a, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F3F4F6', borderRadius: 8, marginTop: 8 }}>
                                    <span>{a.name} — ₹{a.price}</span>
                                    <button type="button" onClick={() => removeAddon(i)} style={{ color: '#EF4444' }}><X size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (item ? 'Update Dish' : 'Add Dish')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
