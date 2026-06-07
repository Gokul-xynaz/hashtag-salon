import Layout from '../../components/Layout';
import { useState, useEffect, useMemo } from 'react';
import { useData } from '../../../context/DataProvider';
import { doc, setDoc, serverTimestamp, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PERMISSIONS_LIST = [
    { k: 'acc_quicksale', l: 'Quicksale' },
    { k: 'acc_staff_calendar', l: 'Staff Calendar' },
    { k: 'acc_room_calendar', l: 'Room Calendar' },
    { k: 'acc_clients', l: 'Clients' },
    { k: 'acc_appointment', l: 'Appointment' },
    { k: 'acc_integration', l: 'Integration' },
    { k: 'acc_expenditure', l: 'Expenditure' },
    { k: 'acc_warehouse', l: 'Warehouse' },
    { k: 'acc_products', l: 'Products' },
    { k: 'acc_home', l: 'Home' },
    { k: 'acc_consent_form', l: 'Consent Form' },
    { k: 'acc_custom_fields', l: 'Custom Fields' },
    { k: 'acc_booking_setting', l: 'Booking Setting' },
    { k: 'acc_notifications', l: 'Notifications' },
    { k: 'acc_point_of_sale', l: 'Point of Sale' },
    { k: 'acc_register_close', l: 'Register Close' },
    { k: 'acc_reports', l: 'Reports' }
];

const generatePerms = (allowedList) => {
    return PERMISSIONS_LIST.reduce((acc, p) => ({ ...acc, [p.k]: allowedList.includes(p.k) }), {});
};

const ROLE_PRESETS = {
    admin: { label: 'Admin', desc: 'Full Access', perms: generatePerms(PERMISSIONS_LIST.map(p => p.k)) },
    manager: { label: 'Manager', desc: 'All except System Settings', perms: generatePerms(['acc_quicksale', 'acc_staff_calendar', 'acc_room_calendar', 'acc_clients', 'acc_appointment', 'acc_expenditure', 'acc_warehouse', 'acc_products', 'acc_home', 'acc_notifications', 'acc_point_of_sale', 'acc_register_close', 'acc_reports']) },
    receptionist: { label: 'Receptionist', desc: 'POS & Calendar Only', perms: generatePerms(['acc_quicksale', 'acc_staff_calendar', 'acc_appointment', 'acc_home', 'acc_point_of_sale', 'acc_clients']) },
    stylist: { label: 'Stylist', desc: 'Own Calendar Only', perms: generatePerms(['acc_home', 'acc_staff_calendar', 'acc_notifications']) }
};

export default function V2ManageStaff() {
    const { stylists } = useData();
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [activeTab, setActiveTab] = useState('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({});
    const [staffSales, setStaffSales] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);

    const handleSelectStaff = (staff) => {
        setSelectedStaff(staff);
        setFormData({
            ...staff,
            v2_commissionType: staff.v2_commissionType || 'percentage',
            v2_serviceCommission: staff.v2_serviceCommission || 0,
            v2_productCommission: staff.v2_productCommission || 0,
            v2_role: staff.v2_role || 'stylist',
            v2_permissions: staff.v2_permissions || ROLE_PRESETS.stylist.perms,
            v2_shifts: staff.v2_shifts || DAYS.reduce((acc, d) => ({ ...acc, [d]: { enabled: d !== 'Sun', start: '10:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' } }), {}),
            v2_slabs: staff.v2_slabs || [{ threshold: 0, rate: 10 }],
            v2_salary: staff.v2_salary || 0,
            v2_phone: staff.v2_phone || '',
            v2_designation: staff.v2_designation || 'Stylist',
            v2_joinDate: staff.v2_joinDate || ''
        });
        setActiveTab('profile');
    };

    // Fetch sales for performance tab
    useEffect(() => {
        if (!selectedStaff || activeTab !== 'performance') return;
        const q = query(collection(db, 'appointments'), where('stylistId', '==', selectedStaff.id), orderBy('timestamp', 'desc'));
        const unsub = onSnapshot(q, snap => setStaffSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }, [selectedStaff, activeTab]);

    // Fetch attendance logs — reads from 'attendance_logs' (written by the Calendar clock-in modal)
    // Uses single-field 'where' only (no orderBy) to avoid needing a Firestore composite index.
    // Sorting is done client-side.
    useEffect(() => {
        if (!selectedStaff || activeTab !== 'attendance') return;
        const q = query(collection(db, 'attendance_logs'), where('stylistId', '==', selectedStaff.id));
        const unsub = onSnapshot(q, snap => {
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort newest first client-side
            logs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
            setAttendanceLogs(logs);
        }, err => console.error('Attendance fetch error:', err));
        return () => unsub();
    }, [selectedStaff, activeTab]);

    const handleSave = async () => {
        if (!selectedStaff) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'users', selectedStaff.id), {
                name: formData.name,
                shortCode: formData.shortCode,
                v2_commissionType: formData.v2_commissionType,
                v2_serviceCommission: Number(formData.v2_serviceCommission),
                v2_productCommission: Number(formData.v2_productCommission),
                v2_role: formData.v2_role,
                v2_permissions: formData.v2_permissions,
                v2_shifts: formData.v2_shifts,
                v2_slabs: formData.v2_slabs,
                v2_salary: Number(formData.v2_salary),
                v2_phone: formData.v2_phone,
                v2_designation: formData.v2_designation,
                v2_joinDate: formData.v2_joinDate,
                v2_lastUpdated: serverTimestamp()
            }, { merge: true });
            alert('Saved successfully.');
        } catch (err) { alert(err.message); }
        finally { setIsSaving(false); }
    };

    const updateShift = (day, field, value) => {
        setFormData(prev => ({ ...prev, v2_shifts: { ...prev.v2_shifts, [day]: { ...prev.v2_shifts[day], [field]: value } } }));
    };

    const updatePermission = (key, value) => {
        setFormData(prev => ({ ...prev, v2_permissions: { ...prev.v2_permissions, [key]: value } }));
    };

    const applyRolePreset = (role) => {
        setFormData(prev => ({ ...prev, v2_role: role, v2_permissions: { ...ROLE_PRESETS[role].perms } }));
    };

    const addSlab = () => {
        setFormData(prev => ({ ...prev, v2_slabs: [...(prev.v2_slabs || []), { threshold: 0, rate: 0 }] }));
    };

    const updateSlab = (index, field, value) => {
        setFormData(prev => {
            const slabs = [...(prev.v2_slabs || [])];
            slabs[index] = { ...slabs[index], [field]: Number(value) };
            return { ...prev, v2_slabs: slabs };
        });
    };

    const removeSlab = (index) => {
        setFormData(prev => ({ ...prev, v2_slabs: prev.v2_slabs.filter((_, i) => i !== index) }));
    };

    // Performance stats
    const perfStats = useMemo(() => {
        const completedSales = staffSales.filter(a => (a.status || 'completed').toLowerCase() === 'completed');
        const rev = completedSales.reduce((s, a) => s + (a.totalAmount || 0), 0);
        return { totalRevenue: rev, totalBills: completedSales.length, avgBill: completedSales.length > 0 ? rev / completedSales.length : 0 };
    }, [staffSales]);

    const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
    const TABS = ['profile', 'shifts', 'commission', 'roles', 'performance', 'attendance'];

    return (
        <Layout>
            <div style={{ display: 'flex', gap: '1.5rem', height: 'calc(100vh - 120px)' }}>
                {/* LEFT: Staff List */}
                <div className="v2-card" style={{ width: '280px', flexShrink: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--v2-border)' }}>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Team ({stylists?.length || 0})</h2>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {stylists?.map(s => (
                            <div key={s.id} onClick={() => handleSelectStaff(s)} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--v2-border)', cursor: 'pointer', background: selectedStaff?.id === s.id ? 'var(--v2-bg-main)' : 'transparent', borderLeft: selectedStaff?.id === s.id ? '3px solid var(--v2-primary)' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.8rem', flexShrink: 0 }}>{s.name?.charAt(0)}</div>
                                <div><div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{s.name}</div><div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)' }}>{s.v2_designation || s.role || 'Stylist'}</div></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Detail Panel */}
                <div className="v2-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!selectedStaff ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v2-text-muted)', flexDirection: 'column', gap: '1rem' }}><span style={{ fontSize: '3rem', opacity: 0.5 }}>🧑‍🤝‍🧑</span><span>Select a staff member</span></div>
                    ) : (
                        <>
                            {/* Header */}
                            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: '800' }}>{selectedStaff.name?.charAt(0)}</div>
                                    <div><h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedStaff.name}</h2><span style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)' }}>ID: {selectedStaff.id.substring(0, 8)}</span></div>
                                </div>
                                <button onClick={handleSave} disabled={isSaving} style={{ padding: '0.6rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer', fontWeight: '700' }}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: '1.5rem', padding: '0 2rem', borderBottom: '1px solid var(--v2-border)' }}>
                                {TABS.map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.75rem 0', border: 'none', background: 'transparent', color: activeTab === tab ? 'var(--v2-primary)' : 'var(--v2-text-muted)', borderBottom: activeTab === tab ? '2px solid var(--v2-primary)' : '2px solid transparent', fontWeight: activeTab === tab ? '700' : '500', cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.875rem' }}>{tab}</button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>

                                {/* PROFILE */}
                                {activeTab === 'profile' && (
                                    <div style={{ maxWidth: '550px', display: 'grid', gap: '1.5rem' }}>
                                        {[{ l: 'Full Name', k: 'name', type: 'text' }, { l: 'Designation', k: 'v2_designation', type: 'text' }, { l: 'Phone Number', k: 'v2_phone', type: 'tel' }, { l: 'Booking Shortcode', k: 'shortCode', type: 'text' }, { l: 'Date of Joining', k: 'v2_joinDate', type: 'date' }, { l: 'Monthly Salary (₹)', k: 'v2_salary', type: 'number' }].map(f => (
                                            <div key={f.k}><label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>{f.l}</label><input type={f.type} value={formData[f.k] || ''} onChange={e => setFormData({ ...formData, [f.k]: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', outline: 'none' }} /></div>
                                        ))}
                                    </div>
                                )}

                                {/* SHIFTS */}
                                {activeTab === 'shifts' && (
                                    <div>
                                        <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '1rem', borderRadius: 'var(--v2-radius-md)', marginBottom: '1.5rem', color: '#0f766e', fontSize: '0.85rem' }}>
                                            <strong>Shift Schedule:</strong> Set working hours and breaks for each day. Disabled days will block the online booking calendar.
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {DAYS.map(day => {
                                                const shift = formData.v2_shifts?.[day] || { enabled: false, start: '10:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' };
                                                return (
                                                    <div key={day} style={{ display: 'grid', gridTemplateColumns: '80px 40px 1fr 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1rem', background: shift.enabled ? 'white' : '#f9fafb', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', opacity: shift.enabled ? 1 : 0.6 }}>
                                                        <span style={{ fontWeight: '700', fontSize: '0.875rem' }}>{day}</span>
                                                        <input type="checkbox" checked={shift.enabled} onChange={e => updateShift(day, 'enabled', e.target.checked)} style={{ width: '18px', height: '18px' }} />
                                                        <div><label style={{ fontSize: '0.6rem', color: 'var(--v2-text-muted)', display: 'block' }}>START</label><input type="time" value={shift.start} onChange={e => updateShift(day, 'start', e.target.value)} disabled={!shift.enabled} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--v2-border)', borderRadius: '4px', fontSize: '0.8rem' }} /></div>
                                                        <div><label style={{ fontSize: '0.6rem', color: 'var(--v2-text-muted)', display: 'block' }}>END</label><input type="time" value={shift.end} onChange={e => updateShift(day, 'end', e.target.value)} disabled={!shift.enabled} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--v2-border)', borderRadius: '4px', fontSize: '0.8rem' }} /></div>
                                                        <div><label style={{ fontSize: '0.6rem', color: 'var(--v2-text-muted)', display: 'block' }}>BREAK START</label><input type="time" value={shift.breakStart} onChange={e => updateShift(day, 'breakStart', e.target.value)} disabled={!shift.enabled} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--v2-border)', borderRadius: '4px', fontSize: '0.8rem' }} /></div>
                                                        <div><label style={{ fontSize: '0.6rem', color: 'var(--v2-text-muted)', display: 'block' }}>BREAK END</label><input type="time" value={shift.breakEnd} onChange={e => updateShift(day, 'breakEnd', e.target.value)} disabled={!shift.enabled} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--v2-border)', borderRadius: '4px', fontSize: '0.8rem' }} /></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* COMMISSION */}
                                {activeTab === 'commission' && (
                                    <div style={{ maxWidth: '600px' }}>
                                        <div style={{ marginBottom: '2rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Strategy</label>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                {['fixed', 'percentage', 'slab'].map(type => (
                                                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem', border: formData.v2_commissionType === type ? '2px solid var(--v2-primary)' : '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', background: formData.v2_commissionType === type ? '#f0fdfa' : 'transparent' }}>
                                                        <input type="radio" name="commType" value={type} checked={formData.v2_commissionType === type} onChange={e => setFormData({ ...formData, v2_commissionType: e.target.value })} />
                                                        <span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{type}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {formData.v2_commissionType !== 'slab' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                {[{ l: 'Service Commission', k: 'v2_serviceCommission' }, { l: 'Product Commission', k: 'v2_productCommission' }].map(f => (
                                                    <div key={f.k}><label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>{f.l}</label><div style={{ position: 'relative' }}><input type="number" value={formData[f.k] || 0} onChange={e => setFormData({ ...formData, [f.k]: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', outline: 'none', paddingRight: '2rem' }} /><span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--v2-text-muted)' }}>{formData.v2_commissionType === 'percentage' ? '%' : '₹'}</span></div></div>
                                                ))}
                                            </div>
                                        )}

                                        {formData.v2_commissionType === 'slab' && (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>Revenue Slabs</label>
                                                    <button onClick={addSlab} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: 'var(--v2-radius-sm)', cursor: 'pointer' }}>+ Add Slab</button>
                                                </div>
                                                {(formData.v2_slabs || []).map((slab, i) => (
                                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'end' }}>
                                                        <div><label style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Above ₹</label><input type="number" value={slab.threshold} onChange={e => updateSlab(i, 'threshold', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--v2-border)', borderRadius: '4px' }} /></div>
                                                        <div><label style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Commission %</label><input type="number" value={slab.rate} onChange={e => updateSlab(i, 'rate', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--v2-border)', borderRadius: '4px' }} /></div>
                                                        <button onClick={() => removeSlab(i)} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: '0.5rem' }}>🗑</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ROLES & PERMISSIONS */}
                                {activeTab === 'roles' && (
                                    <div style={{ maxWidth: '550px' }}>
                                        <div style={{ marginBottom: '2rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Role Preset</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                                {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                                                    <div key={key} onClick={() => applyRolePreset(key)} style={{ padding: '1rem', border: formData.v2_role === key ? '2px solid var(--v2-primary)' : '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-md)', cursor: 'pointer', background: formData.v2_role === key ? '#f0fdfa' : 'transparent', textAlign: 'center' }}>
                                                        <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{val.label}</div>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', marginTop: '0.25rem' }}>{val.desc}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem', background: '#f8fafc', padding: '1.5rem', borderRadius: 'var(--v2-radius-md)' }}>
                                            <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: '800' }}>Dashboard</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                                {PERMISSIONS_LIST.map(p => (
                                                    <label key={p.k} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={formData.v2_permissions?.[p.k] || false} 
                                                            onChange={e => updatePermission(p.k, e.target.checked)} 
                                                            style={{ width: '18px', height: '18px', accentColor: '#1e293b', cursor: 'pointer' }} 
                                                        />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b' }}>{p.l}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* PERFORMANCE */}
                                {activeTab === 'performance' && (
                                    <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                            {[{ l: 'Total Revenue', v: fmt(perfStats.totalRevenue), c: 'var(--v2-primary)' }, { l: 'Total Bills', v: perfStats.totalBills }, { l: 'Avg per Bill', v: fmt(perfStats.avgBill) }].map((s, i) => (
                                                <div key={i} className="v2-card" style={{ padding: '1.25rem' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>{s.l}</div>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: s.c || 'var(--v2-text-main)' }}>{s.v}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>Recent Sales</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {staffSales.slice(0, 20).map(s => (
                                                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', background: 'white' }}>
                                                    <div><div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{s.clientName || 'Walk-in'}</div><div style={{ fontSize: '0.7rem', color: 'var(--v2-text-muted)' }}>{s.timestamp?.toDate?.()?.toLocaleDateString('en-IN') || '—'}</div></div>
                                                    <div style={{ fontWeight: '800', color: 'var(--v2-primary)' }}>{fmt(s.totalAmount)}</div>
                                                </div>
                                            ))}
                                            {staffSales.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No sales data found.</div>}
                                        </div>
                                    </div>
                                )}

                                {/* ATTENDANCE */}
                                {activeTab === 'attendance' && (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase' }}>Attendance Logs</h4>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{attendanceLogs.length} record{attendanceLogs.length !== 1 ? 's' : ''}</span>
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
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                                    {[{ l: 'Days Present', v: present }, { l: 'Avg Hours/Day', v: avgHrs + (avgHrs !== '—' ? 'h' : '') }, { l: 'Total Logs', v: attendanceLogs.length }].map((s, i) => (
                                                        <div key={i} className="v2-card" style={{ padding: '0.85rem 1rem' }}>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>{s.l}</div>
                                                            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--v2-primary)' }}>{s.v}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}

                                        {/* Log rows */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                                                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                                                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                                                            <div>No attendance records found for {selectedStaff.name}.</div>
                                                            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Records will appear here after staff clock in via the Calendar.</div>
                                                        </div>
                                                    );
                                                }

                                                return sortedDates.map(dateStr => {
                                                    const dayLogs = grouped[dateStr].sort((a,b) => (a.timestamp?.toMillis?.()||0) - (b.timestamp?.toMillis?.()||0));
                                                    const ci = dayLogs.find(l => l.type === 'clock_in')?.timestamp?.toDate?.();
                                                    const co = dayLogs.find(l => l.type === 'clock_out')?.timestamp?.toDate?.();
                                                    const hoursWorked = ci && co ? ((co - ci) / 3600000).toFixed(1) : null;
                                                    
                                                    return (
                                                        <div key={dateStr} style={{ border: '1px solid var(--v2-border)', borderRadius: 'var(--v2-radius-sm)', background: 'white', overflow: 'hidden' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: '#f8fafc', borderBottom: '1px solid var(--v2-border)' }}>
                                                                <div style={{ fontWeight: '700', fontSize: '0.875rem' }}>{new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    {hoursWorked ? (
                                                                        <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--v2-primary)' }}>{hoursWorked}h</div>
                                                                    ) : (
                                                                        <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>● Active</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div style={{ padding: '0.5rem 1rem' }}>
                                                                {dayLogs.map(log => (
                                                                    <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                                        <div style={{ width: '80px', fontSize: '0.75rem', color: 'var(--v2-text-muted)', fontWeight: '600' }}>
                                                                            {log.timestamp?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: log.type === 'clock_in' ? '#059669' : '#e11d48' }}>
                                                                                {log.type === 'clock_in' ? '☀️ Clock In' : '🌙 Clock Out'}
                                                                            </span>
                                                                        </div>
                                                                        {log.photoUrl && (
                                                                            <img src={log.photoUrl} alt="Attendance" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
