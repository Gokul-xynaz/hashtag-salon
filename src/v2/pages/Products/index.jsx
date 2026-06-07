import Layout from '../../components/Layout';
import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../../context/DataProvider';
import { doc, addDoc, collection, updateDoc, deleteDoc, serverTimestamp, runTransaction, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function V2Products() {
    const { products } = useData();
    const [activeTab, setActiveTab] = useState('inventory');
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [consumptionLogs, setConsumptionLogs] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({ name: '', category: 'general', price: '', stock: '', unit: 'ml', isRetail: false, v2_supplier: '', v2_costPrice: '', v2_lowStockAlert: 5 });
    const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', company: '' });
    const [manualLog, setManualLog] = useState({ productId: '', amount: '', reason: 'Manual Adjustment' });

    // Fetch consumption logs
    useEffect(() => {
        if (activeTab !== 'consumption') return;
        const q = query(collection(db, 'consumption_logs'), orderBy('timestamp', 'desc'), limit(100));
        const unsub = onSnapshot(q, snap => setConsumptionLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [activeTab]);

    // Fetch suppliers
    useEffect(() => {
        if (activeTab !== 'suppliers') return;
        const unsub = onSnapshot(collection(db, 'v2_suppliers'), snap => setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [activeTab]);

    const filteredProducts = useMemo(() => {
        let list = products || [];
        if (searchQuery) list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (filterType === 'retail') list = list.filter(p => p.isRetail);
        if (filterType === 'backbar') list = list.filter(p => !p.isRetail);
        if (filterType === 'lowstock') list = list.filter(p => (p.stock || 0) <= (p.v2_lowStockAlert || 5));
        return list;
    }, [products, searchQuery, filterType]);

    const lowStockCount = useMemo(() => (products || []).filter(p => (p.stock || 0) <= (p.v2_lowStockAlert || 5)).length, [products]);
    const totalValue = useMemo(() => (products || []).reduce((s, p) => s + ((p.price || 0) * (p.stock || 0)), 0), [products]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const data = { name: formData.name, category: formData.category, price: parseFloat(formData.price) || 0, stock: parseInt(formData.stock) || 0, unit: formData.unit, isRetail: formData.isRetail, v2_supplier: formData.v2_supplier, v2_costPrice: parseFloat(formData.v2_costPrice) || 0, v2_lowStockAlert: parseInt(formData.v2_lowStockAlert) || 5, updatedAt: serverTimestamp() };
            if (editingProduct) { await updateDoc(doc(db, 'products', editingProduct.id), data); }
            else { data.createdAt = serverTimestamp(); await addDoc(collection(db, 'products'), data); }
            resetForm();
        } catch (err) { alert(err.message); }
        finally { setIsSaving(false); }
    };

    const handleDelete = async (id) => { if (window.confirm("Delete this product?")) await deleteDoc(doc(db, 'products', id)); };

    const handleManualLog = async (e) => {
        e.preventDefault();
        if (!manualLog.productId || !manualLog.amount) return;
        setIsSaving(true);
        try {
            const product = products.find(p => p.id === manualLog.productId);
            const amt = parseFloat(manualLog.amount);
            await runTransaction(db, async (tx) => {
                const ref = doc(db, 'products', product.id);
                const snap = await tx.get(ref);
                const cur = parseFloat(snap.data().stock || 0);
                if (cur < amt) throw new Error(`Only ${cur} ${product.unit} available.`);
                tx.update(ref, { stock: cur - amt });
                tx.set(doc(collection(db, 'consumption_logs')), { productId: product.id, productName: product.name, amount: amt, unit: product.unit, reason: manualLog.reason, loggedBy: 'Admin', timestamp: serverTimestamp() });
            });
            setManualLog({ productId: '', amount: '', reason: 'Manual Adjustment' });
        } catch (err) { alert(err.message); }
        finally { setIsSaving(false); }
    };

    const handleAddSupplier = async (e) => {
        e.preventDefault();
        await addDoc(collection(db, 'v2_suppliers'), { ...supplierForm, createdAt: serverTimestamp() });
        setSupplierForm({ name: '', phone: '', email: '', company: '' });
    };

    const resetForm = () => { setEditingProduct(null); setShowForm(false); setFormData({ name: '', category: 'general', price: '', stock: '', unit: 'ml', isRetail: false, v2_supplier: '', v2_costPrice: '', v2_lowStockAlert: 5 }); };

    const editProduct = (p) => { setEditingProduct(p); setFormData({ ...p, v2_supplier: p.v2_supplier || '', v2_costPrice: p.v2_costPrice || '', v2_lowStockAlert: p.v2_lowStockAlert || 5 }); setShowForm(true); };

    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v || 0);

    return (
        <Layout>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="v2-card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Total Products</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{products?.length || 0}</div>
                </div>
                <div className="v2-card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Stock Value</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--v2-primary)' }}>{fmt(totalValue)}</div>
                </div>
                <div className="v2-card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Retail Items</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{(products || []).filter(p => p.isRetail).length}</div>
                </div>
                <div className="v2-card" style={{ padding: '1rem 1.25rem', border: lowStockCount > 0 ? '1px solid #fca5a5' : undefined }}>
                    <div style={{ fontSize: '0.7rem', color: lowStockCount > 0 ? '#dc2626' : 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Low Stock ⚠</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: lowStockCount > 0 ? '#dc2626' : 'var(--v2-text-main)' }}>{lowStockCount}</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {['inventory', 'consumption', 'suppliers'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.5rem 1.25rem', borderRadius: 'var(--v2-radius-full)', border: 'none', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', background: activeTab === tab ? 'var(--v2-primary)' : 'white', color: activeTab === tab ? 'white' : 'var(--v2-text-muted)', boxShadow: activeTab === tab ? 'none' : 'var(--v2-shadow-sm)' }}>
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'inventory' && (
                <div className="v2-card" style={{ padding: 0 }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['all', 'retail', 'backbar', 'lowstock'].map(f => (
                                <button key={f} onClick={() => setFilterType(f)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: 'var(--v2-radius-full)', border: filterType === f ? 'none' : '1px solid var(--v2-border)', background: filterType === f ? 'var(--v2-sidebar-bg)' : 'transparent', color: filterType === f ? 'white' : 'var(--v2-text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}>{f === 'lowstock' ? 'Low Stock' : f}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-full)', outline: 'none' }} />
                            <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontWeight: '600' }}>{showForm ? 'Cancel' : '+ Add Product'}</button>
                        </div>
                    </div>

                    {showForm && (
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)' }}>
                            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                                <div><label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Name</label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} /></div>
                                <div><label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Retail Price (₹)</label><input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} /></div>
                                <div><label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Stock</label><input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} /></div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} style={{ padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)' }}><option value="ml">ml</option><option value="grm">grm</option><option value="pcs">pcs</option></select>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}><input type="checkbox" checked={formData.isRetail} onChange={e => setFormData({ ...formData, isRetail: e.target.checked })} /> Retail</label>
                                    <button type="submit" disabled={isSaving} style={{ padding: '0.6rem 1rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontWeight: '700' }}>{isSaving ? '...' : editingProduct ? 'Update' : 'Add'}</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: '1px solid var(--v2-border)', fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>
                            <th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Product</th><th style={{ padding: '1rem', textAlign: 'left' }}>Stock</th><th style={{ padding: '1rem', textAlign: 'left' }}>Price</th><th style={{ padding: '1rem', textAlign: 'center' }}>Type</th><th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
                        </tr></thead>
                        <tbody>
                            {filteredProducts.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--v2-border)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}><div style={{ fontWeight: '600' }}>{p.name}</div><div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)' }}>{p.category}</div></td>
                                    <td style={{ padding: '1rem' }}><span style={{ fontWeight: '800', color: (p.stock || 0) <= (p.v2_lowStockAlert || 5) ? '#dc2626' : '#10b981' }}>{p.stock || 0}</span> <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{p.unit}</span></td>
                                    <td style={{ padding: '1rem', fontWeight: '700' }}>{fmt(p.price)}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}><span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700', background: p.isRetail ? '#dbeafe' : '#f3f4f6', color: p.isRetail ? '#1e3a8a' : '#4b5563' }}>{p.isRetail ? 'RETAIL' : 'BACKBAR'}</span></td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                        <button onClick={() => editProduct(p)} style={{ border: 'none', background: 'transparent', color: 'var(--v2-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', marginRight: '0.75rem' }}>Edit</button>
                                        <button onClick={() => handleDelete(p.id)} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem' }}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'consumption' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                    <div className="v2-card">
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Manual Adjustment</h3>
                        <form onSubmit={handleManualLog} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <select value={manualLog.productId} onChange={e => setManualLog({ ...manualLog, productId: e.target.value })} required style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }}>
                                <option value="">Select Product</option>
                                {(products || []).map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>)}
                            </select>
                            <input type="number" step="0.1" placeholder="Amount" value={manualLog.amount} onChange={e => setManualLog({ ...manualLog, amount: e.target.value })} required style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} />
                            <input type="text" placeholder="Reason" value={manualLog.reason} onChange={e => setManualLog({ ...manualLog, reason: e.target.value })} required style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} />
                            <button type="submit" disabled={isSaving} style={{ padding: '0.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontWeight: '700' }}>{isSaving ? 'Processing...' : 'Deduct Stock & Log'}</button>
                        </form>
                    </div>
                    <div className="v2-card" style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid var(--v2-border)', fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Time</th><th style={{ padding: '1rem', textAlign: 'left' }}>Product</th><th style={{ padding: '1rem', textAlign: 'left' }}>Amount</th><th style={{ padding: '1rem', textAlign: 'left' }}>Reason</th>
                            </tr></thead>
                            <tbody>
                                {consumptionLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--v2-border)', fontSize: '0.875rem' }}>
                                        <td style={{ padding: '0.75rem 1.5rem' }}>{log.timestamp?.toDate?.()?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) || '—'}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{log.productName}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: '#dc2626', fontWeight: '800' }}>-{log.amount} {log.unit}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--v2-text-muted)' }}>{log.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'suppliers' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                    <div className="v2-card">
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Add Supplier</h3>
                        <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input type="text" placeholder="Supplier Name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} required style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} />
                            <input type="text" placeholder="Company" value={supplierForm.company} onChange={e => setSupplierForm({ ...supplierForm, company: e.target.value })} style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} />
                            <input type="tel" placeholder="Phone" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} />
                            <input type="email" placeholder="Email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', outline: 'none' }} />
                            <button type="submit" style={{ padding: '0.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontWeight: '700' }}>Add Supplier</button>
                        </form>
                    </div>
                    <div className="v2-card" style={{ padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid var(--v2-border)', fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left' }}>Name</th><th style={{ padding: '1rem', textAlign: 'left' }}>Company</th><th style={{ padding: '1rem', textAlign: 'left' }}>Phone</th><th style={{ padding: '1rem', textAlign: 'left' }}>Email</th>
                            </tr></thead>
                            <tbody>
                                {suppliers.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--v2-border)', fontSize: '0.875rem' }}>
                                        <td style={{ padding: '0.75rem 1.5rem', fontWeight: '600' }}>{s.name}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{s.company || '—'}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>{s.phone || '—'}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--v2-text-muted)' }}>{s.email || '—'}</td>
                                    </tr>
                                ))}
                                {suppliers.length === 0 && <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No suppliers added yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Layout>
    );
}
