import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataProvider';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import Layout from '../../components/Layout';

export default function CustomerDetail() {
    const { id } = useParams(); // Using phone number as ID
    const navigate = useNavigate();
    const { stylists } = useData();
    const [activeTab, setActiveTab] = useState('Sales');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const [customer, setCustomer] = useState(null);
    const [loadingCustomer, setLoadingCustomer] = useState(true);

    useEffect(() => {
        async function fetchCust() {
            if (!id) return;
            setLoadingCustomer(true);
            try {
                const snap = await getDoc(doc(db, 'customers', id));
                if (snap.exists()) {
                    setCustomer({id: snap.id, ...snap.data()});
                } else {
                    setCustomer(null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingCustomer(false);
            }
        }
        fetchCust();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        const q = query(
            collection(db, 'appointments'),
            where('clientPhone', '==', id),
            orderBy('timestamp', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsub();
    }, [id]);

    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    const tabs = ['Sales', 'Appointments', 'Packages', 'Memberships', 'Notes', 'Rewards'];

    if (!customer && !loadingCustomer) {
        return (
            <Layout>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>Customer not found</h2>
                    <button onClick={() => navigate('/v2/customers')} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>Back to Customers</button>
                </div>
            </Layout>
        );
    }
    
    if (loadingCustomer) {
        return (
            <Layout>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading customer details...</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* ── LEFT SIDEBAR: PROFILE ── */}
                <div className="v2-card" style={{ width: '300px', padding: '2rem', textAlign: 'center', position: 'sticky', top: '20px' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: '900', margin: '0 auto 1.5rem' }}>
                        {customer?.name?.charAt(0) || '?'}
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>{customer?.name || 'Loading...'}</h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)', marginBottom: '1.5rem' }}>Ref: {customer?.referralCode || 'ODQyODg0Mjg3MQ=='}</div>
                    
                    <button style={{ width: '100%', padding: '0.6rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', marginBottom: '1.5rem', cursor: 'pointer' }}>Staff Alert</button>
                    
                    <div style={{ textAlign: 'left', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Contact</label><strong>{customer?.phone || '—'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Email</label><strong>{customer?.email || '—'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>First Visit</label><strong>{customer?.firstVisit || '15-05-2026'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Birth Date</label><strong>{customer?.dob || '—'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Anniversary Date</label><strong>{customer?.anniversary || '—'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Address</label><strong>{customer?.address || '—'}</strong></div>
                    </div>

                    {/* Buy Subscription Card */}
                    <div className="v2-card" style={{ marginTop: '1.5rem', padding: '1.5rem', textAlign: 'center', background: '#f8fafc', border: '1px solid var(--v2-border)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💎</div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.5rem' }}>Buy Subscription</h3>
                        <p style={{ fontSize: '0.72rem', color: 'var(--v2-text-muted)', lineHeight: '1.4', marginBottom: '1.25rem' }}>
                            We all look for discount when it comes to buying something online or taking services. Don’t worry you can get extra discount for taking subscription at lesser prices.
                        </p>
                        <button style={{ width: '100%', padding: '0.65rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Buy Subscription</button>
                    </div>
                </div>

                {/* ── RIGHT CONTENT ── */}
                <div style={{ flex: 1 }}>
                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { l: 'Total Sales', v: fmt(customer?.globalStats?.totalSpent) },
                            { l: 'Received', v: fmt(customer?.globalStats?.totalSpent) },
                            { l: 'Pending', v: fmt(customer?.pendingBalance || 0), c: (customer?.pendingBalance || 0) > 0 ? '#dc2626' : undefined },
                            { l: 'Total Visits', v: customer?.globalStats?.totalVisits || 0 }
                        ].map((s, i) => (
                            <div key={i} className="v2-card" style={{ padding: '1.25rem' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>{s.l}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: s.c || 'var(--v2-text-main)' }}>{s.v}</div>
                            </div>
                        ))}
                    </div>

                    {/* Tab Navigation */}
                    <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)' }}>
                            {tabs.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setActiveTab(t)}
                                    style={{
                                        padding: '1rem 1.5rem',
                                        border: 'none',
                                        background: activeTab === t ? 'white' : 'transparent',
                                        borderBottom: activeTab === t ? '2px solid var(--v2-primary)' : '2px solid transparent',
                                        color: activeTab === t ? 'var(--v2-primary)' : 'var(--v2-text-muted)',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: '1.5rem' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--v2-text-muted)' }}>Loading records...</div>
                            ) : history.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--v2-text-muted)' }}>No records found for {activeTab}.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--v2-border)' }}>
                                                {activeTab === 'Sales' || activeTab === 'Appointments' ? (
                                                    <>
                                                        <th style={{ padding: '0.75rem' }}>Services / Items</th>
                                                        <th style={{ padding: '0.75rem' }}>Price</th>
                                                        <th style={{ padding: '0.75rem' }}>Paid</th>
                                                        <th style={{ padding: '0.75rem' }}>Balance</th>
                                                        <th style={{ padding: '0.75rem' }}>Date</th>
                                                        <th style={{ padding: '0.75rem' }}>Status</th>
                                                    </>
                                                ) : activeTab === 'Rewards' ? (
                                                    <>
                                                        <th style={{ padding: '0.75rem' }}>Date & Time</th>
                                                        <th style={{ padding: '0.75rem' }}>Credit</th>
                                                        <th style={{ padding: '0.75rem' }}>Debit</th>
                                                        <th style={{ padding: '0.75rem' }}>Remark</th>
                                                    </>
                                                ) : (
                                                    <th style={{ padding: '0.75rem' }}>Details</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((row) => (
                                                <tr key={row.id} style={{ borderBottom: '1px solid var(--v2-border)', verticalAlign: 'top' }}>
                                                    {activeTab === 'Sales' || activeTab === 'Appointments' ? (
                                                        <>
                                                            <td style={{ padding: '1rem 0.75rem' }}>
                                                                <div style={{ fontWeight: '700' }}>{(row.services || row.items || []).map(s => s.name).join(', ')}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>by {row.stylistName || '—'}</div>
                                                            </td>
                                                            <td style={{ padding: '1rem 0.75rem' }}>{fmt(row.totalAmount)}</td>
                                                            <td style={{ padding: '1rem 0.75rem', color: '#10b981', fontWeight: '700' }}>{fmt(row.payingNow || row.totalAmount)}</td>
                                                            <td style={{ padding: '1rem 0.75rem', color: (row.dueAmount || 0) > 0 ? '#dc2626' : 'inherit', fontWeight: '700' }}>{fmt(row.dueAmount || 0)}</td>
                                                            <td style={{ padding: '1rem 0.75rem' }}>{row.timestamp?.toDate?.()?.toLocaleDateString('en-IN')}</td>
                                                            <td style={{ padding: '1rem 0.75rem' }}>
                                                                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>{row.status || 'completed'}</span>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td style={{ padding: '1rem 0.75rem' }}>Record found under {activeTab}</td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
