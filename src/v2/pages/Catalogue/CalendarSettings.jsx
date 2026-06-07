import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

const SETTINGS_DOC = doc(db, 'settings', 'salon_config');

const DEFAULT_SETTINGS = {
    slotDuration: 15,
    bufferTime: 5,
    allowOnlineBooking: true,
    requireDeposit: false,
    statusColors: {
        booked: '#3b82f6',
        arrived: '#f59e0b',
        started: '#10b981',
        done: '#6b7280',
        noShow: '#dc2626'
    }
};

export default function CalendarSettings() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const snap = await getDoc(SETTINGS_DOC);
                if (snap.exists() && snap.data().calendarSettings) {
                    setSettings({ ...DEFAULT_SETTINGS, ...snap.data().calendarSettings });
                }
            } catch (err) {
                console.error('Error loading calendar settings:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            await setDoc(SETTINGS_DOC, { calendarSettings: settings }, { merge: true });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving calendar settings:', err);
            alert('Failed to save settings. Check your Firestore permissions.');
        } finally {
            setIsSaving(false);
        }
    };

    const Toggle = ({ value, onToggle, label, description }) => (
        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <div
                onClick={onToggle}
                style={{ position: 'relative', width: '40px', height: '22px', background: value ? '#10b981' : '#e2e8f0', borderRadius: '20px', transition: '0.3s', flexShrink: 0 }}
            >
                <div style={{ position: 'absolute', top: '2px', left: value ? '20px' : '2px', width: '18px', height: '18px', background: 'white', borderRadius: '50%', transition: '0.3s' }} />
            </div>
            <div>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', display: 'block' }}>{label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>{description}</span>
            </div>
        </label>
    );

    if (loading) return (
        <Layout>
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading settings…</div>
        </Layout>
    );

    return (
        <Layout>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Calendar Settings</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Configure appointment slots, buffer times, and visual status colors. All changes are saved to your salon's Firestore config.</p>
            </div>

            <div style={{ maxWidth: '800px' }}>
                <form onSubmit={handleSave} className="v2-card" style={{ padding: '2rem' }}>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem' }}>Slot Configuration</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Default Slot Duration (mins)</label>
                            <select value={settings.slotDuration} onChange={e => setSettings({ ...settings, slotDuration: Number(e.target.value) })} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }}>
                                <option value={5}>5 Minutes</option>
                                <option value={10}>10 Minutes</option>
                                <option value={15}>15 Minutes</option>
                                <option value={30}>30 Minutes</option>
                                <option value={60}>60 Minutes</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Buffer Time Between Appointments</label>
                            <select value={settings.bufferTime} onChange={e => setSettings({ ...settings, bufferTime: Number(e.target.value) })} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }}>
                                <option value={0}>0 Minutes (No Buffer)</option>
                                <option value={5}>5 Minutes</option>
                                <option value={10}>10 Minutes</option>
                                <option value={15}>15 Minutes</option>
                            </select>
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>Booking Rules</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
                        <Toggle
                            value={settings.allowOnlineBooking}
                            onToggle={() => setSettings({ ...settings, allowOnlineBooking: !settings.allowOnlineBooking })}
                            label="Allow Online Booking via Widget"
                            description="Enable clients to book directly through your custom link."
                        />
                        <Toggle
                            value={settings.requireDeposit}
                            onToggle={() => setSettings({ ...settings, requireDeposit: !settings.requireDeposit })}
                            label="Require Booking Deposit"
                            description="Mandate a percentage payment before confirming online bookings."
                        />
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>Appointment Status Colors</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        {Object.entries(settings.statusColors).map(([status, color]) => (
                            <div key={status} style={{ textAlign: 'center' }}>
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => setSettings({ ...settings, statusColors: { ...settings.statusColors, [status]: e.target.value } })}
                                    style={{ width: '100%', height: '40px', padding: '0.2rem', border: '1px solid var(--v2-border)', borderRadius: '6px', cursor: 'pointer', marginBottom: '0.5rem' }}
                                />
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--v2-text-muted)' }}>{status}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', borderTop: '1px solid var(--v2-border)', paddingTop: '2rem' }}>
                        {saveSuccess && (
                            <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.85rem' }}>
                                ✓ Settings saved successfully!
                            </span>
                        )}
                        <button type="submit" disabled={isSaving} style={{ padding: '0.75rem 2.5rem', background: isSaving ? '#94a3b8' : 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: isSaving ? 'not-allowed' : 'pointer', transition: '0.2s' }}>
                            {isSaving ? 'Saving…' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
