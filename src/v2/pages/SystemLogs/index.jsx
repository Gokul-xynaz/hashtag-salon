import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import Layout from '../../components/Layout';
import { useAuth } from '../../../context/AuthContext';

export default function SystemLogs() {
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [logLimit, setLogLimit] = useState(50);

    useEffect(() => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        // Efficient query with limit to reduce read costs
        const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(logLimit));
        const unsub = onSnapshot(q, (snapshot) => {
            setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error("Error fetching logs:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [isAdmin, logLimit]);

    const handleMarkResolved = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === 'resolved' ? 'unresolved' : 'resolved';
            await updateDoc(doc(db, 'system_logs', id), { status: newStatus });
        } catch (err) {
            alert('Failed to update status: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Permanently delete this error log?")) return;
        try {
            await deleteDoc(doc(db, 'system_logs', id));
        } catch (err) {
            alert('Failed to delete log: ' + err.message);
        }
    };

    if (!isAdmin) {
        return (
            <Layout>
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                    <h2>Access Denied</h2>
                    <p>Only administrators can view system error logs.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>System Error Logs</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Monitor and debug application errors professionally.</p>
                </div>
            </div>

            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Time</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Context</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Error Message</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700' }}>Status</th>
                                <th style={{ padding: '1rem 1.25rem', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading logs...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No error logs found. System is healthy!</td></tr>
                            ) : (
                                logs.map(log => {
                                    const isResolved = log.status === 'resolved';
                                    const isExpanded = expandedId === log.id;
                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr style={{ borderBottom: '1px solid var(--v2-border)', background: isResolved ? '#f8fafc' : 'white', opacity: isResolved ? 0.7 : 1 }}>
                                                <td style={{ padding: '1rem 1.25rem', whiteSpace: 'nowrap' }}>
                                                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('en-IN') : 'Just now'}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', fontWeight: '700', color: '#0369a1' }}>
                                                    {log.context || 'Unknown'}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', color: '#b91c1c', fontWeight: '600' }}>
                                                    {log.message || 'No message'}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', background: isResolved ? '#dcfce7' : '#fee2e2', color: isResolved ? '#166534' : '#991b1b' }}>
                                                        {log.status || 'unresolved'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                    <button onClick={() => setExpandedId(isExpanded ? null : log.id)} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', marginRight: '0.5rem' }}>
                                                        {isExpanded ? 'Hide Details' : 'View Details'}
                                                    </button>
                                                    <button onClick={() => handleMarkResolved(log.id, log.status)} style={{ padding: '0.4rem 0.8rem', background: isResolved ? '#fef3c7' : '#dcfce7', color: isResolved ? '#b45309' : '#166534', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', marginRight: '0.5rem' }}>
                                                        {isResolved ? 'Mark Unresolved' : 'Mark Resolved'}
                                                    </button>
                                                    <button onClick={() => handleDelete(log.id)} style={{ padding: '0.4rem 0.6rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)' }}>
                                                    <td colSpan="5" style={{ padding: '1.5rem 2rem' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                                            <div>
                                                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase' }}>Stack Trace</h4>
                                                                <pre style={{ background: '#1e293b', color: '#f8fafc', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.75rem', margin: 0, whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                                                                    {log.stack || 'No stack trace available'}
                                                                </pre>
                                                            </div>
                                                            <div>
                                                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase' }}>Additional Data</h4>
                                                                <pre style={{ background: 'white', border: '1px solid #cbd5e1', color: '#334155', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.75rem', margin: 0 }}>
                                                                    {JSON.stringify(log.additionalData || {}, null, 2)}
                                                                </pre>
                                                                <div style={{ marginTop: '1rem' }}>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}><strong>URL:</strong> {log.url}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}><strong>User Agent:</strong> {log.userAgent}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {logs.length >= logLimit && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button onClick={() => setLogLimit(l => l + 50)} style={{ padding: '0.6rem 2rem', border: '1px solid var(--v2-border)', borderRadius: '8px', background: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Load Older Logs
                    </button>
                </div>
            )}
        </Layout>
    );
}
