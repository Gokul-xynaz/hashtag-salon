import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { useData } from '../../../context/DataProvider';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';

export default function BusinessDetails() {
    const { settings, loadingSettings } = useData();
    const fileInputRef = useRef(null);
    
    const [formData, setFormData] = useState({
        businessName: 'Hashtag Salon',
        email: 'hello@hashtagsalon.com',
        phone: '9876543210',
        website: 'www.hashtagsalon.com',
        address: '123 Beauty Avenue, Style District',
        city: 'Mumbai',
        zip: '400001',
        country: 'India',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata',
        logoUrl: ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    useEffect(() => {
        if (settings && !loadingSettings) {
            setFormData(prev => ({ ...prev, ...settings }));
        }
    }, [settings, loadingSettings]);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'salon_config'), formData, { merge: true });
            alert('Business Details saved successfully!');
        } catch (error) {
            console.error("Error saving business details", error);
            alert("Failed to save settings: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingLogo(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            const updatedData = { ...formData, logoUrl: base64String };
            setFormData(updatedData);
            try {
                await setDoc(doc(db, 'settings', 'salon_config'), updatedData, { merge: true });
                alert("Logo uploaded successfully!");
            } catch (error) {
                console.error("Error uploading logo", error);
                alert("Failed to save logo: " + error.message);
            } finally {
                setUploadingLogo(false);
            }
        };
        reader.onerror = () => {
            alert("Failed to read file.");
            setUploadingLogo(false);
        };
        reader.readAsDataURL(file);
    };

    if (loadingSettings) {
        return <Layout><div style={{ padding: '2rem', textAlign: 'center' }}>Loading settings...</div></Layout>;
    }

    return (
        <Layout>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.25rem' }}>Business Details</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)' }}>Manage your salon's core identity, location, and regional settings.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '800px' }}>
                <form onSubmit={handleSave} className="v2-card" style={{ padding: '2rem' }}>
                    {/* Logo Section */}
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--v2-border)' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: 'var(--v2-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '900', overflow: 'hidden' }}>
                            {formData.logoUrl ? (
                                <img src={formData.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                formData.businessName.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '0.25rem' }}>Business Logo</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', marginBottom: '0.75rem' }}>Recommended size: 512x512px. PNG or JPG.</p>
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleLogoUpload}
                            />
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current.click()} 
                                disabled={uploadingLogo}
                                style={{ padding: '0.4rem 1rem', background: '#f1f5f9', border: '1px solid var(--v2-border)', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem' }}>
                                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </button>
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem' }}>Basic Information</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Business Name *</label>
                            <input type="text" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} required style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Contact Email</label>
                            <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Phone Number</label>
                            <input type="tel" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Website</label>
                            <input type="text" value={formData.website || ''} onChange={e => setFormData({...formData, website: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>Location Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Address</label>
                            <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>City</label>
                            <input type="text" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Zip / Postal Code</label>
                            <input type="text" value={formData.zip || ''} onChange={e => setFormData({...formData, zip: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }} />
                        </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.25rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>Regional Settings</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Currency</label>
                            <select value={formData.currency || 'INR (₹)'} onChange={e => setFormData({...formData, currency: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }}>
                                <option>INR (₹)</option>
                                <option>USD ($)</option>
                                <option>EUR (€)</option>
                                <option>GBP (£)</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Timezone</label>
                            <select value={formData.timezone || 'Asia/Kolkata'} onChange={e => setFormData({...formData, timezone: e.target.value})} style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none' }}>
                                <option>Asia/Kolkata</option>
                                <option>America/New_York</option>
                                <option>Europe/London</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--v2-border)', paddingTop: '1.5rem' }}>
                        <button type="submit" disabled={isSaving} style={{ padding: '0.75rem 2.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
}
