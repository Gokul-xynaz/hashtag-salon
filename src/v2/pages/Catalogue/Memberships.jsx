import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const EMPTY_FORM = { name: '', price: '', credit: '', discount: '', validDays: 365 };

export default function Memberships() {
    const [memberships, setMemberships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'memberships'), (snap) => {
            setMemberships(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error('Memberships load error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (m) => {
        setEditingId(m.id);
        setForm({ name: m.name, price: m.price, credit: m.credit, discount: m.discount || '', validDays: m.validDays || 365 });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.price) return;
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            price: Number(form.price),
            credit: Number(form.credit) || 0,
            discount: form.discount.trim(),
            validDays: Number(form.validDays) || 365,
            updatedAt: serverTimestamp()
        };
        try {
            if (editingId) {
                await updateDoc(doc(db, 'memberships', editingId), payload);
            } else {
                await addDoc(collection(db, 'memberships'), { ...payload, createdAt: serverTimestamp() });
            }
            setShowModal(false);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save. Check Firestore permissions.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this membership tier? This cannot be undone.')) return;
        setDeleting(id);
        try {
            await deleteDoc(doc(db, 'memberships', id));
        } catch (err) {
            alert('Delete failed. Check Firestore permissions.');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Memberships</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Create loyalty programs offering wallet credits and special discounts.</p>
                </div>
                <button onClick={openCreate} style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    + Create Membership
                </button>
            </div>

            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading memberships…</div>
                ) : memberships.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌟</div>
                        <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>No Membership Tiers Yet</div>
                        <div style={{ fontSize: '0.85rem' }}>Create your first loyalty program to reward your regular clients.</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Tier Name</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Price</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Wallet Credit Provided</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Extra Perks</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Validity</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberships.map(m => (
                                <tr key={m.id} style={{ borderBottom: '1px solid var(--v2-border)' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--v2-text-main)' }}>{m.name}</td>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{fmt(m.price)}</td>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#10b981' }}>{fmt(m.credit)}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--v2-text-muted)' }}>{m.discount || '—'}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--v2-text-muted)' }}>{m.validDays} Days</td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                        <button onClick={() => openEdit(m)} style={{ border: 'none', background: 'transparent', color: 'var(--v2-primary)', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem', marginRight: '1rem' }}>
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id} style={{ border: 'none', background: 'transparent', color: '#dc2626', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem' }}>
                                            {deleting === m.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="v2-card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', margin: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '1.5rem' }}>
                            {editingId ? 'Edit Membership' : 'Create Membership'}
                        </h2>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Tier Name *</label>
                                    <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gold VIP" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Price (₹) *</label>
                                        <input required type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="5000" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Wallet Credit (₹)</label>
                                        <input type="number" min="0" value={form.credit} onChange={e => setForm({ ...form, credit: e.target.value })} placeholder="6000" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Extra Perks / Discount</label>
                                        <input value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} placeholder="e.g. 10% on Products" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Validity (Days)</label>
                                        <input type="number" min="1" value={form.validDays} onChange={e => setForm({ ...form, validDays: e.target.value })} placeholder="365" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.75rem 1.5rem', background: 'white', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} style={{ padding: '0.75rem 2rem', background: saving ? '#94a3b8' : 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                                    {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
