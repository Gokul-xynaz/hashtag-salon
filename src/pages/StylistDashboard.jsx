import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, deleteDoc, doc, setDoc, serverTimestamp, arrayUnion, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useStoreRevenue } from '../hooks/useStoreRevenue';
import { useData } from '../context/DataProvider';

const CustomerProfileModal = ({ selectedCustomer, selectedStylist, loadingAppointments, customerAppointments, onClose }) => {
    if (!selectedCustomer) return null;
    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
    const allSD = selectedCustomer.stylistData || {};
    const totalVisits = Object.values(allSD).reduce((s, d) => s + (d.visits || 0), 0);
    const totalSpent = Object.values(allSD).reduce((s, d) => s + (d.spent || 0), 0);
    const last = customerAppointments.length > 0 ? customerAppointments[0] : null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '1rem' }} onClick={onClose}>
            <div className="card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: 0, borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
                {/* Gradient Header */}
                <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)', color: 'white', padding: '2.5rem 2rem 2rem', borderRadius: '20px 20px 0 0', position: 'relative' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                        <div style={{ width: '56px', height: '56px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '900', flexShrink: 0 }}>{selectedCustomer.name?.charAt(0).toUpperCase() || '?'}</div>
                        <div style={{ minWidth: 0 }}>
                            <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'white', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCustomer.name?.toUpperCase() || 'UNKNOWN'}</h2>
                            <p style={{ margin: '0.3rem 0 0', opacity: 0.7, fontSize: '0.85rem', letterSpacing: '0.05em' }}>{selectedCustomer.phone}</p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
                    {[
                        { label: 'VISITS', value: totalVisits },
                        { label: 'SPENT', value: fmt(totalSpent) },
                        { label: 'LOYALTY', value: selectedCustomer.loyaltyPoints || 0, color: 'var(--primary)' },
                        { label: 'CREDIT', value: fmt(selectedCustomer.pendingBalance), color: (selectedCustomer.pendingBalance || 0) > 0 ? 'var(--danger)' : undefined }
                    ].map((s, i) => (
                        <div key={i} style={{ padding: '1.2rem 0.5rem', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--border-color)' : 'none' }}>
                            <div style={{ fontSize: '0.55rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '700' }}>{s.label}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '900', color: s.color || 'var(--text-primary)' }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem 2rem 2rem' }}>
                    {/* Last Receipt */}
                    {last && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: '800' }}>LAST RECEIPT</h3>
                            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.2rem', border: '1px solid var(--border-color)', fontFamily: "'Courier New', monospace" }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                    <span>{last.timestamp?.toDate?.().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    <span>Styled by: {last.stylistName || 'N/A'}</span>
                                </div>
                                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.6rem' }}>
                                    {last.services?.map((s, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.2rem 0' }}>
                                            <span>{s.name}</span><span style={{ fontWeight: '700' }}>{fmt(s.price)}</span>
                                        </div>
                                    ))}
                                    {last.products?.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.2rem 0', color: 'var(--text-secondary)' }}>
                                            <span>{p.name} (x{p.quantity || 1})</span><span style={{ fontWeight: '700' }}>{fmt(p.price * (p.quantity || 1))}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.6rem', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', fontWeight: '900', fontSize: '0.85rem' }}>
                                    <span>TOTAL</span><span>{fmt(last.totalAmount)}</span>
                                </div>
                                {(last.serviceTax || last.retailTax) && (
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.3rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        {last.serviceTax ? <span>Svc GST: {fmt(last.serviceTax)}</span> : null}
                                        {last.retailTax ? <span>Retail GST: {fmt(last.retailTax)}</span> : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Service Timeline */}
                    <h3 style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: '800' }}>SERVICE HISTORY</h3>
                    {loadingAppointments ? (
                        <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading history...</div>
                    ) : customerAppointments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {customerAppointments.map(app => (
                                <div key={app.id} style={{ padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: '800', fontSize: '0.8rem' }}>{app.timestamp?.toDate?.().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <span style={{ fontWeight: '900', color: 'var(--primary)' }}>{fmt(app.totalAmount)}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginBottom: '0.3rem' }}>{app.services?.map(s => s.name).join(', ') || 'No services logged'}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: '700', letterSpacing: '0.05em' }}>
                                        ✂ {app.stylistName || 'Unknown Stylist'}
                                        {app.paymentMode && <span style={{ marginLeft: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600' }}>• {app.paymentMode}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)', background: '#f8fafc', borderRadius: '10px' }}>No visit history found for this client</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function StylistDashboard() {
    const { currentUser, userRole, selectedStylist, selectStylist, logout } = useAuth();
    const navigate = useNavigate();
    const { loadingStylists, loadingCustomers, customers, ongoingSessions, stylists } = useData();

    // Revenue Data
    const { storeTotal: globalTotal, cashTotal: globalCash, cardTotal: globalCard, loading: loadingGlobal } = useStoreRevenue(null, true);
    const { storeTotal: personalSales, averageBill, loading: loadingPersonal } = useStoreRevenue(selectedStylist?.id, !!selectedStylist);
    const loadingStats = loadingGlobal || loadingPersonal;

    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loadingAppointments, setLoadingAppointments] = useState(false);
    const [customerAppointments, setCustomerAppointments] = useState([]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    const filteredCustomers = customers?.filter(c => {
        const query = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(query) || c.phone.includes(query);
    }).slice(0, 8);

    const handleCustomerClick = async (customer) => {
        setSelectedCustomer(customer);
        setShowResults(false);
        setSearchQuery('');
        setLoadingAppointments(true);
        try {
            const q = query(collection(db, 'appointments'), where('customerId', '==', customer.id), orderBy('timestamp', 'desc'), limit(20));
            const snap = await getDocs(q);
            const appointments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCustomerAppointments(appointments);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAppointments(false);
        }
    };

    if (loadingStylists) return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>LOADING STYLISTS...</p>
        </div>
    );

    return (
        <div className="container">
            <header className="responsive-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.2em' }}>HASHTAG SALON</h1>

                    {/* Universal Search */}
                    {selectedStylist && (
                        <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Search Customers..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowResults(true);
                                    }}
                                    onFocus={() => setShowResults(true)}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 1rem 0.6rem 2.5rem',
                                        borderRadius: '2rem',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '0.8rem',
                                        background: '#f8fafc',
                                        letterSpacing: '0.05em'
                                    }}
                                />
                                <svg
                                    style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
                                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>

                            {/* Search Results Dropdown */}
                            {showResults && searchQuery.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '110%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    borderRadius: 'var(--radius-md)',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 1000,
                                    overflow: 'hidden',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {filteredCustomers.length > 0 ? (
                                        filteredCustomers.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleCustomerClick(c)}
                                                style={{
                                                    padding: '0.8rem 1rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #f1f5f9',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseOut={e => e.currentTarget.style.background = 'white'}
                                            >
                                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{c.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.phone}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            No matching clients found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="responsive-header-actions">
                    {useAuth().userRole?.toLowerCase() === 'admin' && (
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="btn-outline"
                            style={{ height: '2.5rem', fontSize: '0.7rem' }}
                        >
                            ADMIN PANEL
                        </button>
                    )}
                    {selectedStylist && (
                        <button
                            onClick={() => selectStylist(null)}
                            className="btn-secondary"
                            style={{ height: '2.5rem', fontSize: '0.7rem' }}
                        >
                            SWITCH STYLIST
                        </button>
                    )}
                    <button className="btn-danger" onClick={logout} style={{ height: '2.5rem', fontSize: '0.7rem' }}>LOGOUT</button>
                </div>
            </header>

            {!selectedStylist ? (
                <div className="animate-fade-in" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                    {/* Premium Header Summary - Bento Large */}
                    <div className="bento-grid">
                        <div className="bento-item bento-large" style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)',
                            color: 'white',
                            textAlign: 'left'
                        }}>
                            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', alignItems: 'center' }}>
                                <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', marginRight: '0.5rem', boxShadow: '0 0 10px #4ade80' }}></span>
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.15em', opacity: 0.8 }}>LIVE</span>
                            </div>

                            <p style={{ color: 'white', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: '800', margin: '0 0 0.5rem 0', opacity: 0.7 }}>STUDIO REVENUE (TODAY)</p>
                            <h2 style={{ color: 'white', fontSize: '3.5rem', fontWeight: '900', margin: '0 0 2rem 0', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                {loadingStats ? '...' : formatCurrency(globalTotal)}
                            </h2>

                            <div style={{ display: 'flex', gap: '2rem', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>CASH</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(globalCash)}</div>
                                </div>
                                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '2rem' }}>
                                    <div style={{ fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>CARD/UPI</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(globalCard)}</div>
                                </div>
                            </div>
                        </div>


                        {/* LEFT: Stylist Selection */}
                        <div className="bento-item bento-medium" style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>WHO IS WORKING?</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '2.5rem' }}>SELECT YOUR NAME TO START LOGGING BILLS</p>

                            <select
                                className="form-input"
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    fontSize: '0.9rem',
                                    fontWeight: '800',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-strong)',
                                    cursor: 'pointer',
                                    margin: 'auto 0 0',
                                    textAlign: 'center',
                                    textAlignLast: 'center',
                                    color: 'var(--primary)'
                                }}
                                onChange={(e) => {
                                    const stylist = stylists.find(s => s.id === e.target.value);
                                    if (stylist) selectStylist(stylist);
                                }}
                                value=""
                            >
                                <option value="" disabled>CHOOSE STYLIST</option>
                                {stylists.map(s => (
                                    <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        {/* RIGHT: Ongoing Services Side Panel */}
                        <div className="bento-item bento-medium" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>ONGOING SERVICES</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>LIVE STUDIO DASHBOARD</p>
                            </div>

                            <div style={{ display: 'grid', gap: '1rem', overflowY: 'auto' }}>
                                {ongoingSessions.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>No active services</p>
                                    </div>
                                ) : (
                                    ongoingSessions.map(os => {
                                        const stylist = stylists.find(s => s.id === os.stylistId);
                                        if (!stylist) return null;
                                        return (
                                            <div
                                                key={os.id}
                                                className="card"
                                                onClick={() => { selectStylist(stylist); setTimeout(() => navigate('/booking/new'), 0); }}
                                                style={{ cursor: 'pointer', padding: '1.5rem', margin: 0 }}
                                            >
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Delete ${os.stylistName}'s session?`)) {
                                                            try { await deleteDoc(doc(db, 'ongoing_sessions', os.stylistId)); }
                                                            catch (err) { console.error("Delete failed:", err); }
                                                        }
                                                    }}
                                                    style={{
                                                        position: 'absolute', top: '1.25rem', right: '1.25rem',
                                                        background: 'rgba(239,68,68,0.1)', border: 'none',
                                                        color: 'var(--danger)', cursor: 'pointer', padding: '0.6rem',
                                                        borderRadius: 'var(--radius-sm)', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s', zIndex: 2
                                                    }}
                                                    onMouseOver={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'white'; }}
                                                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'var(--danger)'; }}
                                                    title="Delete Session"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingRight: '3rem' }}>
                                                    <div>
                                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.25rem 0' }}>STYLIST</p>
                                                        <p style={{ fontWeight: '800', fontSize: '1rem' }}>{os.stylistName}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.25rem 0' }}>TIMER</p>
                                                        <p style={{ fontWeight: '900', fontSize: '1.2rem', fontFamily: 'monospace', color: os.timerActive ? 'var(--success)' : 'var(--text-secondary)' }}>
                                                            {(() => {
                                                                let d = os.seconds || 0;
                                                                if (os.timerActive && os.timerStartMs) d = (os.timerBaseSeconds || 0) + Math.floor((Date.now() - os.timerStartMs) / 1000);
                                                                return `${Math.floor(d / 60).toString().padStart(2, '0')}:${(d % 60).toString().padStart(2, '0')}`;
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.25rem 0' }}>CLIENT / SERVICE</p>
                                                    <p style={{ fontWeight: '700', fontSize: '0.85rem' }}>
                                                        {os.client?.name || 'Walk-in'}
                                                        <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>|</span>
                                                        {os.selectedServices?.length > 0 ? os.selectedServices.map(s => s.name).join(', ') : 'No services selected'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>{/* end RIGHT column */}

                    </div>{/* end 2-col grid */}

                    {/* Standalone Customer Search */}
                    <div style={{ marginTop: '2rem', position: 'relative', maxWidth: '500px', margin: '2rem auto 0' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search customer by name or phone..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                                onFocus={() => setShowResults(true)}
                                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                                style={{
                                    width: '100%', padding: '1rem 1rem 1rem 3rem',
                                    borderRadius: '16px', border: '1px solid var(--border-color)',
                                    fontSize: '0.9rem', background: 'rgba(255,255,255,0.9)',
                                    backdropFilter: 'blur(10px)', letterSpacing: '0.03em',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                                    fontFamily: 'var(--font-main)'
                                }}
                            />
                            <svg style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>
                        {showResults && searchQuery.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '110%', left: 0, right: 0,
                                background: 'white', borderRadius: '12px',
                                boxShadow: '0 15px 40px rgba(0,0,0,0.12)', zIndex: 1000,
                                overflow: 'hidden', border: '1px solid var(--border-color)'
                            }}>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(c => (
                                        <div key={c.id} onClick={() => handleCustomerClick(c)}
                                            style={{ padding: '0.9rem 1.2rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '0.8rem' }}
                                            onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '800', flexShrink: 0 }}>
                                                {c.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{c.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.phone}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ padding: '1.2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No matching clients found</div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            ) : (
                <div className="animate-fade-in bento-grid">
                    <div className="bento-item bento-large" style={{
                        background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '3rem'
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem', fontWeight: '800' }}>CURRENT SESSION</p>
                            <h3 style={{ fontSize: '3rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '900' }}>{selectedStylist.name}</h3>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/booking/new')} style={{ height: '4rem', padding: '0 2.5rem', fontSize: '1rem', flexShrink: 0, background: 'white', color: 'var(--primary)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            + NEW BOOKING
                        </button>
                    </div>

                    <div className="bento-item bento-medium">
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>PERSONAL REVENUE (TODAY)</p>
                        <p style={{ fontSize: '2.5rem', fontWeight: '900', margin: '1rem 0', whiteSpace: 'nowrap', color: 'var(--success)' }}>
                            {loadingStats ? '...' : formatCurrency(personalSales)}
                        </p>
                    </div>

                    <div className="bento-item bento-medium" style={{ background: 'var(--bg-secondary)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>YOUR AVERAGE TICKET</p>
                        <p style={{ fontSize: '2.5rem', fontWeight: '900', margin: '1rem 0', whiteSpace: 'nowrap' }}>
                            {loadingStats ? '...' : formatCurrency(averageBill)}
                        </p>
                    </div>
                </div>
            )}
            {/* Customer Profile Modal */}
            {selectedCustomer && (
                <CustomerProfileModal
                    selectedCustomer={selectedCustomer}
                    selectedStylist={selectedStylist}
                    loadingAppointments={loadingAppointments}
                    customerAppointments={customerAppointments}
                    onClose={() => setSelectedCustomer(null)}
                />
            )}
        </div>
    );
}

