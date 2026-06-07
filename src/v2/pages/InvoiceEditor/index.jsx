import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useData } from '../../../context/DataProvider';
import { useAuth } from '../../../context/AuthContext';

export default function InvoiceEditor() {
    const { stylists, products, services, settings } = useData();
    const { userRole } = useAuth();
    
    // Search & Selection State
    const [searchId, setSearchId] = useState('');
    const [searching, setSearching] = useState(false);
    const [foundBill, setFoundBill] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    
    // Edit Form State
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [paymentType, setPaymentType] = useState('cash');
    const [totalAmount, setTotalAmount] = useState(0);
    const [payingNow, setPayingNow] = useState(0);
    const [dueAmount, setDueAmount] = useState(0);
    const [billDate, setBillDate] = useState('');
    const [billTime, setBillTime] = useState('');
    const [selectedStylistId, setSelectedStylistId] = useState('');
    const [notes, setNotes] = useState('');
    
    // Items editing
    const [serviceItems, setServiceItems] = useState([]);
    const [productItems, setProductItems] = useState([]);
    
    // Security PIN Modal State
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [saving, setSaving] = useState(false);

    // Auto-calculate dues when total or paying now changes
    useEffect(() => {
        const total = parseFloat(totalAmount) || 0;
        const paid = parseFloat(payingNow) || 0;
        setDueAmount(Math.max(0, total - paid));
    }, [totalAmount, payingNow]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        const cleanId = searchId.trim().toUpperCase();
        if (cleanId.length < 4) {
            setErrorMsg('Please enter at least 4 characters of the Invoice ID.');
            return;
        }
        
        setSearching(true);
        setErrorMsg('');
        setFoundBill(null);
        
        try {
            // First try direct lookup if it looks like a full document ID
            if (cleanId.length >= 18) {
                const docRef = doc(db, 'appointments', searchId.trim());
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    loadBillData({ id: docSnap.id, ...docSnap.data() });
                    setSearching(false);
                    return;
                }
            }
            
            // Otherwise, fetch recent docs and match prefix
            const q = query(collection(db, 'appointments'), orderBy('timestamp', 'desc'), limit(1000));
            const snap = await getDocs(q);
            const matches = snap.docs.filter(d => d.id.toUpperCase().startsWith(cleanId));
            
            if (matches.length === 0) {
                setErrorMsg(`No invoice found matching ID prefix "${cleanId}".`);
            } else if (matches.length > 1) {
                setErrorMsg(`Multiple invoices match prefix "${cleanId}". Please enter more characters.`);
            } else {
                loadBillData({ id: matches[0].id, ...matches[0].data() });
            }
        } catch (err) {
            setErrorMsg('Error searching database: ' + err.message);
        } finally {
            setSearching(false);
        }
    };

    const loadBillData = (bill) => {
        setFoundBill(bill);
        setClientName(bill.clientName || '');
        setClientPhone(bill.clientPhone || '');
        setPaymentType(bill.paymentType || 'cash');
        setTotalAmount(bill.totalAmount || 0);
        setPayingNow(bill.payingNow ?? bill.totalAmount ?? 0);
        setDueAmount(bill.dueAmount || 0);
        setSelectedStylistId(bill.stylistId || '');
        setNotes(bill.notes || '');
        setServiceItems(bill.services || []);
        setProductItems(bill.products || []);
        
        if (bill.timestamp) {
            const dateObj = bill.timestamp.toDate ? bill.timestamp.toDate() : new Date(bill.timestamp);
            setBillDate(dateObj.toISOString().split('T')[0]);
            setBillTime(dateObj.toTimeString().substring(0, 5));
        } else {
            setBillDate('');
            setBillTime('');
        }
    };

    const handleUpdateServiceItem = (index, field, val) => {
        setServiceItems(prev => prev.map((item, idx) => {
            if (idx !== index) return item;
            const updated = { ...item, [field]: val };
            if (field === 'price' || field === 'qty') {
                const price = parseFloat(updated.price) || 0;
                const qty = parseInt(updated.qty) || 1;
                updated.total = price * qty;
            }
            return updated;
        }));
    };

    const handleUpdateProductItem = (index, field, val) => {
        setProductItems(prev => prev.map((item, idx) => {
            if (idx !== index) return item;
            const updated = { ...item, [field]: val };
            if (field === 'price' || field === 'qty') {
                const price = parseFloat(updated.price) || 0;
                const qty = parseInt(updated.qty) || 1;
                updated.total = price * qty;
            }
            return updated;
        }));
    };

    const handleRecalculateTotal = () => {
        const svcSum = serviceItems.reduce((s, r) => s + (parseFloat(r.price) || 0) * (parseInt(r.qty) || 1), 0);
        const prodSum = productItems.reduce((s, r) => s + (parseFloat(r.price) || 0) * (parseInt(r.qty) || 1), 0);
        
        // Retain original tip and external charges if any
        const extra = foundBill?.exCharge || 0;
        const tip = foundBill?.tipAmount || 0;
        const discount = foundBill?.discountAmount || 0;
        const gst = foundBill?.gstAmount || 0;
        
        const finalTotal = Math.max(0, svcSum + prodSum + extra + tip + gst - discount);
        setTotalAmount(finalTotal);
    };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        setShowPinModal(true);
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        const correctPIN = settings?.adminOverridePIN || '0261';
        if (pinInput !== correctPIN) {
            alert('Incorrect Admin PIN. Access Denied!');
            return;
        }

        setShowPinModal(false);
        setPinInput('');
        setSaving(true);

        try {
            // Combine date & time into a single Date object
            let finalTimestamp = foundBill.timestamp;
            if (billDate && billTime) {
                const dateParts = billDate.split('-');
                const timeParts = billTime.split(':');
                const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
                finalTimestamp = Timestamp.fromDate(d);
            }

            const primaryStylist = stylists?.find(s => s.id === selectedStylistId);

            const updatedData = {
                clientName,
                clientPhone,
                paymentType,
                totalAmount: parseFloat(totalAmount) || 0,
                payingNow: parseFloat(payingNow) || 0,
                dueAmount: parseFloat(dueAmount) || 0,
                stylistId: selectedStylistId,
                stylistName: primaryStylist?.name || foundBill.stylistName || '',
                services: serviceItems,
                products: productItems,
                notes,
                timestamp: finalTimestamp,
                lastEditedByAdminAt: new Date().toISOString()
            };

            await updateDoc(doc(db, 'appointments', foundBill.id), updatedData);
            alert('Invoice updated successfully! 🧾');
            
            // Reload updated bill
            setFoundBill(prev => ({ ...prev, ...updatedData }));
        } catch (err) {
            alert('Failed to save changes: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (userRole !== 'admin') {
        return (
            <Layout>
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <div style={{ fontWeight: '700' }}>Admin Authorization Required</div>
                    <p style={{ fontSize: '0.85rem' }}>Only administrators can access the secure invoice editor.</p>
                </div>
            </Layout>
        );
    }

    const inputStyle = { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' };

    return (
        <Layout>
            <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '4rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '0.25rem', color: 'var(--v2-text-main)' }}>🛡️ Secure Invoice Editor</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)', marginBottom: '1.5rem' }}>Search for any invoice using its ID prefix to override or correct details.</p>

                {/* Search Bar */}
                <div className="v2-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
                        <input
                            type="text"
                            placeholder="Enter Invoice ID (e.g. EGFVIKPD)"
                            value={searchId}
                            onChange={e => setSearchId(e.target.value)}
                            style={{ ...inputStyle, fontSize: '1rem', flex: 1 }}
                        />
                        <button type="submit" disabled={searching} style={{ padding: '0.6rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}>
                            {searching ? 'Searching...' : '🔍 Fetch Invoice'}
                        </button>
                    </form>
                    {errorMsg && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: '700' }}>⚠️ {errorMsg}</div>}
                </div>

                {foundBill && (
                    <form onSubmit={handleSaveChanges} className="v2-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--v2-border)', paddingBottom: '1rem' }}>
                            <div>
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', textTransform: 'uppercase' }}>Invoice Match</span>
                                <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.2rem', fontWeight: '900' }}>#{foundBill.id.substring(0, 8).toUpperCase()}</h2>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>Document ID: <code>{foundBill.id}</code></span>
                        </div>

                        {/* Customer & Timestamp Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Client Name</label>
                                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} style={inputStyle} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Client Phone</label>
                                <input type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Bill Date</label>
                                <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={inputStyle} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Bill Time</label>
                                <input type="time" value={billTime} onChange={e => setBillTime(e.target.value)} style={inputStyle} required />
                            </div>
                        </div>

                        {/* Staff & Payment Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={labelStyle}>Primary Stylist</label>
                                <select value={selectedStylistId} onChange={e => setSelectedStylistId(e.target.value)} style={inputStyle}>
                                    <option value="">Select Stylist</option>
                                    {stylists?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Payment Method</label>
                                <select value={paymentType} onChange={e => setPaymentType(e.target.value)} style={inputStyle}>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="upi">UPI</option>
                                    <option value="split">Split</option>
                                </select>
                            </div>
                        </div>

                        {/* Services List Editor */}
                        {serviceItems.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--v2-border)', paddingTop: '1.25rem' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', marginBottom: '0.75rem', textTransform: 'uppercase', color: 'var(--v2-text-muted)' }}>Services Included</h3>
                                {serviceItems.map((svc, sIdx) => (
                                    <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <input type="text" value={svc.name || ''} onChange={e => handleUpdateServiceItem(sIdx, 'name', e.target.value)} style={inputStyle} placeholder="Service Name" />
                                        <input type="number" value={svc.price || ''} onChange={e => handleUpdateServiceItem(sIdx, 'price', e.target.value)} style={inputStyle} placeholder="Price" />
                                        <input type="number" value={svc.qty || ''} onChange={e => handleUpdateServiceItem(sIdx, 'qty', e.target.value)} style={inputStyle} placeholder="Qty" />
                                        <div style={{ fontWeight: '700', fontSize: '0.85rem', textAlign: 'right', paddingRight: '0.5rem' }}>₹{(parseFloat(svc.price || 0) * parseInt(svc.qty || 1)).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Products List Editor */}
                        {productItems.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--v2-border)', paddingTop: '1.25rem' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', marginBottom: '0.75rem', textTransform: 'uppercase', color: 'var(--v2-text-muted)' }}>Products Included</h3>
                                {productItems.map((prod, pIdx) => (
                                    <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.8fr 1fr', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <input type="text" value={prod.name || ''} onChange={e => handleUpdateProductItem(pIdx, 'name', e.target.value)} style={inputStyle} placeholder="Product Name" />
                                        <input type="number" value={prod.price || ''} onChange={e => handleUpdateProductItem(pIdx, 'price', e.target.value)} style={inputStyle} placeholder="Price" />
                                        <input type="number" value={prod.qty || ''} onChange={e => handleUpdateProductItem(pIdx, 'qty', e.target.value)} style={inputStyle} placeholder="Qty" />
                                        <div style={{ fontWeight: '700', fontSize: '0.85rem', textAlign: 'right', paddingRight: '0.5rem' }}>₹{(parseFloat(prod.price || 0) * parseInt(prod.qty || 1)).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(serviceItems.length > 0 || productItems.length > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={handleRecalculateTotal} style={{ padding: '0.4rem 1rem', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '700' }}>
                                    🧮 Auto-Recalculate Total
                                </button>
                            </div>
                        )}

                        {/* Ledger Summary Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid var(--v2-border)', paddingTop: '1.25rem' }}>
                            <div>
                                <label style={labelStyle}>Grand Total Amount (₹)</label>
                                <input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} style={{ ...inputStyle, fontWeight: '700' }} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Amount Paid (₹)</label>
                                <input type="number" value={payingNow} onChange={e => setPayingNow(e.target.value)} style={{ ...inputStyle, fontWeight: '700' }} required />
                            </div>
                            <div>
                                <label style={labelStyle}>Due Arrears (₹)</label>
                                <input type="number" value={dueAmount} style={{ ...inputStyle, background: '#f3f4f6', fontWeight: '700' }} disabled />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Admin Notes / Reason for Edit</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={inputStyle} placeholder="e.g. Adjusted price override, client updated name" />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <button type="button" onClick={() => setFoundBill(null)} style={{ flex: 1, padding: '0.75rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" style={{ flex: 2, padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>
                                Save Invoice Overrides
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Admin PIN Verification Modal */}
            {showPinModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowPinModal(false)}>
                    <form onSubmit={handlePinSubmit} className="v2-card" style={{ maxWidth: '350px', width: '100%', padding: '2rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.5rem' }}>Verify Admin PIN</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)', marginBottom: '1.5rem' }}>Please enter the 4-digit Admin override PIN to confirm this invoice edit.</p>
                        
                        <input
                            type="password"
                            required
                            placeholder="Enter Admin PIN"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                            maxLength={4}
                            style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', marginBottom: '1.5rem' }}
                        />

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => setShowPinModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" style={{ flex: 1, padding: '0.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Verify & Save</button>
                        </div>
                    </form>
                </div>
            )}
        </Layout>
    );
}
