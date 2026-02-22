import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import AiAnalytics from './AiAnalytics';

export default function Reports() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'today'
    const [stylists, setStylists] = useState([]);
    const [activeTab, setActiveTab] = useState('logs'); // 'logs', 'ai'

    // Detailed Filters
    const [selectedStylistId, setSelectedStylistId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchDropdowns = async () => {
            const q = query(collection(db, 'users'), where('role', '==', 'stylist'));
            const snap = await getDocs(q);
            setStylists(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchDropdowns();
    }, []);

    useEffect(() => {
        fetchReports();
    }, [filter, selectedStylistId, startDate, endDate]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            // 1. Fetch Appointments (Sales)
            const appointmentsRef = collection(db, 'appointments');
            let qAppointments = query(appointmentsRef, orderBy('timestamp', 'desc'));
            const snapAppointments = await getDocs(qAppointments);
            let salesData = snapAppointments.docs.map(doc => ({ id: doc.id, type: 'sale', ...doc.data() }));

            // 2. Fetch Expenses (Costs)
            const expensesRef = collection(db, 'expenses');
            let qExpenses = query(expensesRef, orderBy('date', 'desc'));
            const snapExpenses = await getDocs(qExpenses);
            let expenseData = snapExpenses.docs.map(doc => ({ id: doc.id, type: 'expense', ...doc.data() }));

            // 3. Normalize Timestamps for sorting and filtering
            const normalizedExpenses = expenseData.map(exp => ({
                ...exp,
                timestamp: exp.date // Expenses use 'date' field, map it to 'timestamp' for unified filtering
            }));

            // Combine and sort
            let combinedData = [...salesData, ...normalizedExpenses].sort((a, b) => {
                const dateA = a.timestamp?.toDate() || new Date(0);
                const dateB = b.timestamp?.toDate() || new Date(0);
                return dateB - dateA; // Descending
            });

            // 4. Time Presets Filter
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (filter === 'today') {
                combinedData = combinedData.filter(item => item.timestamp?.toDate() >= today);
            } else if (filter === 'yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                combinedData = combinedData.filter(item => {
                    const d = item.timestamp?.toDate();
                    return d >= yesterday && d < today;
                });
            } else if (filter === 'this_week') {
                const day = today.getDay(); // 0 (Sun) to 6 (Sat)
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - day);
                combinedData = combinedData.filter(item => item.timestamp?.toDate() >= startOfWeek);
            } else if (filter === 'this_month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                combinedData = combinedData.filter(item => item.timestamp?.toDate() >= startOfMonth);
            } else if (filter === 'last_month') {
                const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                combinedData = combinedData.filter(item => {
                    const d = item.timestamp?.toDate();
                    return d >= startOfLastMonth && d <= endOfLastMonth;
                });
            }

            // 5. Custom Date Range Filter
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                combinedData = combinedData.filter(item => item.timestamp?.toDate() >= start);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                combinedData = combinedData.filter(item => item.timestamp?.toDate() <= end);
            }

            // 6. Stylist Filter (Only applies to sales, expenses are store-wide)
            if (selectedStylistId !== 'all') {
                combinedData = combinedData.filter(item => item.type === 'expense' || item.stylistId === selectedStylistId);
            }

            setAppointments(combinedData);
        } catch (error) {
            console.error("Error loading reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    const formatDuration = (mins) => {
        if (mins === 0) return '0m';
        if (!mins) return '-';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="card" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.1rem' }}>
                <button
                    onClick={() => setActiveTab('logs')}
                    style={{
                        padding: '1rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        letterSpacing: '0.15em',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'logs' ? '3px solid var(--text-primary)' : '3px solid transparent',
                        color: activeTab === 'logs' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                >
                    TRANSACTION LOGS
                </button>
                <button
                    onClick={() => setActiveTab('ai')}
                    style={{
                        padding: '1rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        letterSpacing: '0.15em',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'ai' ? '3px solid var(--text-primary)' : '3px solid transparent',
                        color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.3s'
                    }}
                >
                    AI ANALYTICS <span style={{ fontSize: '0.6rem', background: 'var(--text-primary)', color: 'white', padding: '2px 6px', borderRadius: '3px' }}>PREMIUM</span>
                </button>
            </div>

            {activeTab === 'ai' ? (
                <AiAnalytics appointments={appointments} />
            ) : (
                <>
                    <div style={{ marginBottom: '3rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.1em', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>ADVANCED ANALYTICS & LOGS</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <div>
                                <label className="form-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>TIME PRESET</label>
                                <select
                                    value={filter}
                                    onChange={e => {
                                        setFilter(e.target.value);
                                        if (e.target.value !== 'all') { setStartDate(''); setEndDate(''); }
                                    }}
                                    className="form-input"
                                    style={{ height: '3rem', fontSize: '0.85rem' }}
                                >
                                    <option value="all">ALL TIME</option>
                                    <option value="today">TODAY</option>
                                    <option value="yesterday">YESTERDAY</option>
                                    <option value="this_week">THIS WEEK</option>
                                    <option value="this_month">THIS MONTH</option>
                                    <option value="last_month">LAST MONTH</option>
                                </select>
                            </div>

                            <div>
                                <label className="form-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>STYLIST PROFILE</label>
                                <select
                                    value={selectedStylistId}
                                    onChange={e => setSelectedStylistId(e.target.value)}
                                    className="form-input"
                                    style={{ height: '3rem', fontSize: '0.85rem' }}
                                >
                                    <option value="all">ALL STYLISTS</option>
                                    {stylists.map(s => (
                                        <option key={s.id} value={s.id}>{(s.name || 'Unknown').toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>BEGIN DATE</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={startDate}
                                    onChange={e => { setStartDate(e.target.value); setFilter('all'); }}
                                    style={{ height: '3rem', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div>
                                <label className="form-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em' }}>END DATE</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={endDate}
                                    onChange={e => { setEndDate(e.target.value); setFilter('all'); }}
                                    style={{ height: '3rem', fontSize: '0.85rem' }}
                                />
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>COMPILING DATA...</p>
                    ) : (
                        <div className="animate-fade-in">
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--text-primary)' }}>
                                            <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>TIMESTAMP</th>
                                            <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>EXECUTED BY</th>
                                            <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>CLIENT IDENTITY</th>
                                            <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>SERVICES RENDERED</th>
                                            <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>RETAIL SALES</th>
                                            <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>DURATION</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem', letterSpacing: '0.15em' }}>TOTAL REVENUE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments.map(app => (
                                            <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: app.type === 'expense' ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                                                <td style={{ padding: '1.5rem 1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>
                                                            {app.timestamp ? app.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                                        </div>
                                                        {app.createdTimestamp && app.timestamp && (
                                                            (() => {
                                                                const t1 = app.timestamp.toDate();
                                                                const t2 = app.createdTimestamp.toDate();
                                                                const isModified = t1.getFullYear() !== t2.getFullYear() ||
                                                                    t1.getMonth() !== t2.getMonth() ||
                                                                    t1.getDate() !== t2.getDate();
                                                                return isModified ? (
                                                                    <span title="Bill date was modified" style={{ color: '#22c55e', fontSize: '1.2rem', lineHeight: 1, cursor: 'help' }}>●</span>
                                                                ) : null;
                                                            })()
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                                        {app.timestamp ? app.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem' }}>
                                                    {app.type === 'expense' ? (
                                                        <span style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--danger)' }}>STORE ADMIN</span>
                                                    ) : (
                                                        <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>{app.stylistName?.toUpperCase() || 'UNKNOWN'}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem' }}>
                                                    {app.type === 'expense' ? (
                                                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--danger)' }}>STORE EXPENSE</div>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{app.clientName}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{app.clientPhone}</div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem' }}>
                                                    {app.type === 'expense' ? (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontStyle: 'italic' }}>
                                                            {app.description} ({app.method?.toUpperCase()})
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                            {app.services?.map(s => s.name).join(', ')}
                                                            {app.services?.length > 3 && '...'}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem' }}>
                                                    {app.type === 'expense' ? (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                                                    ) : app.retailRevenue > 0 ? (
                                                        <>
                                                            <div style={{ fontWeight: '800', color: 'var(--primary)' }}>+{formatCurrency(app.retailRevenue)}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                                {app.retailItems?.map(i => `${i.qty}x ${i.name}`).join(', ')}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem' }}>
                                                    {app.type === 'expense' ? (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{formatDuration(app.durationMinutes)}</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                                                    {app.type === 'expense' ? (
                                                        <span style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--danger)' }}>-{formatCurrency(app.amount)}</span>
                                                    ) : (
                                                        <span style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--success)' }}>+{formatCurrency(app.totalAmount)}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {appointments.length === 0 && (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>NO RECORDS FOUND FOR SELECTED CRITERIA.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {appointments.length > 0 && (
                                        <tfoot style={{ background: 'var(--bg-secondary)', fontWeight: '900' }}>
                                            <tr>
                                                <td colSpan="5" style={{ padding: '1.5rem 1rem', textAlign: 'right', fontSize: '0.8rem', letterSpacing: '0.1em' }}>TOTALS FOR SELECTION:</td>
                                                <td style={{ padding: '1.5rem 1rem', fontSize: '0.9rem' }}>
                                                    {formatDuration(appointments.reduce((sum, app) => sum + (app.durationMinutes || 0), 0))}
                                                </td>
                                                <td style={{ padding: '1.5rem 1rem', textAlign: 'right', fontSize: '1.2rem', color: appointments.reduce((sum, app) => app.type === 'expense' ? sum - (app.amount || 0) : sum + (app.totalAmount || 0), 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {formatCurrency(appointments.reduce((sum, app) => {
                                                        if (app.type === 'expense') {
                                                            return sum - parseFloat(app.amount || 0);
                                                        }
                                                        return sum + parseFloat(app.totalAmount || 0);
                                                    }, 0))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
