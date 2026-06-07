import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useData } from '../../../context/DataProvider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_SHIFT = { start: '09:00', end: '18:00', isOff: false };

function getWeekDays(date) {
    const days = [];
    const start = new Date(date);
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(start.getDate() + diff);
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
    }
    return days;
}

function weekKey(date) {
    const mon = new Date(date);
    const day = mon.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    mon.setDate(mon.getDate() + diff);
    return mon.toISOString().slice(0, 10);
}

function ShiftModal({ editModal, stylists, getShift, updateShift, setEditModal, weekDays }) {
    const [localShift, setLocalShift] = useState(null);
    
    // Sync local state with prop when editModal changes
    React.useEffect(() => {
        if (editModal) {
            setLocalShift(getShift(editModal.stylistId, editModal.dayKey));
        }
    }, [editModal, getShift]);

    if (!editModal || !localShift) return null;
    const { stylistId, dayKey, dayLabel } = editModal;
    const stylist = stylists.find(s => s.id === stylistId);

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="v2-card" style={{ width: '100%', maxWidth: '360px', padding: '2rem', margin: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '0.25rem' }}>
                    {stylist?.name} — {dayLabel}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)', marginBottom: '1.5rem' }}>
                    Week of {weekDays[0].toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </p>

                <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
                    <div
                        onClick={() => setLocalShift(p => ({ ...p, isOff: !p.isOff }))}
                        style={{ position: 'relative', width: '40px', height: '22px', background: localShift.isOff ? '#ef4444' : '#e2e8f0', borderRadius: '20px', transition: '0.3s', flexShrink: 0 }}
                    >
                        <div style={{ position: 'absolute', top: '2px', left: localShift.isOff ? '20px' : '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: '0.3s' }} />
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: localShift.isOff ? '#dc2626' : 'inherit' }}>
                        {localShift.isOff ? 'Day Off' : 'Working Day'}
                    </span>
                </label>

                {!localShift.isOff && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Start Time</label>
                            <input type="time" value={localShift.start} onChange={e => setLocalShift(p => ({ ...p, start: e.target.value }))} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>End Time</label>
                            <input type="time" value={localShift.end} onChange={e => setLocalShift(p => ({ ...p, end: e.target.value }))} style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditModal(null)} style={{ padding: '0.6rem 1.25rem', background: 'white', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={() => { updateShift(stylistId, dayKey, localShift); setEditModal(null); }}
                        style={{ padding: '0.6rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function StaffSchedule() {
    const { stylists } = useData();
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [schedules, setSchedules] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [editModal, setEditModal] = useState(null); // { stylistId, dayKey }

    const weekDays = getWeekDays(currentWeek);
    const wKey = weekKey(currentWeek);

    // Load schedule for this week from Firestore
    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            const schedRef = doc(db, 'staff_schedules', wKey);
            try {
                const snap = await getDoc(schedRef);
                if (snap.exists()) {
                    setSchedules(snap.data());
                } else {
                    setSchedules({});
                }
            } catch (err) {
                console.error('Error loading schedule:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, [wKey]);

    const getShift = (stylistId, dayKey) => {
        return schedules?.[stylistId]?.[dayKey] || DEFAULT_SHIFT;
    };

    const updateShift = (stylistId, dayKey, shift) => {
        setSchedules(prev => ({
            ...prev,
            [stylistId]: {
                ...(prev[stylistId] || {}),
                [dayKey]: shift
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            await setDoc(doc(db, 'staff_schedules', wKey), schedules);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save. Check Firestore permissions.');
        } finally {
            setSaving(false);
        }
    };



    return (
        <Layout>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Scheduled Shifts</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Click any cell to edit working hours or mark a day off. Click Save to persist to Firestore.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--v2-border)' }}>
                        <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }} style={{ padding: '0.4rem 0.75rem', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}>← Prev</button>
                        <span style={{ fontWeight: '800', fontSize: '0.85rem', padding: '0 0.5rem' }}>
                            {weekDays[0].toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <button onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }} style={{ padding: '0.4rem 0.75rem', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}>Next →</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {saveSuccess && <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>✓ Saved!</span>}
                        <button onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.25rem', background: saving ? '#94a3b8' : 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}>
                            {saving ? 'Saving…' : 'Save Schedule'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="v2-card" style={{ padding: 0, overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading schedule…</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--v2-border)' }}>
                                <th style={{ padding: '1rem 1.25rem', width: '180px', textAlign: 'left', fontWeight: '800', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10 }}>Staff Member</th>
                                {weekDays.map((date, i) => (
                                    <th key={i} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', borderLeft: '1px solid var(--v2-border)' }}>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>{DAYS[i]}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--v2-text-main)' }}>{date.getDate()}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {stylists.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>No staff found.</td></tr>
                            ) : stylists.map(staff => (
                                <tr key={staff.id} style={{ borderBottom: '1px solid var(--v2-border)' }}>
                                    <td style={{ padding: '0.75rem 1.25rem', borderRight: '1px solid var(--v2-border)', position: 'sticky', left: 0, background: 'white', zIndex: 5 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: staff.color || 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.75rem', flexShrink: 0 }}>
                                                {staff.name?.charAt(0) || 'S'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '0.82rem' }}>{staff.name}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--v2-text-muted)' }}>{staff.role || 'Stylist'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {DAY_KEYS.map((dayKey, i) => {
                                        const shift = getShift(staff.id, dayKey);
                                        return (
                                            <td
                                                key={dayKey}
                                                onClick={() => setEditModal({ stylistId: staff.id, dayKey, dayLabel: `${DAYS[i]} ${weekDays[i].getDate()}` })}
                                                style={{ padding: '0.4rem', textAlign: 'center', borderRight: '1px solid #f1f5f9', background: shift.isOff ? '#fef2f2' : 'white', cursor: 'pointer', transition: 'background 0.15s' }}
                                                title="Click to edit shift"
                                                onMouseEnter={e => e.currentTarget.style.background = shift.isOff ? '#fee2e2' : '#f8fafc'}
                                                onMouseLeave={e => e.currentTarget.style.background = shift.isOff ? '#fef2f2' : 'white'}
                                            >
                                                {shift.isOff ? (
                                                    <div style={{ padding: '0.4rem 0.25rem', borderRadius: '5px', background: '#fee2e2', color: '#dc2626', fontSize: '0.68rem', fontWeight: '700' }}>Day Off</div>
                                                ) : (
                                                    <div style={{ padding: '0.35rem 0.25rem', borderRadius: '5px', border: '1px solid var(--v2-border)', fontSize: '0.68rem', fontWeight: '600', color: 'var(--v2-text-main)', lineHeight: '1.5' }}>
                                                        {shift.start}<br />
                                                        <span style={{ color: 'var(--v2-text-muted)', fontWeight: '400' }}>to</span><br />
                                                        {shift.end}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ShiftModal editModal={editModal} stylists={stylists} getShift={getShift} updateShift={updateShift} setEditModal={setEditModal} weekDays={weekDays} />
        </Layout>
    );
}
