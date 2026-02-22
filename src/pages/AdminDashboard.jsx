import { Link } from 'react-router-dom';
import { useStoreRevenue } from '../hooks/useStoreRevenue';
import AdminLayout from '../components/layout/AdminLayout';

export default function AdminDashboard() {
    const { storeTotal, cashTotal, cardTotal, expensesTotal, netProfit, averageBill, loading } = useStoreRevenue(null, true);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
    };

    if (loading) return <div className="container">Loading Analytics...</div>;

    return (
        <AdminLayout>
            {/* Financial Overview Widget */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
                <div className="card" style={{ borderLeft: '8px solid var(--success)', overflowX: 'auto', minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>TOTAL SALES</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, whiteSpace: 'nowrap' }}>{formatCurrency(storeTotal)}</p>
                </div>

                <div className="card" style={{ borderLeft: '8px solid #FFD700', overflowX: 'auto', minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>CASH COLLECTION</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, whiteSpace: 'nowrap' }}>{formatCurrency(cashTotal)}</p>
                </div>

                <div className="card" style={{ borderLeft: '8px solid #4169E1', overflowX: 'auto', minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>CARD/UPI COLLECTION</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, whiteSpace: 'nowrap' }}>{formatCurrency(cardTotal)}</p>
                </div>

                <div className="card" style={{ borderLeft: '8px solid var(--primary)', overflowX: 'auto', minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>AVG BILL VALUE</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, whiteSpace: 'nowrap' }}>{formatCurrency(averageBill)}</p>
                </div>

                <div className="card" style={{ borderLeft: '8px solid var(--danger)', overflowX: 'auto', minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>EXPENSES</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, color: 'var(--danger)', whiteSpace: 'nowrap' }}>{formatCurrency(expensesTotal)}</p>
                </div>

                <div className="card" style={{ background: 'var(--bg-secondary)', borderLeft: '8px solid var(--text-accent)', overflowX: 'auto', minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800', marginBottom: '0.5rem' }}>NET PROFIT</p>
                    <p style={{ fontSize: '2rem', fontWeight: '900', margin: 0, whiteSpace: 'nowrap' }}>{formatCurrency(netProfit)}</p>
                </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>Management & Operations</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    <Link to="/admin/inventory" className="card" style={{ display: 'block', textDecoration: 'none', borderLeft: '4px solid black' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Inventory & Stock Management</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Add products, manage stock levels, and track consumption.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/services" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Catalogue Management</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Update services, pricing models, and categorization.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/team" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Team & Access Control</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Manage stylist profiles, service permissions, and security.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/reports" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Advanced Analytics</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Detailed breakdown of performance, duration, and billing loops.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/expenses" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Expense Logging</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Record daily studio operational costs and overheads.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/settings" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>System Settings</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Configure global discount limits & rules.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/attendance" className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Attendance Management</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Track stylist work hours, breaks, leave, and attendance status.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>

                    <Link to="/admin/customers" className="card" style={{ display: 'block', textDecoration: 'none', borderRight: '4px solid black' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Global CRM Database</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Master list of all customers, visit history, and bulk import tool.</p>
                        <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.7rem' }}>OPEN MODULE &rarr;</div>
                    </Link>
                </div>
            </div>
        </AdminLayout>
    );
}
