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
    // Consumption Log State
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'consumption'
    const [consumptionLogs, setConsumptionLogs] = useState([]);
    const [manualLog, setManualLog] = useState({ productId: '', amount: '', reason: 'Manual Adjustment' });
    const [loggingConsumption, setLoggingConsumption] = useState(false);

    // Fetch Consumption Logs
    useEffect(() => {
        if (activeTab === 'consumption') {
            const q = query(collection(db, 'consumption_logs'), orderBy('timestamp', 'desc'), limit(100));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setConsumptionLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            return () => unsubscribe();
        }
    }, [activeTab]);

    const handleManualLog = async (e) => {
        e.preventDefault();
        if (!manualLog.productId || !manualLog.amount) return;

        setLoggingConsumption(true);
        try {
            const product = products.find(p => p.id === manualLog.productId);
            const amountNum = parseFloat(manualLog.amount);
            const productRef = doc(db, 'products', product.id);

            await runTransaction(db, async (transaction) => {
                const productDoc = await transaction.get(productRef);
                if (!productDoc.exists()) throw new Error("Product does not exist!");

                const currentStock = parseFloat(productDoc.data().stock || 0);
                if (currentStock < amountNum) {
                    throw new Error(`Insufficient stock! Only ${currentStock} ${product.unit} available.`);
                }

                // Deduct stock
                transaction.update(productRef, { stock: currentStock - amountNum });

                // Add Log
                const logRef = doc(collection(db, 'consumption_logs'));
                transaction.set(logRef, {
                    productId: product.id,
                    productName: product.name,
                    amount: amountNum,
                    unit: product.unit,
                    reason: manualLog.reason,
                    loggedBy: 'Admin',
                    timestamp: serverTimestamp()
                });
            });

            setManualLog({ productId: '', amount: '', reason: 'Manual Adjustment' });
            alert("Consumption logged and stock updated successfully.");
        } catch (error) {
            console.error("Error logging consumption:", error);
            alert(error.message || "Failed to log consumption.");
        } finally {
            setLoggingConsumption(false);
        }
    };

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

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={activeTab === 'inventory' ? 'btn-primary' : 'btn-outline'}
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', height: 'auto', border: activeTab === 'inventory' ? 'none' : '1px solid var(--border-color)' }}
                >
                    MASTER INVENTORY
                </button>
                <button
                    onClick={() => setActiveTab('consumption')}
                    className={activeTab === 'consumption' ? 'btn-primary' : 'btn-outline'}
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', height: 'auto', border: activeTab === 'consumption' ? 'none' : '1px solid var(--border-color)' }}
                >
                    CONSUMPTION LOG
                </button>
            </div>

            {activeTab === 'inventory' && (
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
            )}

            {activeTab === 'consumption' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>

                    {/* Manual Consumption Form */}
                    <div className="card" style={{ position: 'sticky', top: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            Manual Adjustment / Log
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Use this to record spillage, backbar refilling, or to sync physical stock with software stock. This will automatically deduct the amount from the global inventory.
                        </p>
                        <form onSubmit={handleManualLog} style={{ display: 'grid', gap: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>SELECT PRODUCT</label>
                                <select
                                    className="form-input"
                                    value={manualLog.productId}
                                    onChange={e => setManualLog({ ...manualLog, productId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Choose Product --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock} {p.unit})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>AMOUNT CONSUMED</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="form-input"
                                        value={manualLog.amount}
                                        onChange={e => setManualLog({ ...manualLog, amount: e.target.value })}
                                        required
                                        placeholder="e.g. 50"
                                    />
                                    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '800' }}>
                                        {manualLog.productId ? products.find(p => p.id === manualLog.productId)?.unit : 'unit'}
                                    </span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>REASON / NOTES</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={manualLog.reason}
                                    onChange={e => setManualLog({ ...manualLog, reason: e.target.value })}
                                    required
                                />
                            </div>

                            <button type="submit" className="btn-primary" disabled={loggingConsumption} style={{ height: '3.5rem' }}>
                                {loggingConsumption ? 'LOGGING...' : 'DEDUCT STOCK & LOG'}
                            </button>
                        </form>
                    </div>

                    {/* Consumption Log Table */}
                    <div className="card">
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                                        <th style={{ padding: '1rem 0.5rem' }}>TIMESTAMP</th>
                                        <th style={{ padding: '1rem 0.5rem' }}>PRODUCT</th>
                                        <th style={{ padding: '1rem 0.5rem' }}>USAGE / AMOUNT</th>
                                        <th style={{ padding: '1rem 0.5rem' }}>CONTEXT / REASON</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consumptionLogs.map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', fontSize: '0.85rem' }}>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                <div style={{ fontWeight: '700' }}>{log.timestamp ? log.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{log.timestamp ? log.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem', fontWeight: '800' }}>
                                                {log.productName}
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem' }}>
                                                <span style={{ fontWeight: '900', color: 'var(--danger)', fontSize: '1rem' }}>-{log.amount}</span> <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.unit}</span>
                                            </td>
                                            <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>
                                                {log.reason}
                                                {log.loggedBy && <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.7 }}>Logged by: {log.loggedBy}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                    {consumptionLogs.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No usage logs recorded yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
