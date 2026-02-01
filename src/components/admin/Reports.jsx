import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function Reports() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'today'
    const [stylists, setStylists] = useState([]);

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
            const appointmentsRef = collection(db, 'appointments');
            let q = query(appointmentsRef, orderBy('timestamp', 'desc'));

            const snapshot = await getDocs(q);
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 1. Time Presets
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (filter === 'today') {
                data = data.filter(item => item.timestamp?.toDate() >= today);
            }

            // 2. Custom Date Range
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                data = data.filter(item => item.timestamp?.toDate() >= start);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                data = data.filter(item => item.timestamp?.toDate() <= end);
            }

            // 3. Stylist Filter
            if (selectedStylistId !== 'all') {
                data = data.filter(item => item.stylistId === selectedStylistId);
            }

            setAppointments(data);
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
        if (!mins) return '-';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="card" style={{ padding: '2.5rem' }}>
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
                <div style={{ overflowX: 'auto' }} className="animate-fade-in">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--text-primary)' }}>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>TIMESTAMP</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>EXECUTED BY</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>CLIENT IDENTITY</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>SERVICES RENDERED</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>DURATION</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem', letterSpacing: '0.15em' }}>REVENUE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(app => (
                                <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>
                                            {app.timestamp ? app.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            {app.timestamp ? app.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>{app.stylistName?.toUpperCase() || 'UNKNOWN'}</span>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{app.clientName}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{app.clientPhone}</div>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineWeight: '1.4' }}>
                                            {app.services.map(s => s.name).join(', ')}
                                            {app.services.length > 3 && '...'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{formatDuration(app.durationMinutes)}</span>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                                        <span style={{ fontWeight: '900', fontSize: '1.1rem' }}>{formatCurrency(app.totalAmount)}</span>
                                    </td>
                                </tr>
                            ))}
                            {appointments.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>NO RECORDS FOUND FOR SELECTED CRITERIA.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
