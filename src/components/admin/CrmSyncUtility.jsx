import { useState } from 'react';
import { collection, query, getDocs, doc, setDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useData } from '../../context/DataProvider';

export default function CrmSyncUtility({ onComplete }) {
    const { stylists } = useData();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const runSync = async () => {
        setLoading(true);
        setLogs(['Starting Synchronization...']);

        try {
            // Phase 1: Ensure Stylists have shortCodes
            setProgress('Verifying Stylist ShortCodes...');
            addLog('Phase 1: Verifying Stylists...');

            const batch = writeBatch(db);
            let stylistUpdateCount = 0;

            for (const stylist of stylists) {
                if (!stylist.shortCode) {
                    const shortCode = stylist.name.slice(0, 3).toUpperCase();
                    batch.update(doc(db, 'users', stylist.id), { shortCode });
                    stylistUpdateCount++;
                    addLog(`Assigned code ${shortCode} to ${stylist.name}`);
                }
            }
            if (stylistUpdateCount > 0) await batch.commit();
            addLog(`Completed: ${stylistUpdateCount} stylists updated.`);

            // Phase 2: Migrate Historical Appointments
            setProgress('Scanning Historical Appointments...');
            addLog('Phase 2: Migrating Appointments...');

            const appointmentsSnap = await getDocs(collection(db, 'appointments'));
            const appointments = appointmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            addLog(`Found ${appointments.length} historical records.`);

            const customerMap = {}; // phone -> aggregated data

            appointments.forEach(app => {
                const phone = app.clientPhone;
                if (!phone || phone.length < 10) return;

                if (!customerMap[phone]) {
                    customerMap[phone] = {
                        name: app.clientName,
                        phone: phone,
                        associatedStylists: new Set(),
                        stylistData: {}, // stylistId -> { visits, spent, lastVisit }
                        globalStats: { totalVisits: 0, totalSpent: 0, lastVisitOverall: null }
                    };
                }

                const c = customerMap[phone];
                c.associatedStylists.add(app.stylistId);

                // Update Stylist Specific Data
                if (!c.stylistData[app.stylistId]) {
                    c.stylistData[app.stylistId] = { visits: 0, spent: 0, lastVisit: null };
                }
                const sd = c.stylistData[app.stylistId];
                sd.visits += 1;
                sd.spent += (app.totalAmount || 0);
                const appDate = app.timestamp?.toDate() || new Date(0);
                if (!sd.lastVisit || appDate > sd.lastVisit) sd.lastVisit = appDate;

                // Update Global Stats
                c.globalStats.totalVisits += 1;
                c.globalStats.totalSpent += (app.totalAmount || 0);
                if (!c.globalStats.lastVisitOverall || appDate > c.globalStats.lastVisitOverall) {
                    c.globalStats.lastVisitOverall = appDate;
                }
            });

            // Phase 3: Upsert to Customers Collection
            const phones = Object.keys(customerMap);
            setProgress(`Writing ${phones.length} Customer Profiles...`);
            addLog(`Phase 3: Saving ${phones.length} customers...`);

            let savedCount = 0;
            for (const phone of phones) {
                const c = customerMap[phone];

                // Find primary stylist for the referral code
                const mostVisitedStylistId = Object.entries(c.stylistData)
                    .sort(([, a], [, b]) => b.visits - a.visits)[0][0];
                const primaryStylist = stylists.find(s => s.id === mostVisitedStylistId);
                const sc = primaryStylist?.shortCode || 'SAL';

                const finalData = {
                    name: c.name,
                    phone: c.phone,
                    associatedStylists: Array.from(c.associatedStylists),
                    stylistData: c.stylistData,
                    globalStats: c.globalStats,
                    referralCode: `${sc}-${phone.slice(-4)}`,
                    loyaltyPoints: Math.floor(c.globalStats.totalSpent / 100), // Default backfill rule
                    pendingBalance: 0, // Reset history to no debt
                    referralRewardsBalance: 0,
                    lastUpdated: serverTimestamp()
                };

                await setDoc(doc(db, 'customers', phone), finalData, { merge: true });
                savedCount++;
                if (savedCount % 10 === 0) setProgress(`Saving... ${savedCount}/${phones.length}`);
            }

            addLog(`SUCCESS: Sync complete! ${savedCount} profiles active.`);
            setProgress('Synchronization Finished.');
            if (onComplete) onComplete();

        } catch (err) {
            console.error("Sync failed:", err);
            addLog(`ERROR: ${err.message}`);
            setProgress('Failing...');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>CRM DATA SYNCHRONIZATION</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                This tool will scan all historical appointments and backfill the CRM database. It will also assign missing referral codes to stylists.
            </p>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.1em' }}>{progress.toUpperCase()}</div>
                </div>
            ) : (
                <button
                    onClick={runSync}
                    className="btn-primary"
                    style={{ width: '100%', height: '3.5rem' }}
                >
                    INITIATE MASTER SYNC
                </button>
            )}

            {logs.length > 0 && (
                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--text-secondary)', marginBottom: '1rem' }}>EXECUTION LOG</div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#000', color: '#0f0', padding: '1rem', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                        {logs.map((l, i) => <div key={i}>&gt; {l}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
}
