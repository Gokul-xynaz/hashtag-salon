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
    const [selectedBill, setSelectedBill] = useState(null);

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

    const handleExportExcel = () => {
        if (appointments.length === 0) {
            alert("No data available to export.");
            return;
        }

        const headers = ['Date', 'Type', 'Client/Desc', 'Stylist', 'Services', 'Service_Revenue', 'Service_Tax', 'Retail', 'Retail_Revenue', 'Retail_Tax', 'Method', 'Total_Amount'];
        const csvRows = [headers.join(',')];

        appointments.forEach(app => {
            const dateStr = app.timestamp ? `"${app.timestamp.toDate().toLocaleString('en-IN')}"` : '"N/A"';
            if (app.type === 'expense') {
                csvRows.push([
                    dateStr,
                    '"Expense"',
                    `"${app.description || ''}"`,
                    '"STORE_ADMIN"',
                    '"-"',
                    '0',
                    '0',
                    '"-"',
                    '0',
                    '0',
                    `"${app.method?.toUpperCase() || ''}"`,
                    `-${app.amount || 0}`
                ].join(','));
            } else {
                csvRows.push([
                    dateStr,
                    '"Sale"',
                    `"${app.clientName} (${app.clientPhone})"`,
                    `"${app.stylistName}"`,
                    `"${app.services?.map(s => s.name).join('; ') || '-'}"`,
                    `${app.serviceRevenue || 0}`,
                    `${app.serviceTax || 0}`,
                    `"${app.retailItems?.map(r => `${r.qty}x ${r.name}`).join('; ') || '-'}"`,
                    `${app.retailRevenue || 0}`,
                    `${app.retailTax || 0}`,
                    `"${app.paymentType?.toUpperCase() || ''}"`,
                    `${app.totalAmount || 0}`
                ].join(','));
            }
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Hashtag_Salon_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                    <button
                        onClick={handleExportExcel}
                        className="btn-primary"
                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        EXCEL EXPORT
                    </button>
                </div>
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
                                                        <>
                                                            <span style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--success)', display: 'block' }}>+{formatCurrency(app.totalAmount)}</span>
                                                            <button
                                                                onClick={() => setSelectedBill(app)}
                                                                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.65rem', marginTop: '0.5rem', cursor: 'pointer', fontWeight: '800' }}
                                                            >
                                                                PRINT BILL
                                                            </button>
                                                        </>
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

            {/* Printable Receipt Modal */}
            {selectedBill && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '2rem'
                }}>
                    <div className="card animate-scale-in" style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Historical Receipt</h2>

                        <div id="receipt-print-area" style={{ textAlign: 'left', padding: '2rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '2rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '1px dashed black', paddingBottom: '1rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', textTransform: 'uppercase', color: 'black' }}>HASHTAG SALON</h3>
                                <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', fontWeight: '800', color: 'black' }}>Professional Studio</p>
                                <p style={{ margin: '0.4rem auto', fontSize: '0.7rem', lineHeight: '1.4', maxWidth: '250px', color: 'black' }}>
                                    376, 3A1, Rabindranath Tagore Rd, Maniyakarampalayam, Manikarampalayam, Ganapathy, Coimbatore, Tamil Nadu 641006
                                </p>
                                <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', fontWeight: '800', color: 'black' }}>Ph: +91 9629180431</p>
                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', fontWeight: '800', color: 'black' }}>GSTIN: 33ABCDE1234F1Z5</p>
                            </div>

                            <div style={{ padding: '0 0.5rem', marginBottom: '1rem', fontSize: '0.8rem', lineHeight: '1.6', color: 'black' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontWeight: '900', marginBottom: '0.25rem' }}>BILL TO:</div>
                                        <div>{selectedBill.clientName}</div>
                                        <div>{selectedBill.clientPhone || 'N/A'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: '900', marginBottom: '0.25rem' }}>INVOICE DETAILS:</div>
                                        <div>{selectedBill.timestamp ? selectedBill.timestamp.toDate().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</div>
                                        <div>Pay Mode: {selectedBill.paymentType?.toUpperCase() || 'CASH'}</div>
                                        <div>Styled By: {selectedBill.stylistName}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ borderTop: '2px solid black', borderBottom: '2px solid black', padding: '1rem 0', margin: '1rem 0', color: 'black' }}>
                                {selectedBill.services?.map((s, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <span>{s.name}</span>
                                        <span>{formatCurrency(s.price - (s.price * ((s.discount || 0) / 100)))}</span>
                                    </div>
                                ))}
                                {selectedBill.retailItems?.map((r, idx) => (
                                    <div key={`r-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <span>{r.name} x{r.qty}</span>
                                        <span>{formatCurrency(r.price * r.qty)}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: 'black' }}>
                                <span>Subtotal:</span>
                                <span>{formatCurrency(selectedBill.subtotal || 0)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: 'black' }}>
                                <span>Service GST (5%):</span>
                                <span>{formatCurrency(selectedBill.serviceTax || 0)}</span>
                            </div>
                            {(selectedBill.retailTax || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: 'black' }}>
                                    <span>Retail GST (18%):</span>
                                    <span>{formatCurrency(selectedBill.retailTax || 0)}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '2px solid black', fontWeight: 'bold', fontSize: '1rem', color: 'black' }}>
                                <span>TOTAL:</span>
                                <span>{formatCurrency(selectedBill.totalAmount || 0)}</span>
                            </div>

                            <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', opacity: 0.7, color: 'black' }}>
                                <p>Thank you for visiting Hashtag Salon!</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button className="btn-outline" onClick={() => {
                                const printContents = document.getElementById('receipt-print-area').innerHTML;
                                const originalContents = document.body.innerHTML;
                                document.body.innerHTML = printContents;
                                window.print();
                                document.body.innerHTML = originalContents;
                                window.location.reload();
                            }}>
                                PRINT RECEIPT
                            </button>
                            <button className="btn-primary" onClick={() => setSelectedBill(null)}>
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
