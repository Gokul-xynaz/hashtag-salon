import { Link } from 'react-router-dom';
import { useStoreRevenue } from '../hooks/useStoreRevenue';
import AdminLayout from '../components/layout/AdminLayout';

export default function AdminDashboard() {
    const { storeTotal, cashTotal, cardTotal, expensesTotal, netProfit, averageBill, loading } = useStoreRevenue(null, true);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    };

    if (loading) return <div className="container" style={{ textAlign: 'center', padding: '10rem 0', letterSpacing: '0.2em', color: 'var(--text-secondary)' }}>LOADING ANALYTICS...</div>;

    return (
        <AdminLayout>


            {/* Financial Bento Box Overview */}
            <div className="bento-grid">
                <div className="bento-item bento-large" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)', color: 'white' }}>
                    <p style={{ fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '800', marginBottom: '0.5rem' }}>TOTAL SALES REVENUE</p>
                    <p style={{ fontSize: '3.5rem', fontWeight: '900', margin: 0, lineHeight: 1 }}>{formatCurrency(storeTotal)}</p>

                    <div style={{ display: 'flex', gap: '2rem', marginTop: 'auto', paddingTop: '2rem' }}>
                        <div>
                            <p style={{ fontSize: '0.65rem', opacity: 0.8, letterSpacing: '0.1em' }}>CASH TILL</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{formatCurrency(cashTotal)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '0.65rem', opacity: 0.8, letterSpacing: '0.1em' }}>DIGITAL</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{formatCurrency(cardTotal)}</p>
                        </div>
                    </div>
                </div>

                <div className="bento-item bento-medium">
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>NET PROFIT</p>
                    <p style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, color: 'var(--success)' }}>{formatCurrency(netProfit)}</p>
                    <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontWeight: 'bold' }}>Healthy Margin</span>
                    </div>
                </div>

                <div className="bento-item bento-small">
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>EXPENSES</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, color: 'var(--danger)' }}>{formatCurrency(expensesTotal)}</p>
                </div>

                <div className="bento-item bento-small" style={{ background: 'var(--bg-secondary)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>AVG TICKET</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0 }}>{formatCurrency(averageBill)}</p>
                </div>
            </div>

            <h2 style={{ fontSize: '1.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                System Operations
            </h2>

            {/* Application Modules Bento */}
            <div className="bento-grid">
                <Link to="/admin/reports" className="bento-item bento-medium">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Core Analytics</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>Deep dive into comprehensive store performance, AI metrics, and historical logs.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '2rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.75rem', letterSpacing: '0.1em' }}>ENTER MODULE →</div>
                </Link>

                <Link to="/admin/customers" className="bento-item bento-medium">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>CRM Database</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>Manage global client records, loyalty tracking, and bulk customer imports.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '2rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.75rem', letterSpacing: '0.1em' }}>ENTER MODULE →</div>
                </Link>

                <Link to="/admin/team" className="bento-item bento-small">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Staff & Team</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Stylist accounts and access roles.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>MANAGE →</div>
                </Link>

                <Link to="/admin/services" className="bento-item bento-small">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Service Menu</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Catalogue configuration and pricing.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>MANAGE →</div>
                </Link>

                <Link to="/admin/inventory" className="bento-item bento-small">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Retail Stock</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Product catalog and SKU stocks.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>MANAGE →</div>
                </Link>

                <Link to="/admin/expenses" className="bento-item bento-small">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Overheads</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Log and track daily operations.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>MANAGE →</div>
                </Link>

                <Link to="/admin/settings" className="bento-item bento-small">
                    <svg className="bento-icon-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Config</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Discounts and referral rules.</p>
                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>MANAGE →</div>
                </Link>
            </div>
        </AdminLayout>
    );
}
