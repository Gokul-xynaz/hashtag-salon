import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function StaffDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [staff, setStaff] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('General');

    // Form States
    const [formData, setFormData] = useState({});
    
    // Attendance State
    const [attendanceLogs, setAttendanceLogs] = useState([]);

    useEffect(() => {
        if (id === 'new') {
            setStaff({ role: 'stylist', isActive: true });
            setFormData({ role: 'stylist', isActive: true });
            setLoading(false);
            return;
        }

        const fetchStaff = async () => {
            try {
                const d = await getDoc(doc(db, 'users', id));
                if (d.exists()) {
                    setStaff({ id: d.id, ...d.data() });
                    setFormData({ id: d.id, ...d.data() });
                } else {
                    alert("Staff not found");
                    navigate('/v2/staff');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStaff();
    }, [id, navigate]);

    // Fetch attendance logs
    useEffect(() => {
        if (id === 'new' || activeTab !== 'Attendance') return;
        const q = query(collection(db, 'attendance_logs'), where('stylistId', '==', id));
        const unsub = onSnapshot(q, snap => {
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort newest first client-side
            logs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
            setAttendanceLogs(logs);
        }, err => console.error('Attendance fetch error:', err));
        return () => unsub();
    }, [id, activeTab]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (id === 'new') {
                // Should use a Firebase Cloud Function to create auth user, 
                // but for V2 frontend simulation, we might just create the doc if custom IDs are allowed.
                alert("Creating new staff members requires Auth setup. Simulating save.");
            } else {
                await updateDoc(doc(db, 'users', id), formData);
                alert("Profile updated successfully!");
                setStaff(formData);
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    if (loading) return <Layout><div style={{ padding: '3rem', textAlign: 'center' }}>Loading profile...</div></Layout>;

    const tabs = ['General', 'Permissions', 'Payroll', 'Attendance'];

    return (
        <Layout>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                
                {/* ── LEFT SIDEBAR: PROFILE SUMMARY ── */}
                <div className="v2-card" style={{ width: '320px', padding: '2rem', textAlign: 'center', position: 'sticky', top: '20px' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: formData.color || 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', fontWeight: '900', margin: '0 auto 1.5rem', border: '4px solid #f1f5f9' }}>
                        {formData.name?.charAt(0) || 'U'}
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.25rem' }}>{formData.name || 'New Staff Member'}</h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--v2-primary)', fontWeight: '800', textTransform: 'uppercase', marginBottom: '1.5rem' }}>{formData.role || 'Stylist'}</div>
                    
                    <div style={{ textAlign: 'left', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Staff ID</label><strong>{formData.staffId || formData.id?.substring(0,8) || 'TBD'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Phone</label><strong>{formData.phone || '—'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Email</label><strong>{formData.email || '—'}</strong></div>
                        <div><label style={{ display: 'block', color: 'var(--v2-text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>Joining Date</label><strong>{formData.joiningDate || '—'}</strong></div>
                    </div>
                </div>

                {/* ── RIGHT CONTENT: TABS & FORMS ── */}
                <div style={{ flex: 1 }}>
                    <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Tabs Navigation */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)' }}>
                            {tabs.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setActiveTab(t)}
                                    style={{
                                        padding: '1.25rem 2rem',
                                        border: 'none',
                                        background: activeTab === t ? 'white' : 'transparent',
                                        borderBottom: activeTab === t ? '3px solid var(--v2-primary)' : '3px solid transparent',
                                        color: activeTab === t ? 'var(--v2-primary)' : 'var(--v2-text-muted)',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content Area */}
                        <form onSubmit={handleSave} style={{ padding: '2rem' }}>
                            
                            {activeTab === 'General' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>Personal Details</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Full Name *</label>
                                            <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Mobile Number *</label>
                                            <input type="tel" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Email Address</label>
                                            <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Date of Joining</label>
                                            <input type="date" value={formData.joiningDate || ''} onChange={e => setFormData({...formData, joiningDate: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                                        </div>
                                    </div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>Professional Setup</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Designation</label>
                                            <select value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }}>
                                                <option value="stylist">Stylist</option>
                                                <option value="senior">Senior Stylist</option>
                                                <option value="manager">Manager</option>
                                                <option value="admin">Administrator</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Calendar Color Code</label>
                                            <input type="color" value={formData.color || '#3b82f6'} onChange={e => setFormData({...formData, color: e.target.value})} style={{ width: '100%', height: '42px', padding: '0.2rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', cursor: 'pointer' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Permissions' && (
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>Granular Access Control</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)', marginBottom: '2rem' }}>Toggle which modules and actions this staff member can access in the dashboard.</p>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                        {[
                                            { id: 'view_reports', label: 'View Analytics & Reports' },
                                            { id: 'manage_inventory', label: 'Manage Products & Stock' },
                                            { id: 'process_sales', label: 'Access Point of Sale (POS)' },
                                            { id: 'delete_appointments', label: 'Can Delete Appointments' },
                                            { id: 'apply_discounts', label: 'Can Apply Custom Discounts' },
                                            { id: 'view_customers', label: 'Access Global Customer DB' }
                                        ].map(perm => (
                                            <label key={perm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--v2-border)', borderRadius: '8px', cursor: 'pointer' }}>
                                                <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{perm.label}</span>
                                                <div style={{ position: 'relative', width: '40px', height: '22px', background: formData.permissions?.[perm.id] ? '#10b981' : '#e2e8f0', borderRadius: '20px', transition: '0.3s' }}>
                                                    <div style={{ position: 'absolute', top: '2px', left: formData.permissions?.[perm.id] ? '20px' : '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: '0.3s' }}></div>
                                                </div>
                                                {/* Hidden input to handle state via a complex onChange if we wanted, but for UI representation this works */}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Payroll' && (
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>Payroll & Compensation</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Pay Type</label>
                                            <select value={formData.payType || 'Fixed Salary'} onChange={e => setFormData({...formData, payType: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }}>
                                                <option value="Fixed Salary">Fixed Salary</option>
                                                <option value="Hourly Rate">Hourly Rate</option>
                                                <option value="Commission Only">Commission Only</option>
                                                <option value="Salary + Commission">Salary + Commission</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Base Amount (₹)</label>
                                            <input type="number" placeholder="e.g. 25000" value={formData.baseSalary || ''} onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Assign Commission Profile</label>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <select value={formData.commissionProfile || 'Default'} onChange={e => setFormData({...formData, commissionProfile: e.target.value})} style={{ flex: 1, padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', background: '#f8fafc' }}>
                                                    <option value="Default">Default Stylist Profile (10% Service, 5% Product)</option>
                                                    <option value="Senior">Senior Tier (20% Service, 10% Product)</option>
                                                    <option value="None">No Commission</option>
                                                </select>
                                                <button type="button" onClick={() => navigate('/v2/staff/commissions')} style={{ padding: '0.75rem 1rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>Manage Profiles</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Attendance' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Attendance Ledger</h3>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)', fontWeight: '600' }}>{attendanceLogs.length} Records</span>
                                    </div>

                                    {/* Summary stats */}
                                    {attendanceLogs.length > 0 && (() => {
                                        const byDate = {};
                                        attendanceLogs.forEach(log => {
                                            const d = log.timestamp?.toDate?.();
                                            if (!d) return;
                                            const dStr = d.toLocaleDateString('en-CA');
                                            if (!byDate[dStr]) byDate[dStr] = { clockIn: null, clockOut: null, logs: [] };
                                            byDate[dStr].logs.push(log);
                                            if (log.type === 'clock_in') {
                                                if (!byDate[dStr].clockIn || d < byDate[dStr].clockIn.timestamp?.toDate?.()) byDate[dStr].clockIn = log;
                                            }
                                            if (log.type === 'clock_out') {
                                                if (!byDate[dStr].clockOut || d > byDate[dStr].clockOut.timestamp?.toDate?.()) byDate[dStr].clockOut = log;
                                            }
                                        });

                                        const days = Object.values(byDate);
                                        const present = days.length;
                                        const withOut = days.filter(d => d.clockOut).length;
                                        const totalMins = days.reduce((sum, day) => {
                                            const ci = day.clockIn?.timestamp?.toDate?.();
                                            const co = day.clockOut?.timestamp?.toDate?.();
                                            return sum + (ci && co ? (co - ci) / 60000 : 0);
                                        }, 0);
                                        const avgHrs = withOut > 0 ? (totalMins / withOut / 60).toFixed(1) : '—';
                                        
                                        return (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                                {[{ l: 'Days Present', v: present }, { l: 'Avg Hours/Day', v: avgHrs + (avgHrs !== '—' ? 'h' : '') }, { l: 'Total Logs', v: attendanceLogs.length }].map((s, i) => (
                                                    <div key={i} style={{ padding: '1.25rem', border: '1px solid var(--v2-border)', borderRadius: '8px', background: '#f8fafc' }}>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '0.25rem' }}>{s.l}</div>
                                                        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-primary)' }}>{s.v}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Log rows */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {(() => {
                                            const grouped = {};
                                            attendanceLogs.forEach(log => {
                                                const d = log.timestamp?.toDate?.();
                                                if (!d) return;
                                                const dStr = d.toLocaleDateString('en-CA');
                                                if (!grouped[dStr]) grouped[dStr] = [];
                                                grouped[dStr].push(log);
                                            });
                                            
                                            const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));
                                            
                                            if (sortedDates.length === 0) {
                                                return (
                                                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--v2-text-muted)', border: '1px dashed var(--v2-border)', borderRadius: '8px', background: '#f8fafc' }}>
                                                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
                                                        <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--v2-text-main)' }}>No attendance records found</div>
                                                        <div style={{ fontSize: '0.85rem' }}>Records will appear here automatically when {formData.name || 'this staff member'} clocks in via the Calendar.</div>
                                                    </div>
                                                );
                                            }

                                            return sortedDates.map(dateStr => {
                                                const dayLogs = grouped[dateStr].sort((a,b) => (a.timestamp?.toMillis?.()||0) - (b.timestamp?.toMillis?.()||0));
                                                const ci = dayLogs.find(l => l.type === 'clock_in')?.timestamp?.toDate?.();
                                                const co = dayLogs.find(l => l.type === 'clock_out')?.timestamp?.toDate?.();
                                                const hoursWorked = ci && co ? ((co - ci) / 3600000).toFixed(1) : null;
                                                
                                                return (
                                                    <div key={dateStr} style={{ border: '1px solid var(--v2-border)', borderRadius: '8px', background: 'white', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid var(--v2-border)' }}>
                                                            <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                {hoursWorked ? (
                                                                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--v2-primary)' }}>{hoursWorked}h</div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '800', padding: '0.2rem 0.6rem', background: '#ecfdf5', borderRadius: '20px' }}>● ACTIVE SHIFT</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ padding: '0.5rem 1.25rem' }}>
                                                            {dayLogs.map(log => (
                                                                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.75rem 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                                    <div style={{ width: '80px', fontSize: '0.85rem', color: 'var(--v2-text-muted)', fontWeight: '700' }}>
                                                                        {log.timestamp?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <span style={{ fontSize: '0.9rem', fontWeight: '800', color: log.type === 'clock_in' ? '#059669' : '#e11d48' }}>
                                                                            {log.type === 'clock_in' ? '☀️ Clock In' : '🌙 Clock Out'}
                                                                        </span>
                                                                    </div>
                                                                    {log.photoUrl && (
                                                                        <img src={log.photoUrl} alt="Attendance" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                    
                                    <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--v2-border)' }}>
                                        <button type="button" onClick={() => navigate('/v2/staff/schedule')} style={{ padding: '0.6rem 1.5rem', background: 'white', color: 'var(--v2-text-main)', border: '1px solid var(--v2-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>View Scheduled Shifts</button>
                                    </div>
                                </div>
                            )}

                            {/* Sticky Save Footer */}
                            <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" onClick={() => navigate('/v2/staff')} style={{ padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '0.75rem 2.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
