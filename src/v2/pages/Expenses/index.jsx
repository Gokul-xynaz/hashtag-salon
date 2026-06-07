import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';

const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Water', 'Inventory/Supplies', 'Marketing', 'Maintenance', 'Staff Perks', 'Miscellaneous'];
const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Bank Transfer'];

function getMonthBounds(offset = 0) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

export default function V2Expenses() {
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';

    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Date filter: 0 = current month, -1 = last month, 'all' = all time, 'custom' = custom range
    const [dateMode, setDateMode] = useState('current');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    // Form State
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        category: 'Miscellaneous',
        paymentMode: 'Cash',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const q = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setExpenses(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Filter by selected date range (client-side for simplicity)
    const filtered = useMemo(() => {
        if (dateMode === 'all') return expenses;
        let start, end;
        if (dateMode === 'current') { ({ start, end } = getMonthBounds(0)); }
        else if (dateMode === 'last')   { ({ start, end } = getMonthBounds(-1)); }
        else if (dateMode === 'custom' && customFrom && customTo) {
            start = new Date(customFrom); start.setHours(0,0,0,0);
            end   = new Date(customTo);   end.setHours(23,59,59,999);
        } else return expenses;
        return expenses.filter(e => {
            const ts = e.timestamp?.toDate?.()?.getTime?.();
            return ts && ts >= start.getTime() && ts <= end.getTime();
        });
    }, [expenses, dateMode, customFrom, customTo]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.amount || isNaN(formData.amount) || Number(formData.amount) <= 0) {
            return alert("Enter a valid expense amount");
        }
        setSaving(true);
        try {
            const dateObj = new Date(formData.date);
            dateObj.setHours(12, 0, 0, 0);
            await addDoc(collection(db, 'expenses'), {
                amount: Number(formData.amount),
                category: formData.category,
                paymentMode: formData.paymentMode,
                description: formData.description || '',
                timestamp: Timestamp.fromDate(dateObj),
                createdAt: serverTimestamp(),
                type: 'store_expense'
            });
            setShowModal(false);
            setFormData({ amount: '', category: 'Miscellaneous', paymentMode: 'Cash', description: '', date: new Date().toISOString().split('T')[0] });
        } catch (err) {
            alert("Error saving expense: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!isAdmin) return alert('Only admins can delete expense records.');
        if (!window.confirm("Are you sure you want to delete this expense record? This cannot be undone.")) return;
        await deleteDoc(doc(db, 'expenses', id));
    };

    const { totalExpenses, cashExpenses } = useMemo(() => {
        let total = 0, cash = 0;
        filtered.forEach(e => {
            total += (e.amount || 0);
            if ((e.paymentMode || '').toLowerCase() === 'cash') cash += (e.amount || 0);
        });
        return { totalExpenses: total, cashExpenses: cash };
    }, [filtered]);

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900' }}>Store Expenses</h1>
                    <p style={{ color: 'var(--v2-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>Track operational costs. (These do NOT deduct from stylist payroll).</p>
                </div>
                {isAdmin && (
                    <button onClick={() => setShowModal(true)} style={{ padding: '0.75rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>+</span> Add Expense
                    </button>
                )}
            </div>

            {/* ── Date Filter Bar ── */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {[{ key: 'current', label: 'This Month' }, { key: 'last', label: 'Last Month' }, { key: 'all', label: 'All Time' }, { key: 'custom', label: 'Custom Range' }].map(opt => (
                    <button key={opt.key} onClick={() => setDateMode(opt.key)}
                        style={{ padding: '0.45rem 1rem', borderRadius: '20px', border: '1.5px solid', borderColor: dateMode === opt.key ? 'var(--v2-primary)' : 'var(--v2-border)', background: dateMode === opt.key ? 'var(--v2-primary)' : 'white', color: dateMode === opt.key ? 'white' : 'var(--v2-text-muted)', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
                        {opt.label}
                    </button>
                ))}
                {dateMode === 'custom' && (
                    <>
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }} />
                        <span style={{ color: 'var(--v2-text-muted)', fontWeight: '700' }}>to</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }} />
                    </>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--v2-text-muted)', fontWeight: '700' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div className="v2-card" style={{ padding: '1.5rem', background: '#fff1f2', border: '1px solid #ffe4e6' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#e11d48', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Expenses</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#9f1239' }}>{formatCurrency(totalExpenses)}</div>
                </div>
                <div className="v2-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--v2-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Paid in Cash</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--v2-text-main)' }}>{formatCurrency(cashExpenses)}</div>
                </div>
                <div className="v2-card" style={{ padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--v2-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Records</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--v2-text-main)' }}>{filtered.length}</div>
                </div>
            </div>

            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 150px 100px', background: 'var(--v2-bg-main)', padding: '1rem', fontWeight: '800', fontSize: '0.75rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--v2-border)' }}>
                    <div>Date</div><div>Category & Desc</div><div>Mode</div>
                    <div style={{ textAlign: 'right' }}>Amount</div>
                    <div style={{ textAlign: 'center' }}>{isAdmin ? 'Action' : ''}</div>
                </div>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading expenses...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No expenses found for the selected period.</div>
                ) : (
                    <div>
                        {filtered.map(exp => (
                            <div key={exp.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 150px 100px', padding: '1rem', borderBottom: '1px solid var(--v2-border)', alignItems: 'center' }}>
                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                                    {exp.timestamp?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Unknown'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: '800', color: 'var(--v2-text-main)', fontSize: '0.9rem' }}>{exp.category}</div>
                                    {exp.description && <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', marginTop: '0.25rem' }}>{exp.description}</div>}
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', background: exp.paymentMode === 'Cash' ? '#dcfce7' : '#e0e7ff', color: exp.paymentMode === 'Cash' ? '#166534' : '#3730a3', textTransform: 'uppercase' }}>
                                        {exp.paymentMode}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: '900', color: '#e11d48', fontSize: '1.05rem' }}>
                                    {formatCurrency(exp.amount)}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {isAdmin && (
                                        <button onClick={() => handleDelete(exp.id)} style={{ padding: '0.4rem 0.75rem', border: '1px solid #fca5a5', background: 'white', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}>Delete</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal — admin only */}
            {showModal && isAdmin && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
                    <form onSubmit={handleSave} className="v2-card" style={{ maxWidth: '450px', width: '100%', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>Record Store Expense</h2>
                            <button type="button" onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--v2-text-muted)' }}>×</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Date *</label>
                                <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Amount (₹) *</label>
                                    <input type="number" required min="1" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="e.g. 500" style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '900', color: '#e11d48', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Payment Mode *</label>
                                    <select required value={formData.paymentMode} onChange={e => setFormData({...formData, paymentMode: e.target.value})} style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700', boxSizing: 'border-box' }}>
                                        {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Category *</label>
                                <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700', boxSizing: 'border-box' }}>
                                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Description (Optional)</label>
                                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="e.g. Printer ink, AC repair..." style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '1rem', background: '#f1f5f9', color: 'var(--v2-text-main)', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" disabled={saving} style={{ flex: 1, padding: '1rem', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                                {saving ? 'Recording...' : 'Record Expense'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Layout>
    );
}
