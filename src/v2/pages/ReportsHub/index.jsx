import React, { useState } from 'react';
import Layout from '../../components/Layout';

export default function ReportsHub() {
    const [activeCategory, setActiveCategory] = useState('Sales');

    const categories = [
        { id: 'Sales', icon: '💰', title: 'Sales & Financials', desc: 'Revenue, taxes, and payment distributions.' },
        { id: 'Customers', icon: '👥', title: 'Customer Analytics', desc: 'Retention, top spenders, and arrears.' },
        { id: 'Staff', icon: '🧑‍🤝‍🧑', title: 'Staff & Payroll', desc: 'Performance, commissions, and utilization.' },
        { id: 'Inventory', icon: '📦', title: 'Inventory & Packages', desc: 'Stock consumption and package tracking.' }
    ];

    const reports = {
        Sales: [
            { title: 'Daily Sales Report', desc: 'A breakdown of total daily revenue by cash, card, and UPI.' },
            { title: 'Invoice Summary', desc: 'A detailed log of all generated invoices including voids.' },
            { title: 'Tax & GST Report', desc: 'Total tax collected across all taxable services and products.' },
            { title: 'Sales Discount Report', desc: 'Tracking of all manual and promotional discounts applied.' }
        ],
        Customers: [
            { title: 'Membership Sales', desc: 'Revenue generated purely from VIP and membership subscriptions.' },
            { title: 'Top Spenders', desc: 'Your most valuable clients based on lifetime value.' },
            { title: 'Pending Accounts', desc: 'Clients with outstanding arrears or partial payments.' }
        ],
        Staff: [
            { title: 'Staff Performance', desc: 'Revenue generated per staff member.' },
            { title: 'Commissions Ledger', desc: 'Calculated commissions based on the assigned tier profiles.' },
            { title: 'Attendance Summary', desc: 'Total hours worked, late clock-ins, and leaves.' }
        ],
        Inventory: [
            { title: 'Product Sales vs Consumption', desc: 'Compare retail sales against backbar usage.' },
            { title: 'Low Stock Warnings', desc: 'Items currently below their defined alert thresholds.' },
            { title: 'Package Lifecycle', desc: 'Track active, expiring, and completed client packages.' }
        ]
    };

    return (
        <Layout>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Reports & Analytics</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Generate, view, and export comprehensive business intelligence data.</p>
            </div>

            {/* Category Pillars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {categories.map(c => (
                    <div 
                        key={c.id} 
                        className="v2-card" 
                        onClick={() => setActiveCategory(c.id)}
                        style={{ 
                            padding: '1.5rem', 
                            cursor: 'pointer', 
                            border: activeCategory === c.id ? '2px solid var(--v2-primary)' : '2px solid transparent',
                            transform: activeCategory === c.id ? 'translateY(-2px)' : 'none',
                            transition: 'all 0.2s',
                            boxShadow: activeCategory === c.id ? '0 10px 25px rgba(0,0,0,0.1)' : 'var(--v2-shadow-sm)'
                        }}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{c.icon}</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem', color: activeCategory === c.id ? 'var(--v2-primary)' : 'var(--v2-text-main)' }}>{c.title}</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', lineHeight: '1.4' }}>{c.desc}</p>
                    </div>
                ))}
            </div>

            {/* Active Category Reports List */}
            <div className="v2-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--v2-border)', paddingBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{activeCategory} Reports</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <select style={{ padding: '0.6rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', fontWeight: '600' }}>
                            <option>This Month</option>
                            <option>Last Month</option>
                            <option>This Year</option>
                            <option>Custom Range...</option>
                        </select>
                        <button style={{ padding: '0.6rem 1.25rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>Export All Data</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {reports[activeCategory].map((report, idx) => (
                        <div key={idx} style={{ padding: '1.5rem', border: '1px solid var(--v2-border)', borderRadius: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--v2-text-main)' }}>{report.title}</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)', lineHeight: '1.4', marginBottom: '1.5rem' }}>{report.desc}</p>
                            </div>
                            <button style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', background: 'white', border: '1px solid var(--v2-primary)', color: 'var(--v2-primary)', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}>
                                Generate Report &rarr;
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </Layout>
    );
}
