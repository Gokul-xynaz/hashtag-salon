import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { useData } from '../../../context/DataProvider';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function StaffPayroll() {
    const { stylists } = useData();
    
    // Default to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    
    const [loading, setLoading] = useState(false);
    const [appointments, setAppointments] = useState([]);

    const handleGenerate = async (e) => {
        e?.preventDefault();
        setLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, 'appointments'),
                where('timestamp', '>=', Timestamp.fromDate(start)),
                where('timestamp', '<=', Timestamp.fromDate(end))
            );

            const snap = await getDocs(q);
            setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
            alert('Failed to generate payroll data.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-load on mount
    useEffect(() => {
        handleGenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const payrollData = useMemo(() => {
        if (!stylists || !appointments) return [];

        const staffMap = {};
        
        // Initialize map
        stylists.forEach(s => {
            staffMap[s.id] = {
                id: s.id,
                name: s.name,
                baseSalary: s.baseSalary || 0, // Should come from their profile
                commissionProfile: s.commissionProfile || 'Default',
                serviceSales: 0,
                productSales: 0,
                tips: 0,
                totalAppointments: 0
            };
        });

        // Aggregate sales
        appointments.forEach(app => {
            if (app.status === 'cancelled' || app.status === 'void') return;
            
            // App-level tips assigned to primary stylist
            if (app.tipAmount > 0 && app.stylistId && staffMap[app.stylistId]) {
                staffMap[app.stylistId].tips += app.tipAmount;
                staffMap[app.stylistId].totalAppointments += 1;
            }

            // Line items
            (app.services || []).forEach(svc => {
                const staffId = svc.staffId || app.stylistId;
                if (staffId && staffMap[staffId]) {
                    const lineTotal = (parseFloat(svc.price) || 0) * (parseInt(svc.qty) || 1);
                    if (svc.type === 'product') {
                        staffMap[staffId].productSales += lineTotal;
                    } else {
                        staffMap[staffId].serviceSales += lineTotal;
                    }
                }
            });
            
            (app.products || []).forEach(prd => {
                const staffId = prd.staffId || app.stylistId;
                if (staffId && staffMap[staffId]) {
                    const lineTotal = (parseFloat(prd.price) || 0) * (parseInt(prd.qty) || 1);
                    staffMap[staffId].productSales += lineTotal;
                }
            });
        });

        // Calculate commissions (mock logic for tiers based on sales volume)
        return Object.values(staffMap).map(staff => {
            // Very simplified tiered commission structure for demonstration
            // e.g. 10% on services, 5% on products
            const svcCommRate = staff.commissionProfile === 'Senior' ? 0.20 : 0.10;
            const prdCommRate = staff.commissionProfile === 'Senior' ? 0.10 : 0.05;
            
            const svcComm = staff.serviceSales * svcCommRate;
            const prdComm = staff.productSales * prdCommRate;
            const totalComm = svcComm + prdComm;
            
            return {
                ...staff,
                svcCommRate,
                prdCommRate,
                totalCommission: totalComm,
                totalPay: staff.baseSalary + totalComm + staff.tips
            };
        }).filter(s => s.serviceSales > 0 || s.productSales > 0 || s.baseSalary > 0); // Only show active staff

    }, [appointments, stylists]);

    const fmt = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Payroll & Commissions</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Generate automated payroll reports based on stylist appointments.</p>
                </div>
            </div>

            <div className="v2-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                    </div>
                    <button type="submit" disabled={loading} style={{ padding: '0.75rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', height: '42px' }}>
                        {loading ? 'Calculating...' : 'Generate Payroll'}
                    </button>
                    <button type="button" onClick={() => window.print()} style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#334155', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', height: '42px', marginLeft: 'auto' }}>
                        🖨️ Print Report
                    </button>
                </form>
            </div>

            <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Staff Member</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'right' }}>Base Salary</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'right' }}>Service Sales</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'right' }}>Product Sales</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'right' }}>Earned Commission</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem', textAlign: 'right' }}>Tips</th>
                                <th style={{ padding: '1rem 1.25rem', color: 'var(--v2-text-muted)', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.8rem', textAlign: 'right', background: '#f1f5f9' }}>Total Pay</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Analyzing appointments...</td></tr>
                            ) : payrollData.length === 0 ? (
                                <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No sales or payroll data for this period.</td></tr>
                            ) : (
                                payrollData.map(s => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--v2-border)' }}>
                                        <td style={{ padding: '1rem 1.25rem', fontWeight: '800' }}>
                                            {s.name}
                                            <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', fontWeight: '600' }}>{s.commissionProfile} Tier</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>{fmt(s.baseSalary)}</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                            <div style={{ fontWeight: '700' }}>{fmt(s.serviceSales)}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700' }}>{s.svcCommRate * 100}% comm</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                            <div style={{ fontWeight: '700' }}>{fmt(s.productSales)}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: '700' }}>{s.prdCommRate * 100}% comm</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '800', color: '#8b5cf6' }}>{fmt(s.totalCommission)}</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '700', color: '#f59e0b' }}>{fmt(s.tips)}</td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontWeight: '900', fontSize: '1.1rem', background: '#f8fafc', color: 'var(--v2-text-main)' }}>
                                            {fmt(s.totalPay)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!loading && payrollData.length > 0 && (
                            <tfoot>
                                <tr style={{ background: 'var(--v2-primary)', color: 'white' }}>
                                    <td colSpan="2" style={{ padding: '1rem 1.25rem', fontWeight: '900', textAlign: 'right' }}>GRAND TOTALS:</td>
                                    <td style={{ padding: '1rem 1.25rem', fontWeight: '800', textAlign: 'right' }}>{fmt(payrollData.reduce((sum, s) => sum + s.serviceSales, 0))}</td>
                                    <td style={{ padding: '1rem 1.25rem', fontWeight: '800', textAlign: 'right' }}>{fmt(payrollData.reduce((sum, s) => sum + s.productSales, 0))}</td>
                                    <td style={{ padding: '1rem 1.25rem', fontWeight: '800', textAlign: 'right' }}>{fmt(payrollData.reduce((sum, s) => sum + s.totalCommission, 0))}</td>
                                    <td style={{ padding: '1rem 1.25rem', fontWeight: '800', textAlign: 'right' }}>{fmt(payrollData.reduce((sum, s) => sum + s.tips, 0))}</td>
                                    <td style={{ padding: '1rem 1.25rem', fontWeight: '900', fontSize: '1.2rem', textAlign: 'right' }}>{fmt(payrollData.reduce((sum, s) => sum + s.totalPay, 0))}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </Layout>
    );
}
