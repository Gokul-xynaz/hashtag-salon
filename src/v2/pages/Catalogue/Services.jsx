import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { useData } from '../../../context/DataProvider';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function Services() {
    const { services } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newService, setNewService] = useState({ name: '', category: '', duration: '', price: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Aggregate unique categories
    const categories = ['All', ...new Set((services || []).map(s => s.category || 'General'))];

    const filteredServices = (services || []).filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || (s.category || 'General') === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    const handleAddService = async (e) => {
        e.preventDefault();
        if (!newService.name || !newService.price) return alert("Name and Price are required!");
        setIsSaving(true);
        try {
            await addDoc(collection(db, 'services'), {
                name: newService.name,
                category: newService.category || 'General',
                duration: parseInt(newService.duration) || 30,
                price: parseFloat(newService.price) || 0
            });
            setNewService({ name: '', category: '', duration: '', price: '' });
            setShowAddModal(false);
        } catch (error) {
            console.error("Error adding service:", error);
            alert("Failed to add service: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Services Catalogue</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Manage your service offerings, pricing, and durations.</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                    + Add New Service
                </button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Categories Sidebar */}
                <div className="v2-card" style={{ width: '240px', padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--v2-border)', fontWeight: '800', fontSize: '0.9rem' }}>Categories</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '0.75rem 1rem',
                                    textAlign: 'left',
                                    background: selectedCategory === cat ? '#f1f5f9' : 'transparent',
                                    border: 'none',
                                    borderLeft: selectedCategory === cat ? '4px solid var(--v2-primary)' : '4px solid transparent',
                                    cursor: 'pointer',
                                    fontWeight: selectedCategory === cat ? '700' : '500',
                                    color: selectedCategory === cat ? 'var(--v2-primary)' : 'var(--v2-text-main)',
                                    fontSize: '0.85rem'
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Services List */}
                <div className="v2-card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--v2-border)', background: '#f8fafc', display: 'flex', gap: '1rem' }}>
                        <input 
                            type="text" 
                            placeholder="Search services..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ flex: 1, maxWidth: '400px', padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }} 
                        />
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Service Name</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Duration</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>Price</th>
                                <th style={{ padding: '1rem 1.5rem', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredServices.length === 0 ? (
                                <tr><td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No services found.</td></tr>
                            ) : (
                                filteredServices.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--v2-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--v2-text-main)' }}>{s.name}</td>
                                        <td style={{ padding: '1rem 1.5rem', color: 'var(--v2-text-muted)' }}>{s.duration || 30} mins</td>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#10b981' }}>{fmt(s.price)}</td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                            <button style={{ border: 'none', background: 'transparent', color: 'var(--v2-primary)', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Service Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="v2-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '1.5rem' }}>Add New Service</h2>
                        <form onSubmit={handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>SERVICE NAME</label>
                                <input type="text" value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>CATEGORY</label>
                                <input type="text" value={newService.category} onChange={e => setNewService({ ...newService, category: e.target.value })} placeholder="e.g. Haircut, Spa" style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>DURATION (MINS)</label>
                                    <input type="number" value={newService.duration} onChange={e => setNewService({ ...newService, duration: e.target.value })} placeholder="30" style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>PRICE (₹)</label>
                                    <input type="number" value={newService.price} onChange={e => setNewService({ ...newService, price: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '0.6rem 1.25rem', background: 'white', border: '1px solid var(--v2-border)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSaving} style={{ padding: '0.6rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>
                                    {isSaving ? 'Saving...' : 'Save Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
