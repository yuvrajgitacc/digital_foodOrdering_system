import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Minus, Plus, Check, Clock, Flame, Heart } from 'lucide-react';
import { api } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';

export default function ItemDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addItem, totalItems } = useCart();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [selectedAddons, setSelectedAddons] = useState([]);
    const [imgLoaded, setImgLoaded] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        api.getMenuItem(id)
            .then(data => { setItem(data); setLoading(false); })
            .catch(() => { toast.error('Item not found'); navigate('/menu'); });
    }, [id]);

    const toggleAddon = (addon) => {
        setSelectedAddons(prev =>
            prev.find(a => a.id === addon.id)
                ? prev.filter(a => a.id !== addon.id)
                : [...prev, addon]
        );
    };

    const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = item ? (item.price + addonTotal) * quantity : 0;

    const handleAddToCart = () => {
        addItem({
            menu_item_id: item.id,
            name: item.name,
            price: item.price + addonTotal,
            image: item.image,
            is_veg: item.is_veg,
            selectedAddons: selectedAddons.map(a => a.id),
            addons: selectedAddons.map(a => a.name),
            quantity,
        });
        toast.success(`${item.name} added to cart!`, { icon: '✅' });
        navigate('/menu');
    };

    const ingredients = item?.ingredients ? item.ingredients.split(',').map(i => i.trim()) : [];

    if (loading) return (
        <div className="customer-app">
            <div className="loading-screen"><div className="spinner"></div></div>
        </div>
    );

    if (!item) return null;

    return (
        <div className="customer-app detail-page">
            {/* Hero Image Section */}
            <div className="detail-hero">
                <img
                    src={item.image || ''}
                    alt={item.name}
                    className={`detail-hero-img ${imgLoaded ? 'loaded' : ''}`}
                    onLoad={() => setImgLoaded(true)}
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.querySelector('.detail-hero-fallback').style.display = 'flex';
                    }}
                />
                <div className="detail-hero-fallback" style={{ display: 'none' }}>
                    <span>{item.category_icon || '🍽️'}</span>
                </div>
                <div className="detail-hero-gradient"></div>

                {/* Floating nav buttons */}
                <button className="detail-nav-btn detail-back" onClick={() => navigate('/menu')}>
                    <ArrowLeft size={20} />
                </button>
                <button className="detail-nav-btn detail-cart" onClick={() => navigate('/cart')}>
                    <ShoppingCart size={18} />
                    {totalItems > 0 && <span className="detail-cart-badge">{totalItems}</span>}
                </button>
            </div>

            {/* Content Card slides up over the image */}
            <div className="detail-content-card" ref={contentRef}>
                {/* Veg/Non-veg + Spice Tags */}
                <div className="detail-tags-row">
                    <div className={`detail-veg-badge ${item.is_veg ? '' : 'nonveg'}`}>
                        <span></span>
                        {item.is_veg ? 'Veg' : 'Non-Veg'}
                    </div>
                    {item.prep_time && (
                        <div className="detail-meta-tag">
                            <Clock size={12} /> {item.prep_time} min
                        </div>
                    )}
                    {item.spice_level > 0 && (
                        <div className="detail-meta-tag spice">
                            <Flame size={12} /> {item.spice_level === 1 ? 'Mild' : item.spice_level === 2 ? 'Medium' : 'Hot'}
                        </div>
                    )}
                </div>

                {/* Title + Price */}
                <h1 className="detail-title">{item.name}</h1>
                <div className="detail-price-row">
                    <span className="detail-price">₹{item.price}</span>
                    {item.is_bestseller && (
                        <span className="detail-bestseller">⭐ Bestseller</span>
                    )}
                </div>

                {/* Description */}
                <p className="detail-description">{item.description}</p>

                {/* Divider */}
                <div className="detail-divider"></div>

                {/* Spice Level Visual */}
                {item.spice_level > 0 && (
                    <div className="detail-section">
                        <h3 className="detail-section-title">Spice Level</h3>
                        <div className="detail-spice-bar">
                            {[1, 2, 3].map(level => (
                                <div
                                    key={level}
                                    className={`spice-level-dot ${level <= item.spice_level ? 'active' : ''}`}
                                >
                                    🌶️
                                </div>
                            ))}
                            <span className="spice-label">
                                {item.spice_level === 1 ? 'Mild' : item.spice_level === 2 ? 'Medium' : 'Hot'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Ingredients */}
                {ingredients.length > 0 && (
                    <div className="detail-section">
                        <h3 className="detail-section-title">Ingredients</h3>
                        <div className="detail-ingredients">
                            {ingredients.map((ing, i) => (
                                <span key={i} className="detail-ingredient-chip">{ing}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Extras / Add-ons */}
                {item.addons && item.addons.length > 0 && (
                    <div className="detail-section">
                        <h3 className="detail-section-title">Extras</h3>
                        <div className="detail-extras-grid">
                            {item.addons.map(addon => {
                                const isSelected = selectedAddons.find(a => a.id === addon.id);
                                return (
                                    <div
                                        key={addon.id}
                                        className={`detail-extra-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleAddon(addon)}
                                    >
                                        <div className="extra-card-top">
                                            <span className="extra-name">{addon.name}</span>
                                            {isSelected && (
                                                <div className="extra-check"><Check size={12} /></div>
                                            )}
                                        </div>
                                        <span className="extra-price">+₹{addon.price}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Spacer for bottom bar */}
                <div style={{ height: 100 }}></div>
            </div>

            {/* Fixed Bottom Action Bar */}
            <div className="detail-bottom-bar">
                <div className="detail-qty-control">
                    <button
                        className="qty-btn"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                        <Minus size={16} />
                    </button>
                    <span className="qty-value">{quantity}</span>
                    <button
                        className="qty-btn"
                        onClick={() => setQuantity(quantity + 1)}
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <button className="detail-add-cart-btn" onClick={handleAddToCart}>
                    <span className="add-cart-label">Add to Cart</span>
                    <span className="add-cart-price">₹{totalPrice.toFixed(0)}</span>
                </button>
            </div>
        </div>
    );
}
