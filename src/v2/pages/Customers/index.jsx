import Layout from '../../components/Layout';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataProvider';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, query, where, orderBy, limit, onSnapshot, getDocs, getCountFromServer, getAggregateFromServer, sum } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function V2Customers() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerHistory, setCustomerHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    const [localCustomers, setLocalCustomers] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, totalRevenue: 0, avgSpend: 0 });
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', dob: '', anniversary: '' });

    // Fetch visit history when a customer is selected
    useEffect(() => {
        if (!selectedCustomer) { setCustomerHistory([]); return; }
        setLoadingHistory(true);
        const q = query(collection(db, 'appointments'), where('clientPhone', '==', selectedCustomer.phone), orderBy('timestamp', 'desc'), limit(50));
        const unsub = onSnapshot(q, snap => { setCustomerHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingHistory(false); }, () => setLoadingHistory(false));
        return () => unsub();
    }, [selectedCustomer]);

    // Fetch stats via Aggregate Queries
    useEffect(() => {
        async function fetchStats() {
            try {
                const collRef = collection(db, 'customers');
                const totalSnap = await getCountFromServer(collRef);
                const total = totalSnap.data().count;
                
                const activeQ = query(collRef, where('globalStats.totalVisits', '>', 1));
                const activeSnap = await getCountFromServer(activeQ);
                const active = activeSnap.data().count;

                const revSnap = await getAggregateFromServer(collRef, {
                    totalRevenue: sum('globalStats.totalSpent')
                });
                const totalRevenue = revSnap.data().totalRevenue || 0;

                setStats({
                    total, active, totalRevenue, avgSpend: total > 0 ? totalRevenue / total : 0
                });
            } catch(err) {
                console.error("Stats error", err);
            }
        }
        fetchStats();
    }, []);

    const [allCustomers, setAllCustomers] = useState([]);

    // Fetch all customers on mount to avoid Firestore query constraints and index issues
    useEffect(() => {
        async function fetchAllCustomers() {
            setLoadingList(true);
            try {
                const snap = await getDocs(collection(db, 'customers'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAllCustomers(list);
            } catch (err) {
                console.error("Fetch all customers error", err);
            } finally {
                setLoadingList(false);
            }
        }
        fetchAllCustomers();
    }, []);

    // Filter customers locally based on query (case-insensitive substring match)
    useEffect(() => {
        const s = searchQuery.trim().toLowerCase();
        if (s.length >= 2) {
            const filtered = allCustomers.filter(c => {
                const name = (c.name || '').toLowerCase();
                const phone = (c.phone || '').toLowerCase();
                return name.includes(s) || phone.includes(s);
            });
            setLocalCustomers(filtered);
        } else {
            // Sort by totalSpent descending
            const sorted = [...allCustomers].sort((a, b) => {
                const spentA = a.globalStats?.totalSpent || 0;
                const spentB = b.globalStats?.totalSpent || 0;
                return spentB - spentA;
            }).slice(0, 50);
            setLocalCustomers(sorted);
        }
    }, [searchQuery, allCustomers]);

    const handleAddCustomer = async (e) => {
        e.preventDefault();
        if (!newCustomer.phone || newCustomer.phone.length < 10) return alert("Enter valid phone");
        const savedData = {
            name: newCustomer.name, 
            phone: newCustomer.phone, 
            dob: newCustomer.dob,
            anniversary: newCustomer.anniversary,
            globalStats: { totalVisits: 0, totalSpent: 0 }, 
            lastUpdated: new Date()
        };
        await setDoc(doc(db, 'customers', newCustomer.phone), savedData, { merge: true });
        setAllCustomers(prev => {
            const exists = prev.some(c => c.phone === newCustomer.phone);
            if (exists) {
                return prev.map(c => c.phone === newCustomer.phone ? { ...c, ...savedData } : c);
            }
            return [{ id: newCustomer.phone, ...savedData }, ...prev];
        });
        setNewCustomer({ name: '', phone: '', dob: '', anniversary: '' }); setShowAddForm(false);
    };

    const handleDeleteCustomer = async (phone, name) => {
        if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
        await deleteDoc(doc(db, 'customers', phone));
        setAllCustomers(prev => prev.filter(c => c.phone !== phone));
        if (selectedCustomer?.phone === phone) setSelectedCustomer(null);
    };

    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    return (
        <Layout>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[{ label: 'Total Clients', value: stats.total }, { label: 'Returning Clients', value: stats.active, color: '#10b981' }, { label: 'Total Revenue', value: fmt(stats.totalRevenue), color: 'var(--v2-primary)' }, { label: 'Avg. Spend', value: fmt(stats.avgSpend) }].map((s, i) => (
                    <div key={i} className="v2-card" style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>{s.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: s.color || 'var(--v2-text-main)' }}>{s.value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 240px)' }}>
                {/* LEFT: Customer List */}
                <div className="v2-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', gap: '0.75rem' }}>
                        <input type="text" placeholder="Search by name or phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-full)', outline: 'none', fontSize: '0.875rem' }} />
                        <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '0.6rem 1rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>+ Add</button>
                    </div>



                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loadingList ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading...</div> : localCustomers.map(c => (
                            <div key={c.phone} onClick={() => navigate(`/v2/customers/${c.phone}`)} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--v2-border)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{c.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{c.phone}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--v2-primary)' }}>{fmt(c.globalStats?.totalSpent)}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)' }}>{c.globalStats?.totalVisits || 0} visits</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Customer Detail */}
                <div className="v2-card" style={{ flex: 2, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!selectedCustomer ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v2-text-muted)', flexDirection: 'column', gap: '1rem' }}>
                            <span style={{ fontSize: '3rem', opacity: 0.5 }}>👥</span>
                            <span>Select a customer to view their profile & history</span>
                        </div>
                    ) : (
                        <>
                            {/* Profile Header */}
                            <div style={{ padding: '2rem', borderBottom: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800' }}>{selectedCustomer.name?.charAt(0)}</div>
                                    <div style={{ flex: 1 }}>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedCustomer.name}</h2>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--v2-text-muted)' }}>{selectedCustomer.phone} • Ref: {selectedCustomer.referralCode || '—'}</div>
                                    </div>
                                    <button onClick={() => handleDeleteCustomer(selectedCustomer.phone, selectedCustomer.name)} style={{ padding: '0.5rem 1rem', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Delete</button>
                                </div>

                                {/* Mini Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
                                    {[{ l: 'Total Spent', v: fmt(selectedCustomer.globalStats?.totalSpent) }, { l: 'Visits', v: selectedCustomer.globalStats?.totalVisits || 0 }, { l: 'Loyalty Points', v: selectedCustomer.loyaltyPoints || 0 }, { l: 'Pending Balance', v: fmt(selectedCustomer.pendingBalance || 0), c: (selectedCustomer.pendingBalance || 0) > 0 ? '#dc2626' : undefined }].map((s, i) => (
                                        <div key={i} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>{s.l}</div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: s.c || 'var(--v2-text-main)' }}>{s.v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Visit History */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Visit History</h3>
                                {loadingHistory ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading history...</div> : customerHistory.length === 0 ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No visit records found.</div> : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {customerHistory.map(visit => (
                                            <div key={visit.id} style={{ padding: '1rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', background: 'white' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{visit.timestamp?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}</div>
                                                    <div style={{ fontWeight: '800', color: 'var(--v2-primary)' }}>{fmt(visit.totalAmount)}</div>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)' }}>
                                                    {(visit.services || visit.items || []).map(s => s.name).join(', ') || '—'}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontWeight: '700', textTransform: 'uppercase' }}>{visit.paymentType || 'cash'}</span>
                                                    {visit.stylistName && <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#f3f4f6', color: '#4b5563', fontWeight: '600' }}>by {visit.stylistName}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            {/* Add Customer Modal */}
            {showAddForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="v2-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '1.5rem' }}>Add New Customer</h2>
                        <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>NAME</label>
                                <input type="text" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>PHONE</label>
                                <input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} required style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>DATE OF BIRTH</label>
                                <input type="date" value={newCustomer.dob} onChange={e => setNewCustomer({ ...newCustomer, dob: e.target.value })} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>ANNIVERSARY</label>
                                <input type="date" value={newCustomer.anniversary} onChange={e => setNewCustomer({ ...newCustomer, anniversary: e.target.value })} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '0.6rem 1.25rem', background: 'white', border: '1px solid var(--v2-border)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '0.6rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>Save Customer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
