import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { collection, query, orderBy, onSnapshot, limit, updateDoc, doc, runTransaction, getDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../context/AuthContext';
import ReceiptModal from '../../components/ReceiptModal';
import { logError } from '../../utils/logger';

export default function AppointmentsLedger() {
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingReceipt, setViewingReceipt] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [updatingId, setUpdatingId] = useState(null);
    const [editingStatus, setEditingStatus] = useState({});
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [pageSize, setPageSize] = useState(100);

    // Only 4 allowed statuses
    const ALL_STATUSES = [
        { value: 'scheduled',  label: 'Scheduled',        bg: '#dbeafe', color: '#1e40af' },
        { value: 'completed',  label: 'Paid / Completed',  bg: '#dcfce7', color: '#166534' },
        { value: 'no_show',    label: 'No Show',           bg: '#fee2e2', color: '#991b1b' },
        { value: 'pending',    label: 'Pending',           bg: '#fef9c3', color: '#854d0e' },
    ];

    const handleStatusUpdate = async (id, newStatus, apt) => {
        if (!newStatus) return;
        const statusLabel = ALL_STATUSES.find(s => s.value === newStatus)?.label || newStatus;
        const currentStatus = (apt.status || 'pending').toLowerCase();

        // Block already-locked rows (status changed once before) — admin bypasses
        if (apt.statusLockedAt && !isAdmin) {
            setEditingStatus(prev => { const n = {...prev}; delete n[id]; return n; });
            return;
        }

        // Block legacy isLocked bills
        if (apt.isLocked && !isAdmin) {
            alert('This bill is locked. Only an admin can change its status.');
            setEditingStatus(prev => { const n = {...prev}; delete n[id]; return n; });
            return;
        }

        if (!window.confirm(`Change status to "${statusLabel}"? This can only be changed once.`)) {
            setEditingStatus(prev => { const n = {...prev}; delete n[id]; return n; });
            return;
        }

        setUpdatingId(id);
        try {
            const becomingCompleted = newStatus === 'completed' && currentStatus !== 'completed';
            const lockFields = { status: newStatus, statusLockedAt: new Date().toISOString() };

            if (becomingCompleted && apt?.clientPhone) {
                await runTransaction(db, async (tx) => {
                    // ALL READS before any writes
                    const cRef = doc(db, 'customers', apt.clientPhone);
                    const cSnap = await tx.get(cRef);
                    // Writes
                    tx.update(doc(db, 'appointments', id), lockFields);
                    if (cSnap.exists()) {
                        const stats = cSnap.data().globalStats || {};
                        tx.update(cRef, {
                            'globalStats.totalSpent': (stats.totalSpent || 0) + (apt.totalAmount || 0),
                            'globalStats.totalVisits': (stats.totalVisits || 0) + 1,
                        });
                    }
                });
            } else {
                await updateDoc(doc(db, 'appointments', id), lockFields);
            }
            setEditingStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
        } catch (err) {
            logError('Appointments Status Update', err, { appointmentId: id, newStatus });
            alert('Failed to update: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    const handlePaymentMethodUpdate = async (id, newMethod) => {
        if (!newMethod) return;
        if (!isAdmin) {
            alert('Only an admin can change the payment method.');
            return;
        }
        if (!window.confirm(`Change payment method to "${newMethod}"?`)) {
            return;
        }
        setUpdatingId(id);
        try {
            await updateDoc(doc(db, 'appointments', id), { paymentType: newMethod });
        } catch (err) {
            logError('Appointments Payment Update', err, { appointmentId: id, newMethod });
            alert('Failed to update payment method: ' + err.message);
        } finally {
            setUpdatingId(null);
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'appointments'), orderBy('timestamp', 'desc'), limit(pageSize));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAppointments(list);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching appointments:", err);
            setLoading(false);
        });
        return () => unsub();
    }, [pageSize]);

    const filteredAppointments = useMemo(() => appointments.filter(apt => {
        const matchesSearch = 
            (apt.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (apt.clientPhone || '').includes(searchQuery) ||
            (apt.stylistName || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || (apt.status || 'completed').toLowerCase() === statusFilter.toLowerCase();
        let matchesDate = true;
        if (dateFrom || dateTo) {
            const ts = apt.timestamp?.toDate?.()?.getTime?.();
            if (!ts) matchesDate = false;
            else {
                if (dateFrom) { const f = new Date(dateFrom); f.setHours(0,0,0,0); if (ts < f.getTime()) matchesDate = false; }
                if (dateTo)   { const t = new Date(dateTo);   t.setHours(23,59,59,999); if (ts > t.getTime()) matchesDate = false; }
            }
        }
        return matchesSearch && matchesStatus && matchesDate;
    }), [appointments, searchQuery, statusFilter, dateFrom, dateTo]);

    const handleExport = () => {
        if (filteredAppointments.length === 0) {
            alert('No records available to export.');
            return;
        }

        const headers = ["Date", "Time", "Client Name", "Phone", "Services", "Staff", "Total Amount (INR)", "Status"];
        
        const rows = filteredAppointments.map(apt => {
            let dateStr = '—';
            let timeStr = '—';
            
            if (apt.timestamp) {
                const dateObj = apt.timestamp.toDate ? apt.timestamp.toDate() : new Date(apt.timestamp);
                if (!isNaN(dateObj.getTime())) {
                    dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                }
            }

            const clientName = apt.clientName || 'Walk-in';
            const clientPhone = apt.clientPhone || '—';
            const allItems = [...(apt.services || []), ...(apt.products || []), ...(apt.items || []), ...(apt.packages || []), ...(apt.memberships || []), ...(apt.walletRecharges || [])];
            const servicesJoined = allItems.map(s => s.name).join('; ') || 'No Items';
            const staff = apt.stylistName || 'Unassigned';
            const total = apt.totalAmount || 0;
            const status = apt.status || 'Completed';

            return [
                dateStr,
                timeStr,
                clientName,
                clientPhone,
                servicesJoined,
                staff,
                total,
                status
            ];
        });

        // Generate CSV content safely escaping commas and quotes
        const csvContent = "\uFEFF" + [
            headers.join(","),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
        ].join("\r\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `appointments_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    const getStatusStyle = (status) => {
        const s = ALL_STATUSES.find(x => x.value === (status||'completed').toLowerCase());
        return s ? { bg: s.bg, text: s.color } : { bg: '#f3f4f6', text: '#4b5563' };
    };

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Appointments Ledger</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>A comprehensive view of all past, present, and upcoming bookings.</p>
                </div>
                 <button 
                    onClick={handleExport}
                    style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                 >
                    Export to Excel
                 </button>
            </div>

            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', gap: '1rem', background: '#f8fafc', alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="Search by client, phone, or staff..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: 1, maxWidth: '350px', padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }} 
                    />
                    
                    <select 
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', background: 'white' }}
                    >
                        <option value="All">All Statuses</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Paid / Completed</option>
                        <option value="no_show">No Show</option>
                        <option value="pending">Pending</option>
                    </select>

                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        style={{ padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                        title="From date" />
                    <span style={{ color: 'var(--v2-text-muted)', fontWeight: '700', fontSize: '0.85rem' }}>→</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        style={{ padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' }}
                        title="To date" />
                    {(dateFrom || dateTo) && (
                        <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', background: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.78rem', color: '#ef4444' }}>✕ Clear</button>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--v2-text-muted)', fontWeight: '700' }}>{filteredAppointments.length} records</span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Date &amp; Time</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Client Info</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Services</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Staff</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Total</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700', minWidth: '180px' }}>Status</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading appointments...</td></tr>
                            ) : filteredAppointments.length === 0 ? (
                                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No appointments match your filters.</td></tr>
                            ) : (
                                filteredAppointments.map(apt => {
                                    const currentStatus = (apt.status || 'completed').toLowerCase();
                                    const c = getStatusStyle(currentStatus);
                                    const pendingEdit = editingStatus[apt.id];
                                    const isSaving = updatingId === apt.id;
                                    return (
                                        <tr key={apt.id} style={{ borderBottom: '1px solid var(--v2-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                {apt.timestamp?.toDate ? apt.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', fontWeight: '500' }}>
                                                    {apt.timestamp?.toDate ? apt.timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--v2-primary)', fontWeight: '800', marginTop: '4px' }}>
                                                    #{ (apt.id || '').substring(0, 8).toUpperCase() }
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ fontWeight: '800', color: 'var(--v2-text-main)' }}>{apt.clientName || 'Walk-in'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{apt.clientPhone || '—'}</div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ fontWeight: '600', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {[...(apt.services || []), ...(apt.products || []), ...(apt.items || []), ...(apt.packages || []), ...(apt.memberships || []), ...(apt.walletRecharges || [])].map(s => s.name).join(', ') || 'No Items'}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)' }}>
                                                    {[...(apt.services || []), ...(apt.products || []), ...(apt.items || []), ...(apt.packages || []), ...(apt.memberships || []), ...(apt.walletRecharges || [])].length} items
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: '600' }}>
                                                {apt.stylistName || 'Unassigned'}
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: '800' }}>
                                                {fmt(apt.totalAmount)}
                                            </td>
                                            {/* ── Status Cell: one-time-changeable ── */}
                                            <td style={{ padding: '0.75rem 1.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {apt.statusLockedAt && !isAdmin ? (
                                                        // Locked — show badge + tick
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <span style={{
                                                                padding: '0.3rem 0.65rem',
                                                                borderRadius: '5px',
                                                                background: c.bg,
                                                                color: c.text,
                                                                fontWeight: '800',
                                                                fontSize: '0.72rem',
                                                                letterSpacing: '0.01em',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {ALL_STATUSES.find(s => s.value === currentStatus)?.label || currentStatus}
                                                            </span>
                                                            {/* Green tick — status was changed once */}
                                                            <span title={`Status set on ${new Date(apt.statusLockedAt).toLocaleString('en-IN')}`} style={{
                                                                width: 18, height: 18,
                                                                borderRadius: '50%',
                                                                background: '#16a34a',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                                cursor: 'default'
                                                            }}>
                                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        // Unlocked — show dropdown
                                                        <>
                                                            <select
                                                                value={pendingEdit !== undefined ? pendingEdit : currentStatus}
                                                                onChange={e => setEditingStatus(prev => ({ ...prev, [apt.id]: e.target.value }))}
                                                                style={{
                                                                    padding: '0.3rem 0.5rem',
                                                                    borderRadius: '5px',
                                                                    border: `1.5px solid ${c.bg}`,
                                                                    background: c.bg,
                                                                    color: c.text,
                                                                    fontWeight: '800',
                                                                    fontSize: '0.72rem',
                                                                    outline: 'none',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {ALL_STATUSES.map(s => (
                                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                                ))}
                                                            </select>
                                                            {pendingEdit !== undefined && pendingEdit !== currentStatus && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(apt.id, pendingEdit, apt)}
                                                                    disabled={isSaving}
                                                                    style={{
                                                                        padding: '0.3rem 0.65rem',
                                                                        background: '#16a34a',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '5px',
                                                                        fontWeight: '800',
                                                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                                                        fontSize: '0.72rem',
                                                                        whiteSpace: 'nowrap',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.25rem',
                                                                        opacity: isSaving ? 0.6 : 1
                                                                    }}
                                                                >
                                                                    {isSaving ? (
                                                                        <span style={{ fontFamily: 'monospace' }}>...</span>
                                                                    ) : (
                                                                        <>
                                                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                                                            </svg>
                                                                            Save
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--v2-text-muted)', marginRight: '0.5rem' }}>
                                                        {apt.paymentType || 'cash'}
                                                    </span>
                                                    {apt.isLocked && (
                                                        <span title="Bill locked" style={{ fontSize: '0.75rem', color: '#6b7280' }}>🔒</span>
                                                    )}
                                                    <button
                                                        onClick={() => setViewingReceipt(apt)}
                                                        style={{ border: 'none', background: '#f3f4f6', color: '#374151', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '4px' }}
                                                    >
                                                        🧾 View Receipt
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Load More */}
            {appointments.length >= pageSize && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button onClick={() => setPageSize(p => p + 100)}
                        style={{ padding: '0.6rem 2rem', border: '1px solid var(--v2-border)', borderRadius: '8px', background: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Load More Records (showing {pageSize})
                    </button>
                </div>
            )}

            {viewingReceipt && (
                <ReceiptModal bill={viewingReceipt} onClose={() => setViewingReceipt(null)} />
            )}
        </Layout>
    );
}
