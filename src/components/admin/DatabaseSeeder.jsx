import { useState, useEffect } from 'react';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

const REAL_SERVICES = [
    // ... (unchanged)
];

export default function DatabaseSeeder() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [roleSelection, setRoleSelection] = useState('stylist');
    const { currentUser } = useAuth();

    const seedServices = async () => {
        setLoading(true);
        setStatus('Starting seed...');
        try {
            for (const service of REAL_SERVICES) {
                await addDoc(collection(db, 'services'), service);
            }
            setStatus('Success! Real services added.');
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const setupSharedAccount = async () => {
        setLoading(true);
        setStatus('Setting up shared account...');
        try {
            // 1. Try to create the Auth account
            try {
                const creds = await createUserWithEmailAndPassword(auth, 'contact@hashtagsaloon.com', 'stylist123');
                // 2. Create Firestore profile
                await setDoc(doc(db, 'users', creds.user.uid), {
                    email: 'contact@hashtagsaloon.com',
                    role: 'stylist',
                    name: 'Kiosk Stylist',
                    isKiosk: true,
                    createdAt: new Date()
                });
                setStatus('Success! Shared account created.');
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    setStatus('Shared account exists in Auth. If you are logged in as contact@hashtagsaloon.com, use Step 3 to create your profile document.');
                } else {
                    throw authError;
                }
            }
        } catch (error) {
            console.error(error);
            setStatus('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const createUserProfile = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                email: currentUser.email,
                role: roleSelection,
                name: currentUser.email.split('@')[0],
                allowedServices: [], // Default to empty (means ALL or NONE depending on logic, strict = none)
                createdAt: new Date()
            });
            setStatus(`Success! Profile created for ${currentUser.email} as ${roleSelection}.`);
        } catch (error) {
            console.error(error);
            setStatus("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ marginTop: '2rem' }}>
            <div className="card">
                <h2>System Setup</h2>
                <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h4>Step 1: Seed Real Services</h4>
                    <button className="btn-primary" onClick={seedServices} disabled={loading}>
                        {loading ? 'Processing...' : 'Seed Services List'}
                    </button>
                </div>

                <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h4>Step 2: Setup Shared Stylist Account</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>This creates the 'contact@hashtagsaloon.com' account needed for Kiosk Mode.</p>
                    <button className="btn-primary" onClick={setupSharedAccount} disabled={loading} style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
                        {loading ? 'Processing...' : 'Setup Shared Account'}
                    </button>
                </div>

                <div>
                    <h4>Step 3: Assign Your Role (Current User)</h4>
                    {currentUser ? (
                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem' }}>
                            <p style={{ fontWeight: 'bold' }}>{currentUser.email}</p>
                            <select className="form-select" value={roleSelection} onChange={(e) => setRoleSelection(e.target.value)} style={{ margin: '1rem 0' }}>
                                <option value="stylist">Stylist</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button className="btn-primary" onClick={createUserProfile} disabled={loading}>Set Role</button>
                        </div>
                    ) : <p>Please Login first.</p>}
                </div>
                {status && <p style={{ marginTop: '1rem', color: 'var(--success)' }}>{status}</p>}
            </div>
        </div>
    );
}
