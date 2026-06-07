import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function ManageStaff() {
    const navigate = useNavigate();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Exclude the technical kiosk account and the unused 'stylist' profile
            const filtered = list.filter(u => 
                !u.isKiosk && 
                u.email !== 'hashtagsalon@store.com' && 
                u.name?.toLowerCase() !== 'stylist' && 
                u.id !== 'stylist' && 
                !u.email?.toLowerCase().startsWith('stylist@')
            );
            setStaff(filtered);
            setLoading(false);
        }, (err) => {
            console.error("Staff fetch error:", err);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const toggleStatus = async (id, currentStatus) => {
        try {
            await updateDoc(doc(db, 'users', id), {
                isActive: !currentStatus
            });
        } catch (err) {
            alert('Failed to update status: ' + err.message);
        }
    };

    const filteredStaff = staff.filter(s => 
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone || '').includes(searchQuery) ||
        (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeCount = staff.filter(s => s.isActive !== false).length;

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Manage Staff</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Manage your team's access, permissions, and payroll profiles.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                        onClick={() => navigate('/v2/staff/payroll')}
                        style={{ padding: '0.6rem 1.25rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    >
                        Generate Payroll 💸
                    </button>

                    <button 
                        onClick={() => navigate('/v2/staff/new')}
                        style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    >
                        + Add New Staff
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="v2-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Total Staff</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)' }}>{staff.length}</div>
                </div>
                <div className="v2-card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Active Members</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>{activeCount}</div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', gap: '1rem', background: '#f8fafc' }}>
                    <input 
                        type="text" 
                        placeholder="Search by name, email, or phone..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: 1, maxWidth: '400px', padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                    />
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Staff Member</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Contact</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Role / Designation</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Joining Date</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Status</th>
                                <th style={{ padding: '1rem 1.25rem', textAlign: 'right', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading staff data...</td></tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No staff members found.</td></tr>
                            ) : (
                                filteredStaff.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--v2-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: s.color || 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem' }}>
                                                    {s.name?.charAt(0) || 'U'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '800', color: 'var(--v2-text-main)' }}>{s.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>ID: {s.staffId || s.id.substring(0,6).toUpperCase()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <div style={{ fontWeight: '600' }}>{s.phone || 'N/A'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{s.email || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <span style={{ padding: '0.2rem 0.6rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>
                                                {s.role || 'Stylist'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '600' }}>
                                            {s.joiningDate ? new Date(s.joiningDate).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                                                <div style={{ position: 'relative', width: '36px', height: '20px', background: s.isActive !== false ? '#10b981' : '#d1d5db', borderRadius: '20px', transition: '0.3s' }} onClick={() => toggleStatus(s.id, s.isActive !== false)}>
                                                    <div style={{ position: 'absolute', top: '2px', left: s.isActive !== false ? '18px' : '2px', width: '16px', height: '16px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: s.isActive !== false ? '#10b981' : '#6b7280' }}>{s.isActive !== false ? 'Active' : 'Inactive'}</span>
                                            </label>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                            <button 
                                                onClick={() => navigate(`/v2/staff/${s.id}`)}
                                                style={{ background: 'transparent', border: '1px solid var(--v2-primary)', color: 'var(--v2-primary)', padding: '0.4rem 1rem', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem' }}
                                            >
                                                Manage Profile
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
}
