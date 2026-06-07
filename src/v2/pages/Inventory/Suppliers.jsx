import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { collection, addDoc, onSnapshot, getDocs, doc, runTransaction, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', company: '' });
    const [showForm, setShowForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Restock Modal State
    const [activeRestockSupplier, setActiveRestockSupplier] = useState(null);
    const [restockForm, setRestockForm] = useState({
        productId: '',
        qty: '',
        costPrice: '',
        paymentMode: 'Bank Transfer',
        notes: ''
    });
    const [isRestocking, setIsRestocking] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'v2_suppliers'), snap => {
            setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Fetch products when opening restock modal
    const loadProducts = async () => {
        try {
            const snap = await getDocs(collection(db, 'products'));
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error("Error loading products for restock:", err);
        }
    };

    const handleAddSupplier = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'v2_suppliers'), { ...supplierForm, createdAt: serverTimestamp() });
            setSupplierForm({ name: '', phone: '', email: '', company: '' });
            setShowForm(false);
            alert("Supplier added successfully!");
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        if (!restockForm.productId || !restockForm.qty || !restockForm.costPrice) {
            return alert("Please fill all required fields");
        }

        const qty = parseInt(restockForm.qty);
        const cost = parseFloat(restockForm.costPrice);
        if (qty <= 0 || cost < 0) {
            return alert("Invalid quantity or cost price");
        }

        setIsRestocking(true);
        try {
            const selectedProduct = products.find(p => p.id === restockForm.productId);
            const totalCost = qty * cost;

            await runTransaction(db, async (tx) => {
                const productRef = doc(db, 'products', selectedProduct.id);
                const productSnap = await tx.get(productRef);
                const currentStock = parseInt(productSnap.data().stock || 0);

                // 1. Increment Product Stock
                tx.update(productRef, { stock: currentStock + qty });

                // 2. Log in store expenses
                const expenseRef = doc(collection(db, 'expenses'));
                tx.set(expenseRef, {
                    amount: totalCost,
                    category: 'Inventory/Supplies',
                    paymentMode: restockForm.paymentMode,
                    description: `Restock: ${qty} ${selectedProduct.unit || 'pcs'} of ${selectedProduct.name} from ${activeRestockSupplier.name} (Company: ${activeRestockSupplier.company || 'N/A'}). ${restockForm.notes || ''}`,
                    timestamp: Timestamp.now(),
                    createdAt: serverTimestamp(),
                    type: 'store_expense'
                });

                // 3. Log in consumption/restock history
                const logRef = doc(collection(db, 'consumption_logs'));
                tx.set(logRef, {
                    productId: selectedProduct.id,
                    productName: selectedProduct.name,
                    amount: -qty, // Negative represents stocking in / increment
                    unit: selectedProduct.unit || 'pcs',
                    reason: `Restocked from Supplier: ${activeRestockSupplier.name}`,
                    loggedBy: 'Admin',
                    timestamp: serverTimestamp()
                });
            });

            alert(`Successfully stocked in ${qty} units and recorded ₹${totalCost} store expense!`);
            setActiveRestockSupplier(null);
            setRestockForm({ productId: '', qty: '', costPrice: '', paymentMode: 'Bank Transfer', notes: '' });
        } catch (err) {
            alert("Restocking failed: " + err.message);
        } finally {
            setIsRestocking(false);
        }
    };

    const filteredSuppliers = suppliers.filter(s => 
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.company?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Suppliers & Sourcing</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Manage inventory sourcing and restock purchases directly linked to store expenses.</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                    {showForm ? 'Cancel' : '+ Add Supplier'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 2fr' : '1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
                
                {showForm && (
                    <div className="v2-card" style={{ position: 'sticky', top: '20px' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: '800', borderBottom: '1px solid var(--v2-border)', paddingBottom: '0.75rem' }}>Supplier Details</h3>
                        <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Contact Name *</label>
                                <input type="text" placeholder="e.g. John Doe" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} required style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Company / Brand</label>
                                <input type="text" placeholder="e.g. L'Oreal Professional" value={supplierForm.company} onChange={e => setSupplierForm({ ...supplierForm, company: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Phone Number</label>
                                <input type="tel" placeholder="e.g. 9876543210" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Email Address</label>
                                <input type="email" placeholder="e.g. orders@company.com" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                            </div>
                            <button type="submit" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '800' }}>Save Supplier</button>
                        </form>
                    </div>
                )}

                <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--v2-border)', background: '#f8fafc' }}>
                        <input 
                            type="text" 
                            placeholder="Search suppliers by name or brand..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', maxWidth: '400px', padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }} 
                        />
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Supplier Name</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Company / Brand</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Contact Info</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading suppliers...</td></tr>
                            ) : filteredSuppliers.length === 0 ? (
                                <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No suppliers match your search.</td></tr>
                            ) : (
                                filteredSuppliers.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--v2-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--v2-text-main)' }}>{s.name}</td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            {s.company ? <span style={{ padding: '0.2rem 0.6rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>{s.company}</span> : '—'}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ fontWeight: '600' }}>{s.phone || 'No phone'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{s.email || 'No email'}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                            <button 
                                                onClick={() => {
                                                    setActiveRestockSupplier(s);
                                                    loadProducts();
                                                }}
                                                style={{ border: 'none', background: 'var(--v2-primary)', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem', padding: '6px 12px', borderRadius: '4px', marginRight: '0.5rem', boxShadow: '0 2px 4px rgba(13,148,136,0.2)' }}
                                            >
                                                📦 Stock In
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Restock Modal */}
            {activeRestockSupplier && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <form onSubmit={handleRestockSubmit} className="v2-card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--v2-border)', paddingBottom: '0.75rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>Stock In Inventory</h2>
                                <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>Supplier: <strong>{activeRestockSupplier.name}</strong> ({activeRestockSupplier.company || 'General'})</span>
                            </div>
                            <button type="button" onClick={() => setActiveRestockSupplier(null)} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--v2-text-muted)' }}>×</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Select Product *</label>
                                <select 
                                    required 
                                    value={restockForm.productId} 
                                    onChange={e => setRestockForm({...restockForm, productId: e.target.value})} 
                                    style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontWeight: '700' }}
                                >
                                    <option value="">-- Choose Product to Restock --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Current: {p.stock || 0} {p.unit || 'pcs'})</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Quantity *</label>
                                    <input 
                                        type="number" 
                                        required 
                                        min="1" 
                                        placeholder="e.g. 50" 
                                        value={restockForm.qty} 
                                        onChange={e => setRestockForm({...restockForm, qty: e.target.value})} 
                                        style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontWeight: '800' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Cost Price per Unit (₹) *</label>
                                    <input 
                                        type="number" 
                                        required 
                                        min="0" 
                                        placeholder="e.g. 250" 
                                        value={restockForm.costPrice} 
                                        onChange={e => setRestockForm({...restockForm, costPrice: e.target.value})} 
                                        style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontWeight: '800', color: '#e11d48' }} 
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Paid via *</label>
                                <select 
                                    required 
                                    value={restockForm.paymentMode} 
                                    onChange={e => setRestockForm({...restockForm, paymentMode: e.target.value})} 
                                    style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontWeight: '700' }}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Card">Card</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Purchase Order Notes / Invoice No.</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Inv #8928, L'Oreal professional coloring batch..." 
                                    value={restockForm.notes} 
                                    onChange={e => setRestockForm({...restockForm, notes: e.target.value})} 
                                    style={{ width: '100%', padding: '0.8rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} 
                                />
                            </div>
                        </div>

                        {restockForm.qty && restockForm.costPrice && (
                            <div style={{ background: '#f8fafc', border: '1px solid var(--v2-border)', borderRadius: '6px', padding: '1rem', marginTop: '1.25rem', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>Total restock cost</span>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#e11d48', marginTop: '0.25rem' }}>
                                    ₹{parseInt(restockForm.qty) * parseFloat(restockForm.costPrice)}
                                </div>
                                <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '700' }}>✓ Auto-recorded in Store Expenses</span>
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                            <button type="button" onClick={() => setActiveRestockSupplier(null)} style={{ flex: 1, padding: '0.875rem', background: '#f1f5f9', color: 'var(--v2-text-main)', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" disabled={isRestocking} style={{ flex: 1, padding: '0.875rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: isRestocking ? 'not-allowed' : 'pointer' }}>
                                {isRestocking ? 'Updating Stock...' : 'Confirm Stock In'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Layout>
    );
}
