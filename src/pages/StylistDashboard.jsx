import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, deleteDoc, doc, setDoc, serverTimestamp, arrayUnion, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useStoreRevenue } from '../hooks/useStoreRevenue';
import { useData } from '../context/DataProvider';

const CustomerProfileModal = ({ selectedCustomer, selectedStylist, loadingAppointments, customerAppointments, onClose }) => {
    if (!selectedCustomer) return null;
    const sData = selectedCustomer.stylistData?.[selectedStylist.id] || {};
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100,
            padding: '1rem'
        }}>
            <div className="card animate-fade-in" style={{ maxWidth: '450px', width: '100%', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.5 }}>&times;</button>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '50px', height: '50px', background: 'var(--text-primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', margin: '0 auto 1rem' }}>{selectedCustomer.name?.charAt(0).toUpperCase() || '?'}</div>
                    <h2 style={{ margin: 0, letterSpacing: '0.1em', fontSize: '1.2rem' }}>{selectedCustomer.name?.toUpperCase() || 'UNKNOWN CLIENT'}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{selectedCustomer.phone}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>MY VISITS</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800' }}>{sData.visits || 0}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>TOTAL SPENT</div>
                        <div style={{ fontSize: '1rem', fontWeight: '800' }}>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(sData.spent || 0)}</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--primary)', opacity: 0.9 }}>
                        <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: '0.5rem' }}>LOYALTY POINTS</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--primary)' }}>{selectedCustomer.loyaltyPoints || 0}</div>
                    </div>
                    <div style={{
                        background: (selectedCustomer.pendingBalance || 0) > 0 ? '#fff1f2' : '#f8fafc',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: 'center',
                        border: (selectedCustomer.pendingBalance || 0) > 0 ? '1px solid var(--danger)' : '1px solid #e2e8f0'
                    }}>
                        <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: (selectedCustomer.pendingBalance || 0) > 0 ? 'var(--danger)' : 'var(--text-secondary)', marginBottom: '0.5rem' }}>PENDING CREDIT</div>
                        <div style={{ fontSize: '1rem', fontWeight: '900', color: (selectedCustomer.pendingBalance || 0) > 0 ? 'var(--danger)' : 'inherit' }}>
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedCustomer.pendingBalance || 0)}
                        </div>
                    </div>
                </div>
                <div>
                    <h3 style={{ fontSize: '0.65rem', letterSpacing: '0.15em', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', fontWeight: '900' }}>VISIT HISTORY</h3>
                    {loadingAppointments ? (
                        <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.8rem' }}>Loading history...</div>
                    ) : customerAppointments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {customerAppointments.map(app => (
                                <div key={app.id} style={{ padding: '0.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <span style={{ fontWeight: '800' }}>{app.timestamp?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <span style={{ fontWeight: '900' }}>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(app.totalAmount || 0)}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{app.services?.map(s => s.name).join(', ')}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No history found for your profile</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function StylistDashboard() {
    const { currentUser, userRole, selectedStylist, selectStylist, logout } = useAuth();
    const navigate = useNavigate();
    const { loadingStylists, loadingAttendance, loadingCustomers, customers, ongoingSessions, stylists, attendance } = useData();

    // Revenue Data
    const { storeTotal: globalTotal, cashTotal: globalCash, cardTotal: globalCard, loading: loadingGlobal } = useStoreRevenue(null, true);
    const { storeTotal: personalSales, averageBill, loading: loadingPersonal } = useStoreRevenue(selectedStylist?.id, !!selectedStylist);
    const loadingStats = loadingGlobal || loadingPersonal;

    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loadingAppointments, setLoadingAppointments] = useState(false);
    const [customerAppointments, setCustomerAppointments] = useState([]);
    const [isPunching, setIsPunching] = useState(false);
    const [showPunchModal, setShowPunchModal] = useState(false);
    const [pendingStylist, setPendingStylist] = useState(null);

    // Quick Expense Logger
    const [expenseForm, setExpenseForm] = useState({ stylistId: '', description: '', amount: '', method: 'cash' });
    const [savingExpense, setSavingExpense] = useState(false);
    const [expenseSuccess, setExpenseSuccess] = useState(false);

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
            const q = query(collection(db, 'appointments'), where('customerId', '==', customer.id));
            const snap = await getDocs(q);
            const appointments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomerAppointments(appointments.sort((a, b) => b.timestamp - a.timestamp));
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAppointments(false);
        }
    };

    const handleStylistClick = (stylist) => {
        const record = (attendance || []).find(a => a.stylistId === stylist.id);
        const isClockedIn = record?.status === 'clocked-in' || record?.status === 'late-active';

        if (isClockedIn) {
            selectStylist(stylist);
        } else {
            setPendingStylist(stylist);
            setShowPunchModal(true);
        }
    };

    const handlePunchIn = async () => {
        if (!pendingStylist || isPunching) return;
        setIsPunching(true);
        const today = new Date().toLocaleDateString('en-CA');
        const docId = `${pendingStylist.id}_${today}`;
        try {
            await setDoc(doc(db, 'attendance', docId), {
                stylistId: pendingStylist.id,
                stylistName: pendingStylist.name,
                date: today,
                status: 'clocked-in',
                punches: arrayUnion({ type: 'in', timestamp: Date.now() }),
                lastUpdated: serverTimestamp()
            }, { merge: true });
            selectStylist(pendingStylist);
            setShowPunchModal(false);
            setPendingStylist(null);
        } catch (err) {
            console.error(err);
        } finally {
            setIsPunching(false);
        }
    };

    const handlePunchOut = async () => {
        if (!selectedStylist || isPunching) return;

        if (window.confirm("Are you sure you want to Punch Out? This will end your shift.")) {
            setIsPunching(true);
            const today = new Date().toLocaleDateString('en-CA');
            const docId = `${selectedStylist.id}_${today}`;
            try {
                await setDoc(doc(db, 'attendance', docId), {
                    status: 'clocked-out',
                    punches: arrayUnion({ type: 'out', timestamp: Date.now() }),
                    lastUpdated: serverTimestamp()
                }, { merge: true });

                selectStylist(null);
            } catch (err) {
                console.error("Punch out failed:", err);
            } finally {
                setIsPunching(false);
            }
        }
    };

    const handleQuickExpense = async (e) => {
        e.preventDefault();
        if (!expenseForm.description || !expenseForm.amount) return;
        setSavingExpense(true);
        try {
            const selectedStylistName = expenseForm.stylistId
                ? stylists.find(s => s.id === expenseForm.stylistId)?.name || 'Unknown'
                : null;
            await addDoc(collection(db, 'expenses'), {
                amount: parseFloat(expenseForm.amount),
                description: expenseForm.description,
                method: expenseForm.method,
                loggedByStylistId: expenseForm.stylistId || null,
                loggedByStylistName: selectedStylistName,
                date: Timestamp.now()
            });
            setExpenseForm({ stylistId: '', description: '', amount: '', method: 'cash' });
            setExpenseSuccess(true);
            setTimeout(() => setExpenseSuccess(false), 3000);
        } catch (err) {
            console.error('Quick expense error:', err);
            alert('Failed to log expense.');
        } finally {
            setSavingExpense(false);
        }
    };

    if (loadingStylists || loadingAttendance) return (
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>SYNCHRONIZING ATTENDANCE...</p>
        </div>
    );

    return (
        <div className="container">
            <header className="responsive-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.2em' }}>JX Saloon</h1>

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
                            onClick={() => navigate('/admin/services')}
                            className="btn-outline"
                            style={{ height: '2.5rem', fontSize: '0.7rem', border: '1px solid black' }}
                        >
                            ADMIN PANEL
                        </button>
                    )}
                    {selectedStylist && (
                        <>
                            <button
                                onClick={handlePunchOut}
                                className="btn-outline"
                                disabled={isPunching}
                                style={{
                                    height: '2.5rem',
                                    fontSize: '0.7rem',
                                    color: 'var(--danger)',
                                    borderColor: 'var(--danger)',
                                    opacity: isPunching ? 0.5 : 0.8
                                }}
                            >
                                {isPunching ? 'SYNCING...' : 'PUNCH OUT'}
                            </button>
                            <button
                                onClick={() => {
                                    selectStylist(null);
                                    // Optional: navigate home if needed, but selectStylist(null) should suffice
                                }}
                                className="btn-secondary"
                                style={{ height: '2.5rem', fontSize: '0.7rem' }}
                            >
                                SWITCH STYLIST
                            </button>
                        </>
                    )}
                    <button className="btn-danger" onClick={logout} style={{ height: '2.5rem', fontSize: '0.7rem' }}>LOGOUT</button>
                </div>
            </header>

            {!selectedStylist ? (
                <div className="animate-fade-in" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                    {/* Premium Header Summary - Reverted to single robust card */}
                    <div style={{
                        background: 'var(--text-primary)',
                        color: 'white',
                        padding: '3rem 2rem',
                        borderRadius: 'var(--radius-lg)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        boxShadow: 'var(--shadow-lg)',
                        marginBottom: '4rem',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', alignItems: 'center' }}>
                            <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%', marginRight: '0.5rem', boxShadow: '0 0 10px #4ade80' }}></span>
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.15em', opacity: 0.8 }}>LIVE</span>
                        </div>

                        <p style={{ color: 'white', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: '800', margin: '0 0 0.5rem 0', opacity: 0.7 }}>STUDIO REVENUE (TODAY)</p>
                        <h2 style={{ color: 'white', fontSize: '3.5rem', fontWeight: '900', margin: '0 0 1.5rem 0', letterSpacing: '-0.02em' }}>
                            {loadingStats ? '...' : formatCurrency(globalTotal)}
                        </h2>

                        <div className="responsive-stats-grid" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', opacity: 0.6, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>CASH</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(globalCash)}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', opacity: 0.6, letterSpacing: '0.1em', marginBottom: '0.3rem' }}>CARD/UPI</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(globalCard)}</div>
                            </div>
                        </div>
                    </div>


                    {/* 2-column grid: LEFT = Staff + Expense | RIGHT = Ongoing Services */}
                    <div className="responsive-grid-2col">
                        {/* LEFT: Stylist Selection */}
                        <div>
                            <div style={{ marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>STAFF LOGIN</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>SELECT PROFILE TO BEGIN</p>
                            </div>

                            <div className="responsive-grid-cards">
                                {stylists.map(s => {
                                    const record = (attendance || []).find(a => a.stylistId === s.id);
                                    const isClockedIn = record?.status === 'clocked-in' || record?.status === 'late-active';
                                    const isOngoing = ongoingSessions.some(os => os.stylistId === s.id);
                                    const isOnLeave = record?.status === 'leave';

                                    const getStatusConfig = () => {
                                        if (isOnLeave) return { color: '#3b82f6', label: 'ON LEAVE', opacity: 0.5 };
                                        if (isClockedIn) return { color: '#10b981', label: record?.status === 'late-active' ? 'LATE' : 'CLOCKED IN', opacity: 1 };
                                        return { color: '#64748b', label: 'CLOCKED OUT', opacity: 0.6 };
                                    };

                                    const status = getStatusConfig();

                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => handleStylistClick(s)}
                                            style={{
                                                height: '7.5rem',
                                                padding: '1.5rem',
                                                fontSize: '0.9rem',
                                                fontWeight: '900',
                                                borderRadius: 'var(--radius-lg)',
                                                border: `2px solid ${isOngoing ? 'var(--text-primary)' : (isClockedIn ? 'var(--text-primary)' : 'var(--border-color)')}`,
                                                background: isOngoing ? 'var(--text-primary)' : 'white',
                                                color: isOngoing ? 'white' : 'var(--text-primary)',
                                                position: 'relative',
                                                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                cursor: 'pointer',
                                                opacity: status.opacity,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                boxShadow: isOngoing ? '0 12px 24px -10px rgba(0,0,0,0.3)' : 'none',
                                                transform: 'translateY(0) scale(1)',
                                                zIndex: isOngoing ? 1 : 0
                                            }}
                                            onMouseOver={e => {
                                                e.currentTarget.style.transform = 'translateY(-10px) scale(1.05)';
                                                e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
                                                e.currentTarget.style.borderColor = 'var(--text-primary)';
                                            }}
                                            onMouseOut={e => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = isOngoing ? '0 12px 24px -10px rgba(0,0,0,0.3)' : 'none';
                                                e.currentTarget.style.borderColor = isClockedIn ? 'var(--text-primary)' : 'var(--border-color)';
                                            }}
                                        >
                                            <span style={{ fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{s.name}</span>

                                            {isOngoing && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '0.75rem',
                                                    right: '0.75rem',
                                                    width: '10px',
                                                    height: '10px',
                                                    background: '#10b981',
                                                    borderRadius: '50%',
                                                    boxShadow: '0 0 15px #10b981'
                                                }}></div>
                                            )}

                                            <div style={{
                                                fontSize: '0.55rem',
                                                letterSpacing: '0.15em',
                                                fontWeight: '900',
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '2rem',
                                                background: isOngoing ? 'rgba(255,255,255,0.15)' : `${status.color}15`,
                                                color: isOngoing ? 'white' : status.color,
                                                border: `1px solid ${isOngoing ? 'rgba(255,255,255,0.25)' : `${status.color}35`}`,
                                                textTransform: 'uppercase',
                                                marginTop: '0.5rem'
                                            }}>
                                                {status.label}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Collapsible Quick Expense Logger — Enhanced differentiation from profiles */}
                            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setExpenseForm(f => ({ ...f, _open: !f._open }))}
                                    className="glow-border-button"
                                    data-open={expenseForm._open}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1.2rem 1.5rem',
                                        background: expenseForm._open ? '#f8fafc' : '#f0f7ff', /* Always has a tint now */
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        fontFamily: 'var(--font-heading)',
                                        boxShadow: expenseForm._open ? '0 10px 20px rgba(0,0,0,0.05)' : '0 4px 10px rgba(0,0,0,0.02)'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '1.1rem' }}>💸</span>
                                        <span style={{ fontSize: '0.75rem', letterSpacing: '0.15em', fontWeight: '900', color: 'var(--text-primary)' }}>LOG STUDIO EXPENSE</span>
                                    </span>
                                    <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: expenseForm._open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                                </button>


                                {expenseForm._open && (
                                    <div style={{
                                        background: '#fafafa',
                                        border: '1.5px solid var(--border-color)',
                                        borderTop: 'none',
                                        borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                                        padding: '1.25rem',
                                        animation: 'fadeIn 0.2s ease',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                                    }}>
                                        {expenseSuccess && (
                                            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                                                ✓ Expense logged!
                                            </div>
                                        )}
                                        <form onSubmit={async (e) => {
                                            await handleQuickExpense(e);
                                            setExpenseForm(f => ({ ...f, _open: false }));
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                                <div style={{ gridColumn: '1 / -1' }}>
                                                    <label style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: '700' }}>LOGGED BY</label>
                                                    <select
                                                        value={expenseForm.stylistId}
                                                        onChange={e => setExpenseForm(f => ({ ...f, stylistId: e.target.value }))}
                                                        required
                                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', background: 'white', fontFamily: 'var(--font-main)' }}
                                                    >
                                                        <option value="">— Select Stylist —</option>
                                                        {stylists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ gridColumn: '1 / -1' }}>
                                                    <label style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: '700' }}>DESCRIPTION</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Housekeeping"
                                                        required
                                                        value={expenseForm.description}
                                                        onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', background: 'white', fontFamily: 'var(--font-main)' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: '700' }}>AMOUNT (₹)</label>
                                                    <input
                                                        type="number"
                                                        placeholder="0"
                                                        required
                                                        min="1"
                                                        value={expenseForm.amount}
                                                        onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', background: 'white', fontFamily: 'var(--font-main)' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: '700' }}>METHOD</label>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        {['cash', 'card'].map(m => (
                                                            <button key={m} type="button"
                                                                onClick={() => setExpenseForm(f => ({ ...f, method: m }))}
                                                                style={{
                                                                    flex: 1, padding: '0.6rem', fontSize: '0.6rem', letterSpacing: '0.08em', fontWeight: '800',
                                                                    border: '1px solid', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                                                    background: expenseForm.method === m ? 'var(--text-primary)' : 'white',
                                                                    color: expenseForm.method === m ? 'white' : 'var(--text-secondary)',
                                                                    borderColor: expenseForm.method === m ? 'var(--text-primary)' : 'var(--border-color)',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >{m.toUpperCase()}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <button type="submit" disabled={savingExpense} style={{
                                                width: '100%', padding: '0.7rem', fontSize: '0.68rem', letterSpacing: '0.1em', fontWeight: '800',
                                                background: 'var(--text-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-heading)', transition: 'opacity 0.2s'
                                            }}>
                                                {savingExpense ? 'LOGGING...' : '+ LOG EXPENSE'}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>


                            {/* Punch In Modal */}
                            {showPunchModal && pendingStylist && (
                                <div style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.8)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                                }}>
                                    <div className="card animate-scale-in" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Hello, {pendingStylist.name}</h3>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You are currently clocked out.</p>
                                        <button className="btn-primary" style={{ width: '100%', marginBottom: '1rem', height: '3.5rem' }} onClick={handlePunchIn} disabled={isPunching}>
                                            {isPunching ? 'PUNCHING IN...' : 'PUNCH IN & START'}
                                        </button>
                                        <button className="btn-outline" style={{ width: '100%', border: 'none' }} onClick={() => { setShowPunchModal(false); setPendingStylist(null); }}>CANCEL</button>
                                    </div>
                                </div>
                            )}
                        </div>{/* end LEFT column */}

                        {/* RIGHT: Ongoing Services Side Panel */}

                        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '3rem' }}>
                            <div style={{ marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>ONGOING SERVICES</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>LIVE STUDIO DASHBOARD</p>
                            </div>

                            <div style={{ display: 'grid', gap: '1rem' }}>
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
                                                onClick={() => { selectStylist(stylist); setTimeout(() => navigate('/booking/new'), 0); }}
                                                style={{
                                                    background: 'white', padding: '1.5rem',
                                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                                                    cursor: 'pointer', transition: 'transform 0.2s',
                                                    boxShadow: 'var(--shadow-sm)', position: 'relative'
                                                }}
                                                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
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

                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="card" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>CURRENT SESSION</p>
                            <h3 style={{ fontSize: '2rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedStylist.name}</h3>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/booking/new')} style={{ height: '4rem', padding: '0 2.5rem', fontSize: '0.9rem', flexShrink: 0 }}>
                            + NEW BOOKING
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                        <div className="card" style={{ borderLeft: '8px solid var(--primary)', overflowX: 'auto', minWidth: 0 }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>PERSONAL REVENUE</p>
                            <p style={{ fontSize: '2rem', fontWeight: '900', margin: '1rem 0', whiteSpace: 'nowrap' }}>
                                {loadingStats ? '...' : formatCurrency(personalSales)}
                            </p>
                        </div>
                        <div className="card" style={{ borderLeft: '8px solid var(--text-secondary)', overflowX: 'auto', minWidth: 0 }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>AVERAGE BILL</p>
                            <p style={{ fontSize: '2rem', fontWeight: '900', margin: '1rem 0', whiteSpace: 'nowrap' }}>
                                {loadingStats ? '...' : formatCurrency(averageBill)}
                            </p>
                        </div>
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

