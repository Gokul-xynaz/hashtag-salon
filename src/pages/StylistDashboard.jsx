import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useStoreRevenue } from '../hooks/useStoreRevenue';
import { useData } from '../context/DataProvider';

export default function StylistDashboard() {
    const { logout, selectedStylist, selectStylist } = useAuth();
    const { stylists, loadingStylists } = useData();
    const navigate = useNavigate();

    // 1. Personal Stats
    const { storeTotal: personalSales, averageBill, loading: loadingStats } = useStoreRevenue(selectedStylist?.id, false);

    // 2. Global Store Total (added per user request)
    const { storeTotal: globalTotal } = useStoreRevenue(null, true);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    };

    if (loadingStylists) return <div className="container">Loading Dashboard...</div>;

    return (
        <div className="container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.2em' }}>JX Saloon</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                <div className="animate-fade-in" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>STUDIO ACCESS</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>SELECT YOUR PROFILE TO COMMENCE SESSION</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.5rem' }}>
                        {stylists.map(s => (
                            <button
                                key={s.id}
                                className="btn-outline"
                                onClick={() => selectStylist(s)}
                                style={{
                                    height: '6rem',
                                    fontSize: '1rem',
                                    fontWeight: '800',
                                    borderRadius: 'var(--radius-md)',
                                    textTransform: 'none',
                                    letterSpacing: 'normal'
                                }}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="card" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>CURRENT SESSION</p>
                            <h3 style={{ fontSize: '2rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedStylist.name}</h3>
                        </div>
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/booking/new')}
                            style={{ height: '4rem', padding: '0 2.5rem', fontSize: '0.9rem', flexShrink: 0 }}
                        >
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

                        <div className="card" style={{ borderLeft: '8px solid black', overflowX: 'auto', minWidth: 0 }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>STORE TOTAL (TODAY)</p>
                            <p style={{ fontSize: '2rem', fontWeight: '900', margin: '1rem 0', whiteSpace: 'nowrap' }}>
                                {loadingStats ? '...' : formatCurrency(globalTotal)}
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
        </div>
    );
}
