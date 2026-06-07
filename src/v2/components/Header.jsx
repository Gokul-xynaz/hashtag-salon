import { useAuth } from '../../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../context/DataProvider';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function Header() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { customers, stylists } = useData();

    const [searchQuery, setSearchQuery] = useState('');
    const [allRecords, setAllRecords] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);
    const [showNotifs, setShowNotifs] = useState(false);
    const notifRef = useRef(null);

    // Fetch recent appointments for global search
    useEffect(() => {
        const q = query(collection(db, 'appointments'), orderBy('timestamp', 'desc'), limit(500));
        const unsub = onSnapshot(q, snap => setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, []);

    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const searchResults = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (q.length < 2) return [];
        const results = [];

        (customers || []).forEach(c => {
            if ((c.name || '').toLowerCase().includes(q) || String(c.phone || '').includes(q)) {
                results.push({ type: 'customer', icon: '👤', label: c.name, sub: String(c.phone || ''), action: () => navigate(`/v2/customers/${c.id}`) });
            }
        });

        // Search stylists
        (stylists || []).forEach(s => {
            if ((s.name || '').toLowerCase().includes(q)) {
                results.push({ type: 'staff', icon: '✂️', label: s.name, sub: s.role || 'Stylist', action: () => navigate('/v2/staff') });
            }
        });

        // Search appointments
        allRecords.filter(r =>
            (r.clientName || '').toLowerCase().includes(q) ||
            String(r.clientPhone || '').includes(q) ||
            (r.stylistName || '').toLowerCase().includes(q) ||
            (r.services || r.items || []).some(s => (s.name || '').toLowerCase().includes(q))
        ).slice(0, 5).forEach(r => {
            results.push({
                type: 'record', icon: '🧾',
                label: r.clientName || 'Walk-in',
                sub: `${r.timestamp?.toDate?.()?.toLocaleDateString('en-IN') || ''} · ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(r.totalAmount || 0)}`,
                action: () => navigate('/v2/reports')
            });
        });

        return results.slice(0, 10);
    }, [searchQuery, customers, stylists, allRecords, navigate]);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path.includes('dashboard')) return 'Dashboard';
        if (path.includes('pos')) return 'Point of Sale';
        if (path.includes('calendar')) return 'Calendar';
        if (path.includes('staff')) return 'Manage Staff';
        if (path.includes('inventory')) return 'Inventory & Stock';
        if (path.includes('customers')) return 'Customers';
        if (path.includes('reports')) return 'Reports';
        if (path.includes('settings')) return 'Settings';
        return 'Overview';
    };

    return (
        <header className="v2-header">
            <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'var(--v2-text-main)' }}>
                    {getPageTitle()}
                </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* GLOBAL SEARCH */}
                <div ref={searchRef} style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search clients, staff, bills…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
                        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                        style={{ padding: '0.5rem 1rem 0.5rem 2.25rem', borderRadius: 'var(--v2-radius-full)', border: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)', fontSize: '0.875rem', width: '260px', outline: 'none' }}
                    />
                    {showResults && searchResults.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'white', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', boxShadow: 'var(--v2-shadow-md)', zIndex: 9999, overflow: 'hidden', minWidth: '300px' }}>
                            {searchResults.map((r, i) => (
                                <div key={i} onClick={() => { r.action(); setShowResults(false); setSearchQuery(''); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--v2-border)', transition: 'background 0.1s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--v2-bg-main)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--v2-text-muted)' }}>{r.sub}</div>
                                    </div>
                                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--v2-bg-main)', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', flexShrink: 0 }}>{r.type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'white', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', boxShadow: 'var(--v2-shadow-md)', zIndex: 9999, padding: '1rem', textAlign: 'center', color: 'var(--v2-text-muted)', fontSize: '0.85rem' }}>
                            No results for "{searchQuery}"
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button 
                        onClick={() => setShowNotifs(!showNotifs)}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--v2-border)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        {allRecords.filter(r => r.source === 'online_widget' && r.status === 'pending').length > 0 && (
                            <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', width: '8px', height: '8px', borderRadius: '50%' }}></span>
                        )}
                    </button>
                    
                    {showNotifs && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '320px', background: 'white', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', boxShadow: 'var(--v2-shadow-md)', zIndex: 9999, overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--v2-border)', fontWeight: '700', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Notifications
                                <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', fontWeight: '500' }}>
                                    {allRecords.filter(r => r.source === 'online_widget' && r.status === 'pending').length} New
                                </span>
                            </div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {allRecords.filter(r => r.source === 'online_widget' && r.status === 'pending').length === 0 ? (
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--v2-text-muted)', fontSize: '0.85rem' }}>No new notifications</div>
                                ) : (
                                    allRecords.filter(r => r.source === 'online_widget' && r.status === 'pending').map(booking => (
                                        <div key={booking.id} onClick={() => { navigate('/v2/calendar'); setShowNotifs(false); }} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--v2-border)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--v2-bg-main)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369a1', flexShrink: 0 }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--v2-text-main)' }}>New Online Booking</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--v2-text-muted)', marginTop: '0.15rem' }}>
                                                        {booking.clientName} booked for {booking.timestamp?.toDate?.().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div style={{ padding: '0.5rem', textAlign: 'center', background: 'var(--v2-bg-main)' }}>
                                <button onClick={() => { navigate('/v2/calendar'); setShowNotifs(false); }} style={{ border: 'none', background: 'transparent', color: 'var(--v2-primary)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>View Calendar</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </header>
    );
}
