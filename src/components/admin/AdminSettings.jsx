import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useData } from '../../context/DataProvider';

export default function AdminSettings() {
    const { settings } = useData();
    const [maxDiscount, setMaxDiscount] = useState(50);
    const [referralDiscountAmount, setReferralDiscountAmount] = useState(100);
    const [loyaltyPointRatio, setLoyaltyPointRatio] = useState(100);
    const [loyaltyRedemptionEnabled, setLoyaltyRedemptionEnabled] = useState(true);
    const [pointsToInrRate, setPointsToInrRate] = useState(10);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (settings) {
            setMaxDiscount(settings.maxDiscount || 50);
            setReferralDiscountAmount(settings.referralDiscountAmount || 100);
            setLoyaltyPointRatio(settings.loyaltyPointRatio || 100);
            setLoyaltyRedemptionEnabled(settings.loyaltyRedemptionEnabled !== false);
            setPointsToInrRate(settings.pointsToInrRate || 10);
        }
    }, [settings]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatus('');
        try {
            await setDoc(doc(db, 'settings', 'salon_config'), {
                maxDiscount: parseInt(maxDiscount),
                referralDiscountAmount: parseInt(referralDiscountAmount),
                loyaltyPointRatio: parseInt(loyaltyPointRatio),
                loyaltyRedemptionEnabled,
                pointsToInrRate: parseInt(pointsToInrRate),
                updatedAt: new Date(),
                updatedBy: 'admin'
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

                <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginTop: '3rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.1em' }}>CRM & REWARDS SYSTEM</h3>
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>REFERRAL DISCOUNT (AMOUNT)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Discount given to BOTH the referee and the referrer for a successful new client referral.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: '800' }}>₹</span>
                        <input
                            type="number"
                            className="form-input"
                            style={{ width: '120px', textAlign: 'center' }}
                            value={referralDiscountAmount}
                            onChange={(e) => setReferralDiscountAmount(e.target.value)}
                            min="0"
                            required
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>LOYALTY RATIO (SPEND PER POINT)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        How much money a client has to spend to earn 1 loyalty point (e.g. ₹100 = 1 Point).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.8rem' }}>1 PT PER ₹</span>
                        <input
                            type="number"
                            className="form-input"
                            style={{ width: '120px', textAlign: 'center' }}
                            value={loyaltyPointRatio}
                            onChange={(e) => setLoyaltyPointRatio(e.target.value)}
                            min="10"
                            required
                        />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '3rem', padding: '1.5rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <label className="form-label" style={{ display: 'block', margin: 0 }}>LOYALTY REDEMPTION</label>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Allow clients to spend points for discounts.</p>
                        </div>
                        <div
                            onClick={() => setLoyaltyRedemptionEnabled(!loyaltyRedemptionEnabled)}
                            style={{
                                width: '50px',
                                height: '26px',
                                background: loyaltyRedemptionEnabled ? 'var(--text-primary)' : '#cbd5e1',
                                borderRadius: '13px',
                                padding: '3px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: loyaltyRedemptionEnabled ? 'flex-end' : 'flex-start'
                            }}
                        >
                            <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                        </div>
                    </div>

                    {loyaltyRedemptionEnabled && (
                        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                            <div>
                                <label className="form-label" style={{ fontSize: '0.65rem' }}>REDEMPTION VALUE</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ width: '100px', textAlign: 'center' }}
                                        value={pointsToInrRate}
                                        onChange={(e) => setPointsToInrRate(e.target.value)}
                                        min="1"
                                        required
                                    />
                                    <span style={{ fontWeight: '800', fontSize: '0.8rem' }}>PTS = ₹1 DISCOUNT</span>
                                </div>
                            </div>
                        </div>
                    )}
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

            <div style={{ marginTop: '4rem', padding: '1.5rem', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', border: '1px dashed #cbd5e1' }}>
                <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>INVENTORY SETUP</h4>
                <button
                    onClick={async () => {
                        const products = [
                            { name: "Shampoo (Volumizing)", unit: "ml", stock: 5000, category: "Wash" },
                            { name: "Hair Color (Ash Brown)", unit: "ml", stock: 1000, category: "Color" },
                            { name: "Hair Color (Natural Black)", unit: "ml", stock: 1000, category: "Color" },
                            { name: "Hair Serum (Repair)", unit: "ml", stock: 500, category: "Care" }
                        ];
                        try {
                            for (const p of products) {
                                await setDoc(doc(db, 'products', p.name.replace(/\s+/g, '_').toLowerCase()), {
                                    ...p,
                                    updatedAt: new Date()
                                });
                            }
                            setStatus('Initial products added successfully!');
                        } catch (err) {
                            setStatus('Error adding products: ' + err.message);
                        }
                    }}
                    className="btn-outline"
                    style={{ fontSize: '0.7rem', height: '2.5rem' }}
                >
                    ADD INITIAL PRODUCTS
                </button>
            </div>
        </div>
    );
}
