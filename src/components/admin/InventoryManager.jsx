import { useState, useEffect } from 'react';
import { useData } from '../../context/DataProvider';
import { doc, addDoc, collection, updateDoc, deleteDoc, serverTimestamp, query, orderBy, limit, onSnapshot, increment, runTransaction } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function InventoryManager() {
    const { products, loadingServices } = useData();
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'general',
        price: '',
        stock: '',
        unit: 'ml',
        isRetail: false
    });
    // Removed Consumption Log Logic

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const productData = {
                name: formData.name,
                category: formData.category,
                price: parseFloat(formData.price) || 0,
                stock: parseInt(formData.stock) || 0,
                unit: formData.unit,
                isRetail: formData.isRetail,
                updatedAt: serverTimestamp()
            };

            if (editingProduct) {
                await updateDoc(doc(db, 'products', editingProduct.id), productData);
            } else {
                productData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'products'), productData);
            }

            resetForm();
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Failed to save product.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this product?")) {
            try {
                await deleteDoc(doc(db, 'products', id));
            } catch (error) {
                console.error("Error deleting product:", error);
                alert("Failed to delete product.");
            }
        }
    };

    const resetForm = () => {
        setEditingProduct(null);
        setFormData({
            name: '',
            category: 'general',
            price: '',
            stock: '',
            unit: 'ml',
            isRetail: false
        });
    };

    const handleEditClick = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name || '',
            category: product.category || 'general',
            price: product.price || '',
            stock: product.stock || '',
            unit: product.unit || 'ml',
            isRetail: product.isRetail || false
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loadingServices) return <div className="container" style={{ padding: '2rem' }}>Loading Inventory...</div>;

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', letterSpacing: '0.1em' }}>Inventory & Stock</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Inventory & Stock Management</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
                {/* Add/Edit Form */}
                <div className="card" style={{ position: 'sticky', top: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.65rem' }}>PRODUCT NAME / BRAND</label>
                            <input type="text" className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>CATEGORY</label>
                                <input type="text" className="form-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>RETAIL PRICE (₹)</label>
                                <input type="number" className="form-input" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>STOCK AVAILABLE</label>
                                <input type="number" className="form-input" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>UNIT</label>
                                <select className="form-input" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                    <option value="ml">ml</option>
                                    <option value="grm">grm</option>
                                    <option value="pcs">pcs</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                            <input
                                type="checkbox"
                                id="isRetail"
                                checked={formData.isRetail}
                                onChange={e => setFormData({ ...formData, isRetail: e.target.checked })}
                                style={{ width: '1.2rem', height: '1.2rem' }}
                            />
                            <div>
                                <label htmlFor="isRetail" style={{ fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}>Available for Retail Billing</label>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>If checked, this product will appear in checkout step 4.</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button type="submit" className="btn-primary" style={{ flex: 1, height: '3rem' }}>
                                {editingProduct ? 'UPDATE PRODUCT' : 'ADD PRODUCT'}
                            </button>
                            {editingProduct && (
                                <button type="button" className="btn-secondary" onClick={resetForm} style={{ height: '3rem' }}>
                                    CANCEL
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Product List */}
                <div className="card">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                                    <th style={{ padding: '1rem 0.5rem' }}>PRODUCT DETAILS</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>STOCK</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>PRICE</th>
                                    <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>TYPE</th>
                                    <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(product => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{product.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{product.category?.toUpperCase() || 'GENERAL'}</div>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <div style={{
                                                fontWeight: '900',
                                                fontSize: '1rem',
                                                color: product.stock <= 5 ? 'var(--danger)' : 'var(--success)'
                                            }}>
                                                {product.stock || 0} <span style={{ fontSize: '0.7rem', fontWeight: '400', color: 'var(--text-secondary)' }}>{product.unit}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', fontWeight: '700' }}>
                                            {formatCurrency(product.price)}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                            {product.isRetail ? (
                                                <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1e3a8a', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '800' }}>RETAIL</span>
                                            ) : (
                                                <span style={{ fontSize: '0.65rem', background: '#f3f4f6', color: '#4b5563', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '800' }}>BACKBAR</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                                            <button onClick={() => handleEditClick(product)} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', margin: '0 0.5rem', fontWeight: '800', fontSize: '0.75rem' }}>EDIT</button>
                                            <button onClick={() => handleDelete(product.id)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontWeight: '800', fontSize: '0.75rem' }}>DELETE</button>
                                        </td>
                                    </tr>
                                ))}
                                {products.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No products in inventory.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

