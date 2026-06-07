import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useData } from '../../../context/DataProvider';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const EMPTY_FORM = { name: '', price: '', validDays: 30, serviceIds: [] };

export default function Packages() {
    const { services } = useData();
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'packages'), (snap) => {
            setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error('Packages load error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (p) => {
        setEditingId(p.id);
        setForm({ name: p.name, price: p.price, validDays: p.validDays || 30, serviceIds: p.serviceIds || [] });
        setShowModal(true);
    };

    const toggleService = (serviceId) => {
        setForm(prev => ({
            ...prev,
            serviceIds: prev.serviceIds.includes(serviceId)
                ? prev.serviceIds.filter(id => id !== serviceId)
                : [...prev.serviceIds, serviceId]
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.price) return;
        setSaving(true);

        // Resolve service names for display
        const selectedServices = (services || []).filter(s => form.serviceIds.includes(s.id));
        const servicesLabel = selectedServices.map(s => s.name).join(', ');

        const payload = {
            name: form.name.trim(),
            price: Number(form.price),
            validDays: Number(form.validDays) || 30,
            serviceIds: form.serviceIds,
            services: servicesLabel,
            updatedAt: serverTimestamp()
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'packages', editingId), payload);
            } else {
                await addDoc(collection(db, 'packages'), { ...payload, createdAt: serverTimestamp() });
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
        if (!window.confirm('Delete this package? This cannot be undone.')) return;
        setDeleting(id);
        try {
            await deleteDoc(doc(db, 'packages', id));
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
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Packages</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Bundle multiple services together at a discounted rate.</p>
                </div>
                <button onClick={openCreate} style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    + Create Package
                </button>
            </div>

            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading packages…</div>
                ) : packages.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎁</div>
                        <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>No Packages Yet</div>
                        <div style={{ fontSize: '0.85rem' }}>Create a bundle to offer clients multiple services at a special rate.</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Package Name</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Included Services</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Validity</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Bundle Price</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packages.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--v2-border)' }}>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--v2-text-main)' }}>{p.name}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--v2-text-muted)', maxWidth: '260px' }}>{p.services || '—'}</td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--v2-text-muted)' }}>{p.validDays} Days</td>
                                    <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#f59e0b' }}>{fmt(p.price)}</td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                        <button onClick={() => openEdit(p)} style={{ border: 'none', background: 'transparent', color: 'var(--v2-primary)', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem', marginRight: '1rem' }}>Edit</button>
                                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={{ border: 'none', background: 'transparent', color: '#dc2626', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem' }}>
                                            {deleting === p.id ? 'Deleting…' : 'Delete'}
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
                    <div className="v2-card" style={{ width: '100%', maxWidth: '540px', padding: '2rem', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '1.5rem' }}>
                            {editingId ? 'Edit Package' : 'Create Package'}
                        </h2>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Package Name *</label>
                                    <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bridal Makeover" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Bundle Price (₹) *</label>
                                        <input required type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="15000" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Validity (Days)</label>
                                        <input type="number" min="1" value={form.validDays} onChange={e => setForm({ ...form, validDays: e.target.value })} placeholder="30" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                </div>

                                {/* Service multi-select from real services */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                                        Included Services ({form.serviceIds.length} selected)
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--v2-border)', borderRadius: '6px', padding: '0.75rem' }}>
                                        {(services || []).length === 0 ? (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)' }}>No services found in your catalogue.</span>
                                        ) : (services || []).map(s => (
                                            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.85rem', padding: '0.35rem', borderRadius: '4px', background: form.serviceIds.includes(s.id) ? '#f0fdf4' : 'transparent' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.serviceIds.includes(s.id)}
                                                    onChange={() => toggleService(s.id)}
                                                    style={{ accentColor: 'var(--v2-primary)' }}
                                                />
                                                <span style={{ flex: 1 }}>{s.name}</span>
                                                <span style={{ color: 'var(--v2-text-muted)', fontSize: '0.78rem' }}>₹{s.price || 0}</span>
                                            </label>
                                        ))}
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
