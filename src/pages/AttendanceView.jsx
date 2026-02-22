import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useData } from '../context/DataProvider';

export default function AttendanceView() {
    const { stylists, settings } = useData();
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [viewMode, setViewMode] = useState('daily'); // 'daily', 'history', or 'calendar'
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [historyRecords, setHistoryRecords] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (viewMode === 'daily') {
            loadDailyAttendance();
        } else {
            loadHistoryAttendance();
        }
    }, [selectedDate, stylists, viewMode]);

    const loadDailyAttendance = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'attendance'), where('date', '==', selectedDate));
            const snapshot = await getDocs(q);
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const merged = stylists.map(stylist => {
                const record = records.find(r => r.stylistId === stylist.id);
                let status = record?.status || 'absent';

                // Late Detection Logic
                if (status === 'clocked-in' || status === 'clocked-out') {
                    const firstIn = record.punches.find(p => p.type === 'in')?.timestamp;
                    if (firstIn && settings.shiftStartTime) {
                        const [hours, minutes] = settings.shiftStartTime.split(':').map(Number);
                        const shiftStart = new Date(firstIn);
                        shiftStart.setHours(hours, minutes, 0, 0);

                        const graceMs = (settings.gracePeriod || 0) * 60 * 1000;
                        if (firstIn > shiftStart.getTime() + graceMs) {
                            status = status === 'clocked-in' ? 'late-active' : 'late';
                        }
                    }
                }

                return {
                    stylistId: stylist.id,
                    stylistName: stylist.name,
                    status,
                    punches: record?.punches || [],
                    breakDurationMs: record?.breakDurationMs || 0,
                    totalDurationMs: record?.totalDurationMs || 0
                };
            });

            setAttendanceRecords(merged);
        } catch (err) {
            console.error("Failed to load attendance:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryAttendance = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'attendance'), orderBy('date', 'desc'));
            const snapshot = await getDocs(q);
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistoryRecords(records);
        } catch (err) {
            console.error("Failed to load history:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkLeave = async (stylistId, stylistName) => {
        if (window.confirm(`Mark ${stylistName} as on leave for ${selectedDate}?`)) {
            const docId = `${stylistId}_${selectedDate}`;
            try {
                await setDoc(doc(db, 'attendance', docId), {
                    stylistId,
                    stylistName,
                    date: selectedDate,
                    status: 'leave',
                    punches: [],
                    lastUpdated: serverTimestamp()
                }, { merge: true });

                loadDailyAttendance();
            } catch (err) {
                console.error("Failed to mark leave:", err);
            }
        }
    };

    const calculateDuration = (punches) => {
        if (!punches || punches.length === 0) return '0h 0m';

        let totalMs = 0;
        let currentIn = null;

        punches.forEach(punch => {
            if (punch.type === 'in') {
                currentIn = punch.timestamp;
            } else if (punch.type === 'out' && currentIn) {
                totalMs += (punch.timestamp - currentIn);
                currentIn = null;
            }
        });

        if (currentIn) {
            totalMs += (Date.now() - currentIn);
        }

        const hours = Math.floor(totalMs / (1000 * 60 * 60));
        const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    };

    const getStatusBadge = (status) => {
        const styles = {
            'clocked-in': { bg: '#4ade80', text: 'white', label: 'ACTIVE' },
            'late-active': { bg: '#8b5cf6', text: 'white', label: 'LATE ACTIVE' },
            'clocked-out': { bg: '#fbbf24', text: 'white', label: 'CLOCKED OUT' },
            'late': { bg: '#f97316', text: 'white', label: 'LATE' },
            'absent': { bg: '#ef4444', text: 'white', label: 'ABSENT' },
            'leave': { bg: '#3b82f6', text: 'white', label: 'LEAVE' }
        };

        const style = styles[status] || styles.absent;

        return (
            <span style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.7rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                background: style.bg,
                color: style.text
            }}>
                {status === 'clocked-in' ? 'ACTIVE' : status.toUpperCase().replace('-', ' ')}
            </span>
        );
    };

    const CalendarView = () => {
        const [monthData, setMonthData] = useState([]);
        const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
        const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

        useEffect(() => {
            const loadMonth = async () => {
                const start = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;
                const end = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-31`;
                const q = query(collection(db, 'attendance'), where('date', '>=', start), where('date', '<=', end));
                const snapshot = await getDocs(q);
                setMonthData(snapshot.docs.map(doc => doc.data()));
            };
            loadMonth();
        }, [currentMonth, currentYear]);

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
            <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h3 style={{ margin: 0 }}>{new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' })} {currentYear}</h3>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn-outline" onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} style={{ padding: '0.5rem' }}>←</button>
                        <button className="btn-outline" onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} style={{ padding: '0.5rem' }}>→</button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.5rem', background: 'var(--bg-secondary)' }}>STYLIST</th>
                                {days.map(d => (
                                    <th key={d} style={{ textAlign: 'center', padding: '0.5rem', minWidth: '30px', background: 'var(--bg-secondary)' }}>{d}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {stylists.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.5rem', fontWeight: '800' }}>{s.name}</td>
                                    {days.map(d => {
                                        const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                                        const record = monthData.find(r => r.stylistId === s.id && r.date === dateStr);
                                        let color = '#f3f4f6';
                                        if (record?.status === 'clocked-in' || record?.status === 'clocked-out') color = '#4ade80';
                                        if (record?.status?.includes('late')) color = '#f97316'; // Orange for late
                                        if (record?.status === 'leave') color = '#3b82f6';
                                        if (record?.status === 'absent') color = '#ef4444';

                                        return (
                                            <td key={d} style={{ padding: '2px' }}>
                                                <div style={{
                                                    height: '20px',
                                                    background: color,
                                                    borderRadius: '4px',
                                                    title: record?.status || 'No Data'
                                                }}></div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', fontSize: '0.7rem', fontWeight: '800' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', background: '#4ade80', borderRadius: '2px' }}></div> WORKED
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', background: '#f97316', borderRadius: '2px' }}></div> LATE
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></div> LEAVE
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></div> ABSENT
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', background: '#f3f4f6', borderRadius: '2px' }}></div> NO DATA
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0 }}>Attendance Management</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className={viewMode === 'daily' ? "btn-primary" : "btn-outline"}
                        onClick={() => setViewMode('daily')}
                        style={{
                            fontSize: '0.75rem',
                            height: '2.5rem',
                            transition: 'all 0.2s',
                            transform: 'translateY(0)'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >DAILY VIEW</button>
                    <button
                        className={viewMode === 'history' ? "btn-primary" : "btn-outline"}
                        onClick={() => setViewMode('history')}
                        style={{
                            fontSize: '0.75rem',
                            height: '2.5rem',
                            transition: 'all 0.2s',
                            transform: 'translateY(0)'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >HISTORY LOG</button>
                    <button
                        className={viewMode === 'calendar' ? "btn-primary" : "btn-outline"}
                        onClick={() => setViewMode('calendar')}
                        style={{
                            fontSize: '0.75rem',
                            height: '2.5rem',
                            transition: 'all 0.2s',
                            transform: 'translateY(0)'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >CALENDAR VIEW</button>
                </div>
            </div>

            {viewMode === 'daily' && (
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <input
                        type="date"
                        className="form-input"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ maxWidth: '200px' }}
                    />
                </div>
            )}

            {loading ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading records...</p>
                </div>
            ) : viewMode === 'daily' ? (
                <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>STYLIST</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>STATUS</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TOTAL HOURS</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>PUNCHES</th>
                                <th style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendanceRecords.map(record => (
                                <tr key={record.stylistId} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '1rem', fontWeight: '700' }}>{record.stylistName}</td>
                                    <td style={{ padding: '1rem' }}>{getStatusBadge(record.status)}</td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{calculateDuration(record.punches)}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {record.punches.map((p, i) => (
                                            <div key={i}>{p.type.toUpperCase()}: {new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        ))}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        {record.status === 'absent' && (
                                            <button className="btn-outline" onClick={() => handleMarkLeave(record.stylistId, record.stylistName)} style={{ fontSize: '0.65rem' }}>MARK LEAVE</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : viewMode === 'history' ? (
                <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>DATE</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>STYLIST</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>STATUS</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>HOURS</th>
                                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ALL PUNCHES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyRecords.map(record => (
                                <tr key={record.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '1rem', fontWeight: '800' }}>{record.date}</td>
                                    <td style={{ padding: '1rem' }}>{record.stylistName}</td>
                                    <td style={{ padding: '1rem' }}>{getStatusBadge(record.status)}</td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{calculateDuration(record.punches)}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {record.punches && record.punches.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                {record.punches.map((p, i) => (
                                                    <div key={i}>
                                                        <span style={{ fontWeight: '800', color: p.type === 'in' ? '#4ade80' : '#f59e0b' }}>
                                                            {p.type.toUpperCase()}
                                                        </span>: {new Date(p.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <CalendarView />
            )
            }
        </div >
    );
}
