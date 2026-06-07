import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function Promotions() {
    const [activeTab, setActiveTab] = useState('coupons'); // 'coupons', 'giftcards'
    
    // Data State
    const [coupons, setCoupons] = useState([]);
    const [giftCards, setGiftCards] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [showGiftCardModal, setShowGiftCardModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyTitle, setHistoryTitle] = useState('');
    const [saving, setSaving] = useState(false);

    // Forms
    const [couponForm, setCouponForm] = useState({ code: '', type: 'percentage', value: '', minOrderValue: 0, expiresAt: '' });
    const [giftCardForm, setGiftCardForm] = useState({ code: '', balance: '', recipientPhone: '', recipientName: '' });

    // Generate random gift card code
    const generateGiftCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'GIFT-';
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        setGiftCardForm({ ...giftCardForm, code });
    };

    useEffect(() => {
        // Fetch Coupons
        const qCoupons = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
        const unsubCoupons = onSnapshot(qCoupons, (snap) => {
            setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch Gift Cards
        const qGiftCards = query(collection(db, 'giftcards'), orderBy('createdAt', 'desc'));
        const unsubGiftCards = onSnapshot(qGiftCards, (snap) => {
            setGiftCards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => { unsubCoupons(); unsubGiftCards(); };
    }, []);

    const saveCoupon = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await addDoc(collection(db, 'promotions'), {
                code: couponForm.code.toUpperCase().trim(),
                type: couponForm.type,
                value: Number(couponForm.value),
                minOrderValue: Number(couponForm.minOrderValue) || 0,
                expiresAt: couponForm.expiresAt || null,
                isActive: true,
                createdAt: serverTimestamp(),
                usageCount: 0
            });
            setShowCouponModal(false);
            setCouponForm({ code: '', type: 'percentage', value: '', minOrderValue: 0, expiresAt: '' });
        } catch (err) {
            alert(err.message);
        } finally { setSaving(false); }
    };

    const saveGiftCard = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await addDoc(collection(db, 'giftcards'), {
                code: giftCardForm.code.toUpperCase().trim(),
                balance: Number(giftCardForm.balance),
                initialBalance: Number(giftCardForm.balance),
                recipientPhone: giftCardForm.recipientPhone,
                recipientName: giftCardForm.recipientName,
                isActive: true,
                createdAt: serverTimestamp()
            });
            setShowGiftCardModal(false);
            setGiftCardForm({ code: '', balance: '', recipientPhone: '', recipientName: '' });
        } catch (err) {
            alert(err.message);
        } finally { setSaving(false); }
    };

    const toggleStatus = async (collectionName, id, currentStatus) => {
        await updateDoc(doc(db, collectionName, id), { isActive: !currentStatus });
    };
    
    const deleteRecord = async (collectionName, id) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;
        await deleteDoc(doc(db, collectionName, id));
    };

    const viewHistory = (title, historyArray) => {
        setHistoryTitle(title);
        setHistoryData(historyArray || []);
        setShowHistoryModal(true);
    };

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900' }}>Promotions & Gift Cards</h1>
                    <p style={{ color: 'var(--v2-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>Manage discounts, loyalty, and pre-paid gift cards.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setShowCouponModal(true)} style={{ padding: '0.75rem 1.25rem', background: 'var(--v2-bg-main)', color: 'var(--v2-text-main)', border: '1px solid var(--v2-border)', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>+ New Coupon</button>
                    <button onClick={() => { generateGiftCode(); setShowGiftCardModal(true); }} style={{ padding: '0.75rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}>+ Issue Gift Card</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--v2-border)', marginBottom: '2rem' }}>
                {['coupons', 'giftcards'].map(tab => (
                    <button 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        style={{ background: 'none', border: 'none', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', borderBottom: activeTab === tab ? '3px solid var(--v2-primary)' : '3px solid transparent', color: activeTab === tab ? 'var(--v2-primary)' : 'var(--v2-text-muted)', textTransform: 'uppercase', transition: '0.2s' }}
                    >
                        {tab === 'coupons' ? 'Discount Coupons' : 'Gift Cards'}
                    </button>
                ))}
            </div>

            {/* Coupons View */}
            {activeTab === 'coupons' && (
                <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '150px 150px 150px 1fr 100px 100px', background: 'var(--v2-bg-main)', padding: '1rem', fontWeight: '800', fontSize: '0.75rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--v2-border)' }}>
                        <div>Code</div>
                        <div>Discount</div>
                        <div>Min. Order</div>
                        <div>Expires</div>
                        <div style={{ textAlign: 'center' }}>Status</div>
                        <div style={{ textAlign: 'center' }}>Actions</div>
                    </div>
                    {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading...</div> : coupons.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No coupons found.</div> : (
                        coupons.map(c => (
                            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '150px 150px 150px 1fr 100px 100px', padding: '1rem', borderBottom: '1px solid var(--v2-border)', alignItems: 'center', opacity: c.isActive ? 1 : 0.6 }}>
                                <div style={{ fontWeight: '900', color: 'var(--v2-primary)', fontSize: '1.1rem', letterSpacing: '1px' }}>{c.code}</div>
                                <div style={{ fontWeight: '800', color: '#059669' }}>{c.type === 'percentage' ? `${c.value}% OFF` : `₹${c.value} OFF`}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>{c.minOrderValue > 0 ? `₹${c.minOrderValue}` : 'None'}</div>
                                <div style={{ fontSize: '0.85rem' }}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}</div>
                                <div style={{ textAlign: 'center' }}>
                                    <button onClick={() => toggleStatus('promotions', c.id, c.isActive)} style={{ padding: '4px 8px', fontSize: '0.7rem', fontWeight: '800', border: 'none', borderRadius: '12px', cursor: 'pointer', background: c.isActive ? '#dcfce7' : '#f1f5f9', color: c.isActive ? '#166534' : '#64748b' }}>{c.isActive ? 'ACTIVE' : 'DISABLED'}</button>
                                </div>
                                <div style={{ textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                    <button onClick={() => viewHistory(`History: ${c.code}`, c.redemptionHistory)} style={{ padding: '4px 8px', fontSize: '0.7rem', fontWeight: '800', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'white' }}>Audit Log</button>
                                    <button onClick={() => deleteRecord('promotions', c.id)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: '800' }}>Delete</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Gift Cards View */}
            {activeTab === 'giftcards' && (
                <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 150px 1fr 150px 100px 100px', background: 'var(--v2-bg-main)', padding: '1rem', fontWeight: '800', fontSize: '0.75rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', borderBottom: '2px solid var(--v2-border)' }}>
                        <div>Card Code</div>
                        <div>Current Balance</div>
                        <div>Recipient Name</div>
                        <div>Recipient Phone</div>
                        <div style={{ textAlign: 'center' }}>Status</div>
                        <div style={{ textAlign: 'center' }}>Actions</div>
                    </div>
                    {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading...</div> : giftCards.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No gift cards found.</div> : (
                        giftCards.map(g => (
                            <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '180px 150px 1fr 150px 100px 100px', padding: '1rem', borderBottom: '1px solid var(--v2-border)', alignItems: 'center', opacity: g.isActive ? 1 : 0.6 }}>
                                <div style={{ fontWeight: '900', color: '#1e40af', fontSize: '1.05rem', letterSpacing: '1px', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>{g.code}</div>
                                <div>
                                    <div style={{ fontWeight: '900', color: '#059669', fontSize: '1.1rem' }}>₹{g.balance}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)' }}>Initial: ₹{g.initialBalance}</div>
                                </div>
                                <div style={{ fontWeight: '700' }}>{g.recipientName || 'Walk-in Client'}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>{g.recipientPhone || 'N/A'}</div>
                                <div style={{ textAlign: 'center' }}>
                                    <button onClick={() => toggleStatus('giftcards', g.id, g.isActive)} style={{ padding: '4px 8px', fontSize: '0.7rem', fontWeight: '800', border: 'none', borderRadius: '12px', cursor: 'pointer', background: g.isActive ? '#dcfce7' : '#f1f5f9', color: g.isActive ? '#166534' : '#64748b' }}>{g.isActive ? 'ACTIVE' : 'DISABLED'}</button>
                                </div>
                                <div style={{ textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                    <button onClick={() => viewHistory(`History: ${g.code}`, g.redemptionHistory)} style={{ padding: '4px 8px', fontSize: '0.7rem', fontWeight: '800', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'white' }}>Audit Log</button>
                                    <button onClick={() => deleteRecord('giftcards', g.id)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: '800' }}>Delete</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Coupon Modal */}
            {showCouponModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCouponModal(false)}>
                    <form onSubmit={saveCoupon} className="v2-card" style={{ maxWidth: '450px', width: '100%', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>Create Discount Code</h2>
                            <button type="button" onClick={() => setShowCouponModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--v2-text-muted)' }}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Promo Code *</label>
                                <input type="text" required value={couponForm.code} onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} placeholder="e.g. DIWALI20" style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Discount Type *</label>
                                    <select required value={couponForm.type} onChange={e => setCouponForm({...couponForm, type: e.target.value})} style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700' }}>
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="flat">Flat Amount (₹)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Value *</label>
                                    <input type="number" required min="1" value={couponForm.value} onChange={e => setCouponForm({...couponForm, value: e.target.value})} placeholder={couponForm.type === 'percentage' ? "20" : "500"} style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '900', color: 'var(--v2-primary)' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Min. Order (Optional)</label>
                                    <input type="number" min="0" value={couponForm.minOrderValue} onChange={e => setCouponForm({...couponForm, minOrderValue: e.target.value})} placeholder="₹0" style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Expiration Date</label>
                                    <input type="date" value={couponForm.expiresAt} onChange={e => setCouponForm({...couponForm, expiresAt: e.target.value})} style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700' }} />
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={saving} style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                            {saving ? 'Saving...' : 'Create Promo Code'}
                        </button>
                    </form>
                </div>
            )}

            {/* Gift Card Modal */}
            {showGiftCardModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowGiftCardModal(false)}>
                    <form onSubmit={saveGiftCard} className="v2-card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>Issue Gift Card</h2>
                            <button type="button" onClick={() => setShowGiftCardModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--v2-text-muted)' }}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Auto-Generated Code *</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input type="text" required value={giftCardForm.code} onChange={e => setGiftCardForm({...giftCardForm, code: e.target.value.toUpperCase()})} style={{ flex: 1, padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', background: '#f8fafc' }} />
                                    <button type="button" onClick={generateGiftCode} style={{ padding: '0 1rem', background: 'var(--v2-bg-main)', border: '1px solid var(--v2-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>↻</button>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Gift Card Balance (₹) *</label>
                                <input type="number" required min="1" value={giftCardForm.balance} onChange={e => setGiftCardForm({...giftCardForm, balance: e.target.value})} placeholder="e.g. 5000" style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '900', color: '#059669', fontSize: '1.25rem' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Recipient Name (Optional)</label>
                                <input type="text" value={giftCardForm.recipientName} onChange={e => setGiftCardForm({...giftCardForm, recipientName: e.target.value})} placeholder="e.g. Priya Sharma" style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700' }} />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Recipient Phone (Optional)</label>
                                <input type="tel" value={giftCardForm.recipientPhone} onChange={e => setGiftCardForm({...giftCardForm, recipientPhone: e.target.value.replace(/\D/g, '')})} placeholder="10-digit number" style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--v2-border)', borderRadius: '8px', outline: 'none', fontWeight: '700' }} />
                            </div>
                        </div>

                        <button type="submit" disabled={saving} style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '1.05rem', cursor: saving ? 'not-allowed' : 'pointer' }}>
                            {saving ? 'Issuing...' : 'Issue Gift Card'}
                        </button>
                    </form>
                </div>
            )}

            {/* Audit History Modal */}
            {showHistoryModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowHistoryModal(false)}>
                    <div className="v2-card" style={{ maxWidth: '600px', width: '100%', padding: '2rem', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>{historyTitle}</h2>
                            <button type="button" onClick={() => setShowHistoryModal(false)} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--v2-text-muted)' }}>×</button>
                        </div>
                        
                        {historyData.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No redemptions found.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {historyData.map((h, i) => (
                                    <div key={i} style={{ border: '1px solid var(--v2-border)', padding: '1rem', borderRadius: '8px', background: '#f8fafc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e40af' }}>{new Date(h.date).toLocaleString('en-IN')}</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#059669' }}>Deducted: ₹{h.discountAmount || h.amountDeducted || 0}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--v2-text-muted)' }}>Processed By Stylist:</span> <strong>{h.stylistName}</strong></div>
                                        <div style={{ fontSize: '0.85rem' }}><span style={{ color: 'var(--v2-text-muted)' }}>Client:</span> <strong>{h.clientName}</strong> ({h.clientPhone})</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </Layout>
    );
}
