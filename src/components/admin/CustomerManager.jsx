import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../../context/DataProvider';
import { collection, doc, setDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import CrmSyncUtility from './CrmSyncUtility';

export default function CustomerManager() {
    const { customers, loadingCustomers, settings, isPremiumActive, trialDaysRemaining } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importLog, setImportLog] = useState([]);
    const [showSync, setShowSync] = useState(false);
    const [showAudit, setShowAudit] = useState(false);
    const [showPremiumModal, setShowPremiumModal] = useState(false);

    const suspiciousCustomers = customers?.filter(c => {
        const nameLower = (c.name || "").toLowerCase();
        const phone = c.phone || "";
        const totalSpent = c.globalStats?.totalSpent || 0;
        const totalVisits = c.globalStats?.totalVisits || 0;

        return (
            ["1234567890", "9999999999", "0000000000"].includes(phone) ||
            ["test", "rish", "demo", "client a"].some(p => nameLower.includes(p)) ||
            (totalSpent === 0 && totalVisits > 0)
        );
    }) || [];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    };

    const filteredCustomers = customers?.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery)
    ) || [];

    const handleAuditClick = () => {
        if (isPremiumActive) {
            setShowAudit(!showAudit);
            setShowSync(false);
        } else {
            setShowPremiumModal(true);
        }
    };

    const handleDelete = async (phone, name) => {
        if (!window.confirm(`Are you sure you want to permanently delete the profile for ${name}?`)) return;
        try {
            await deleteDoc(doc(db, 'customers', phone));
            alert('Profile removed successfully.');
        } catch (err) {
            console.error("Delete failed:", err);
            alert('Failed to delete profile.');
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImportLoading(true);
        setImportLog(['Reading file...']);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Assume format: Name, Phone, Visits, TotalSpent
            // Skip header if exists
            let startIndex = 0;
            if (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('phone')) {
                startIndex = 1;
            }

            let successCount = 0;
            let errorCount = 0;
            const logs = [];

            for (let i = startIndex; i < lines.length; i++) {
                const parts = lines[i].split(',').map(p => p.trim());
                if (parts.length < 2) continue;

                const [name, phone, visits, spent] = parts;

                // Validate phone (rough check)
                if (!phone || phone.length < 10) {
                    logs.push(`Line ${i + 1}: Invalid phone number "${phone}"`);
                    errorCount++;
                    continue;
                }

                try {
                    const custRef = doc(db, 'customers', phone);
                    const existing = await getDoc(custRef);

                    const newData = {
                        name: name,
                        phone: phone,
                        globalStats: {
                            totalVisits: parseInt(visits || 0),
                            totalSpent: parseFloat(spent || 0),
                            lastVisitOverall: serverTimestamp()
                        },
                        history: [], // For future use
                        referralCode: `X-${phone.slice(-4)}`, // Placeholder until sync
                        lastUpdated: serverTimestamp()
                    };

                    await setDoc(custRef, newData, { merge: true });
                    successCount++;
                } catch (err) {
                    console.error("Import error:", err);
                    logs.push(`Line ${i + 1}: Failed to save "${name}"`);
                    errorCount++;
                }
            }

            setImportLog([
                `IMPORT COMPLETE!`,
                `Successfully imported: ${successCount}`,
                `Failed: ${errorCount}`,
                ...logs
            ]);
            setImportLoading(false);
        };
        reader.readAsText(file);
    };

    return (
        <div className="card" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.1em' }}>GLOBAL CUSTOMER DATABASE</h3>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Master records for all salon clients & rewards</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => { setShowSync(!showSync); setShowAudit(false); }}
                            className="btn-outline"
                            style={{ fontSize: '0.7rem' }}
                        >
                            {showSync ? 'CLOSE SYNC' : 'INITIATE DATA SYNC'}
                        </button>
                        <button
                            onClick={handleAuditClick}
                            className="btn-outline"
                            style={{
                                fontSize: '0.7rem',
                                color: suspiciousCustomers.length > 0 ? 'var(--danger)' : (isPremiumActive && !settings?.isPremiumActive ? '#f59e0b' : 'inherit'),
                                borderColor: suspiciousCustomers.length > 0 ? 'var(--danger)' : (isPremiumActive && !settings?.isPremiumActive ? '#f59e0b' : 'inherit'),
                                fontWeight: (isPremiumActive && !settings?.isPremiumActive) ? '900' : '700'
                            }}
                        >
                            {isPremiumActive && !settings?.isPremiumActive ? `⏳ TRIAL: ${trialDaysRemaining}D LEFT` : (showAudit ? 'HIDE AUDIT' : `🔒 AUDIT DATABASE (${suspiciousCustomers.length})`)}
                        </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="file"
                            id="csvImport"
                            accept=".csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={importLoading}
                        />
                        <label
                            htmlFor="csvImport"
                            className="btn-primary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: '2.5rem',
                                padding: '0 1.5rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                opacity: importLoading ? 0.5 : 1
                            }}
                        >
                            {importLoading ? 'IMPORTING...' : 'BULK IMPORT (CSV)'}
                        </label>
                    </div>
                </div>
            </div>

            {showSync && (
                <div style={{ marginBottom: '3rem' }}>
                    <CrmSyncUtility onComplete={() => setShowSync(false)} />
                </div>
            )}

            {showAudit && (
                <div className="card animate-fade-in" style={{ marginBottom: '2rem', background: '#fff1f2', border: '1px solid var(--danger)', padding: '2rem' }}>
                    {!settings?.isPremiumActive && (
                        <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #fee2e2', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            <span style={{ fontWeight: '900', color: 'var(--text-accent)' }}>TRIAL ACTIVE:</span> This feature is unlocked for your testing period. You have <b>{trialDaysRemaining} days remaining</b>.
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h4 style={{ color: 'var(--danger)', margin: 0, fontSize: '0.9rem', letterSpacing: '0.1em' }}>SUSPICIOUS RECORDS DETECTED</h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                                These records match common test patterns (Placeholders, "Test" names, or ₹0 spend).
                            </p>
                        </div>
                        <div style={{ background: 'var(--danger)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '2rem', fontSize: '0.7rem', fontWeight: '900' }}>
                            {suspiciousCustomers.length} FLAGGED
                        </div>
                    </div>

                    <div style={{ maxHeight: '350px', overflowY: 'auto', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #fee2e2' }}>
                                    <th style={{ padding: '1rem', fontSize: '0.65rem', letterSpacing: '0.1em', opacity: 0.6 }}>NAME</th>
                                    <th style={{ padding: '1rem', fontSize: '0.65rem', letterSpacing: '0.1em', opacity: 0.6 }}>PHONE</th>
                                    <th style={{ padding: '1rem', fontSize: '0.65rem', letterSpacing: '0.1em', opacity: 0.6 }}>REASON</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.65rem', letterSpacing: '0.1em', opacity: 0.6 }}>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suspiciousCustomers.map(c => {
                                    const nameLower = (c.name || "").toLowerCase();
                                    const phone = c.phone || "";
                                    const totalSpent = c.globalStats?.totalSpent || 0;
                                    const totalVisits = c.globalStats?.totalVisits || 0;
                                    let reason = "INCONSISTENT DATA";
                                    if (["1234567890", "9999999999", "0000000000"].includes(phone)) reason = "PLACEHOLDER PHONE";
                                    else if (["test", "rish", "demo", "client a"].some(p => nameLower.includes(p))) reason = "TEST NAME";
                                    else if (totalSpent === 0 && totalVisits > 0) reason = "₹0 SPEND HISTORY";

                                    return (
                                        <tr key={c.phone} style={{ borderBottom: '1px solid #fef2f2' }}>
                                            <td style={{ padding: '1rem', fontWeight: '800', fontSize: '0.85rem' }}>{c.name}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.phone}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--danger)', background: '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                                    {reason}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleDelete(c.phone, c.name)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: '900', fontSize: '0.65rem', textDecoration: 'underline' }}
                                                >
                                                    DELETE
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Import Feedback */}
            {importLog.length > 0 && (
                <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                    {importLog.map((log, idx) => (
                        <div key={idx} style={{ color: log.includes('Failed') || log.includes('Invalid') ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {log}
                        </div>
                    ))}
                    <button
                        onClick={() => setImportLog([])}
                        style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Clear log
                    </button>
                </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Search master database by Name or Phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ height: '3.5rem', fontSize: '1rem' }}
                />
            </div>

            {loadingCustomers ? (
                <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>SYNCHRONIZING DATABASE...</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--text-primary)' }}>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>CUSTOMER IDENTITY</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>PHONE NUMBER</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>CREDIT PENDING</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem', letterSpacing: '0.15em' }}>TOTAL REVENUE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map(cust => (
                                <tr key={cust.phone} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{cust.name?.toUpperCase()}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            Referral: {cust.referralCode || 'N/A'} • Points: {cust.loyaltyPoints || 0}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        {cust.phone}
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <span style={{
                                            fontWeight: '700',
                                            color: (cust.pendingBalance || 0) > 0 ? 'var(--danger)' : 'var(--text-secondary)',
                                            fontSize: '0.9rem'
                                        }}>
                                            {formatCurrency(cust.pendingBalance || 0)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                                        <span style={{ fontWeight: '900', fontSize: '1rem' }}>{formatCurrency(cust.globalStats?.totalSpent || 0)}</span>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                            {cust.globalStats?.totalVisits || 0} VISITS
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-secondary)' }}>NO CUSTOMERS FOUND IN MASTER DATABASE.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Premium Feature Modal - Rendered via Portal to Body */}
            {showPremiumModal && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowPremiumModal(false)}>
                    <div className="card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', padding: '3rem', background: 'white', textAlign: 'center', border: '2px solid var(--primary)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🔒</div>
                        <h3 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>TRIAL EXPIRED</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
                            Your 30-day trial for the <strong>Audit Database</strong> tool has concluded.
                            To continue using this feature, please contact your developer for activation.
                        </p>
                        <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem', textAlign: 'left' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: '900', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '1rem' }}>CONTACT DEVELOPER</div>
                            <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Gokul (Developer)</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>📱 Phone: +91 9629180431</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>📧 Email: yoursxyn@gmail.com</div>
                        </div>
                        <button className="btn-primary" onClick={() => window.open('https://wa.me/919629180431', '_blank')} style={{ width: '100%', height: '3.5rem', fontSize: '0.9rem', background: '#25D366', color: 'white', border: 'none' }}>
                            WHATSAPP DEVELOPER
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
