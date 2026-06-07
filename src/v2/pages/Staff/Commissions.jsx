import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const EMPTY_PROFILE = { name: '', serviceComm: 0, productComm: 0, membershipComm: 0, packageComm: 0 };

export default function StaffCommissions() {
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProfile, setCurrentProfile] = useState(null);
    const [saving, setSaving] = useState(false);

    // Load from Firestore
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'commission_profiles'), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProfiles(list);
            setLoading(false);
        }, (err) => {
            console.error('Commission profiles error:', err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!currentProfile.name?.trim()) return alert('Enter a profile name.');
        setSaving(true);
        try {
            const data = {
                name: currentProfile.name.trim(),
                serviceComm: Number(currentProfile.serviceComm) || 0,
                productComm: Number(currentProfile.productComm) || 0,
                membershipComm: Number(currentProfile.membershipComm) || 0,
                packageComm: Number(currentProfile.packageComm) || 0,
                updatedAt: serverTimestamp(),
            };
            if (currentProfile.id) {
                await updateDoc(doc(db, 'commission_profiles', currentProfile.id), data);
            } else {
                await addDoc(collection(db, 'commission_profiles'), { ...data, createdAt: serverTimestamp() });
            }
            setIsEditing(false);
            setCurrentProfile(null);
        } catch (err) {
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this commission profile? Any staff assigned to it will lose their commission tier.')) return;
        await deleteDoc(doc(db, 'commission_profiles', id));
    };

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Commission Profiles</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Create global commission tiers to assign to staff members. Saved to Firestore.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => navigate('/v2/staff')} style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                        Back to Staff
                    </button>
                    <button onClick={() => { setCurrentProfile({ ...EMPTY_PROFILE }); setIsEditing(true); }}
                        style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        + New Profile
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                {/* Profile List */}
                <div className="v2-card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading profiles...</div>
                    ) : profiles.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                            No commission profiles yet. Create your first one →
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.7rem' }}>Profile Name</th>
                                    <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.7rem', textAlign: 'center' }}>Services</th>
                                    <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.7rem', textAlign: 'center' }}>Products</th>
                                    <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.7rem', textAlign: 'center' }}>Memberships</th>
                                    <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.7rem', textAlign: 'center' }}>Packages</th>
                                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.map(p => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--v2-border)' }}>
                                        <td style={{ padding: '1rem 1.25rem', fontWeight: '800' }}>{p.name}</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: '#10b981', fontWeight: '700' }}>{p.serviceComm}%</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: '#3b82f6', fontWeight: '700' }}>{p.productComm}%</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: '#8b5cf6', fontWeight: '700' }}>{p.membershipComm}%</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center', color: '#f59e0b', fontWeight: '700' }}>{p.packageComm}%</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button onClick={() => { setCurrentProfile({ ...p }); setIsEditing(true); }} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid var(--v2-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Edit</button>
                                            <button onClick={() => handleDelete(p.id)} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Edit Form */}
                {isEditing && currentProfile && (
                    <div className="v2-card" style={{ width: '400px', padding: '1.5rem', background: '#f8fafc', border: '2px solid var(--v2-primary)', position: 'sticky', top: '20px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', borderBottom: '1px solid var(--v2-border)', paddingBottom: '0.75rem' }}>
                            {currentProfile.id ? 'Edit Profile' : 'Create New Profile'}
                        </h3>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Profile Name *</label>
                                <input type="text" value={currentProfile.name} onChange={e => setCurrentProfile({...currentProfile, name: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {[
                                    { label: 'Service Comm (%)', key: 'serviceComm' },
                                    { label: 'Product Comm (%)', key: 'productComm' },
                                    { label: 'Membership (%)', key: 'membershipComm' },
                                    { label: 'Package (%)', key: 'packageComm' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{f.label}</label>
                                        <input type="number" min="0" max="100" value={currentProfile[f.key]} onChange={e => setCurrentProfile({...currentProfile, [f.key]: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => { setIsEditing(false); setCurrentProfile(null); }} style={{ padding: '0.75rem 1rem', background: 'transparent', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={saving} style={{ padding: '0.75rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>
                                    {saving ? 'Saving...' : 'Save Profile'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </Layout>
    );
}
