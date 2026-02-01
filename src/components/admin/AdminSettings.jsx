import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useData } from '../../context/DataProvider';

export default function AdminSettings() {
    const { settings } = useData();
    const [maxDiscount, setMaxDiscount] = useState(50);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (settings) {
            setMaxDiscount(settings.maxDiscount || 50);
        }
    }, [settings]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatus('');
        try {
            await setDoc(doc(db, 'settings', 'salon_config'), {
                maxDiscount: parseInt(maxDiscount),
                updatedAt: new Date(),
                updatedBy: 'admin' // In a real app, use currently logged in admin name
            });
            setStatus('Settings updated successfully!');
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card animate-fade-in" style={{ padding: '2.5rem', maxWidth: '600px' }}>
            <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.1em' }}>SALON SYSTEM CONFIGURATION</h3>
            </div>

            <form onSubmit={handleSave}>
                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>MAXIMUM ALLOWED DISCOUNT (%)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Stylists will be restricted from offering discounts higher than this value during checkout.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input
                            type="number"
                            className="form-input"
                            style={{ width: '100px', textAlign: 'center' }}
                            value={maxDiscount}
                            onChange={(e) => setMaxDiscount(e.target.value)}
                            min="0"
                            max="100"
                            required
                        />
                        <span style={{ fontWeight: '800' }}>%</span>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '0 3rem', height: '3.5rem' }} disabled={saving}>
                        {saving ? 'SAVING...' : 'APPLY GLOBAL SETTINGS'}
                    </button>
                    {status && (
                        <p style={{ marginTop: '1rem', color: status.includes('Error') ? 'var(--danger)' : 'var(--success)', fontWeight: '700', fontSize: '0.85rem' }}>
                            {status}
                        </p>
                    )}
                </div>
            </form>
        </div>
    );
}
