import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../../context/DataProvider';
import { collection, addDoc, doc, getDoc, runTransaction, updateDoc, Timestamp, serverTimestamp, query, where, getDocs, limit, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import CustomDropdown from '../../components/CustomDropdown';
import SearchableDropdown from '../../components/SearchableDropdown';
import { triggerPaymentNotification } from '../../../services/notifications';
import { FLAT_SERVICES } from '../../utils/hashtagServices';



const getServicesForDatalist = (staffId, stylistsList, servicesList) => {
    return servicesList || [];
};

// Free-text time input — accepts "8:15", "14:30", "8 30", "830" etc.
function parseTimeInput(str) {
    const s = str.replace(/[^0-9:]/g, '');
    let h, m;
    if (s.includes(':')) {
        [h, m] = s.split(':').map(Number);
    } else if (s.length <= 2) {
        h = Number(s); m = 0;
    } else if (s.length === 3) {
        h = Number(s[0]); m = Number(s.slice(1));
    } else {
        h = Number(s.slice(0, 2)); m = Number(s.slice(2, 4));
    }
    if (isNaN(h) || h < 0 || h > 23) return null;
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    return { h, m };
}

const EMPTY_SERVICE_ROW = { serviceName: '', staffId: '', time: '', price: '', qty: 1 };

export default function NewAppointmentModal({ defaultDate, defaultStylistId, onClose, onSaved, prefillAppointment }) {
    const { stylists: allStylists, services } = useData();
    const stylists = useMemo(() => (allStylists || []).filter(s => s.isActive !== false && s.status !== 'inactive'), [allStylists]);

    const isCheckout = !!prefillAppointment;

    // Build prefilled rows from online booking services
    const buildPrefillRows = () => {
        const apptServices = prefillAppointment?.services || prefillAppointment?.items || [];
        if (apptServices.length > 0) {
            const expanded = [];
            apptServices.forEach(s => {
                const flatSvc = FLAT_SERVICES.find(f => f.name === s.name);
                if (flatSvc && flatSvc.subServices && flatSvc.subServices.length > 0) {
                    flatSvc.subServices.forEach(sub => {
                        expanded.push({
                            ...EMPTY_SERVICE_ROW,
                            id: Math.random().toString(36).substring(7),
                            serviceName: `${flatSvc.name} - ${sub.name}`,
                            staffId: prefillAppointment?.stylistId || s.staffId || defaultStylistId || '',
                            price: sub.price || '',
                            qty: s.qty || 1,
                            time: prefillAppointment?.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) || '',
                        });
                    });
                } else {
                    expanded.push({
                        ...EMPTY_SERVICE_ROW,
                        id: Math.random().toString(36).substring(7),
                        serviceName: s.name || '',
                        staffId: prefillAppointment?.stylistId || s.staffId || defaultStylistId || '',
                        price: s.price || '',
                        qty: s.qty || 1,
                        time: prefillAppointment?.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) || '',
                    });
                }
            });
            return expanded;
        }
        return [{ ...EMPTY_SERVICE_ROW, id: Math.random().toString(36).substring(7), staffId: prefillAppointment?.stylistId || defaultStylistId || '' }];
    };

    // Prefill date from appointment timestamp
    const prefillDate = (() => {
        if (prefillAppointment?.timestamp) {
            const d = prefillAppointment.timestamp.toDate?.();
            if (d) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
        return defaultDate || '';
    })();

    // Client
    const [clientSearch, setClientSearch] = useState(prefillAppointment?.clientName || '');
    const [selectedClient, setSelectedClient] = useState(
        prefillAppointment?.clientPhone
            ? { name: prefillAppointment.clientName, phone: prefillAppointment.clientPhone }
            : null
    );
    const [isWalkin, setIsWalkin] = useState(!prefillAppointment?.clientPhone && !!prefillAppointment);
    const [billDate, setBillDate] = useState(prefillDate);

    // Service rows with unique IDs for stable mapping and deletion
    const [rows, setRows] = useState(isCheckout ? buildPrefillRows() : [{ ...EMPTY_SERVICE_ROW, id: Math.random().toString(36).substring(7), staffId: defaultStylistId || '' }]);

    // Charges
    const [exCharge, setExCharge] = useState('');
    const [discount, setDiscount] = useState('');
    const [discountType, setDiscountType] = useState('percentage');
    const [gst, setGst] = useState('');
    const [tipAmount, setTipAmount] = useState('');
    const [coupon, setCoupon] = useState('');
    const [notes, setNotes] = useState('');

    // Payment
    const [payMode, setPayMode] = useState('cash');
    const [payingNow, setPayingNow] = useState(''); // controlled, synced with grandTotal on change
    const [couponApplied, setCouponApplied] = useState(false);

    const [saving, setSaving] = useState(false);

    // Client search dropdown (Async from Firestore)
    const [clientSuggestions, setClientSuggestions] = useState([]);

    // Add Client modal state
    const [showAddClientModal, setShowAddClientModal] = useState(false);
    const [newClientForm, setNewClientForm] = useState({ name: '', phone: '', dob: '', anniversary: '' });
    const [isSavingClient, setIsSavingClient] = useState(false);
    
    const [allCustomers, setAllCustomers] = useState([]);
    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDocs(collection(db, 'customers'));
                setAllCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Failed to load customers for modal:", err);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (isWalkin || clientSearch.length < 2) {
            setClientSuggestions([]);
            return;
        }
        const q = clientSearch.toLowerCase().trim();
        const filtered = allCustomers.filter(c => {
            const name = (c.name || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            return name.includes(q) || phone.includes(q);
        }).slice(0, 6);
        setClientSuggestions(filtered);
    }, [clientSearch, isWalkin, allCustomers]);

    // Show Add Client button when search has typed something but found no matches and no client selected
    const showAddClientBtn = !isWalkin && !selectedClient && clientSearch.length >= 2 && clientSuggestions.length === 0;

    // Handle saving a new client from the quick-add modal
    const handleSaveNewClient = async (e) => {
        e.preventDefault();
        if (!newClientForm.phone || newClientForm.phone.length < 10) return alert('Enter a valid 10-digit phone number.');
        if (!newClientForm.name.trim()) return alert('Enter client name.');
        setIsSavingClient(true);
        try {
            const clientData = {
                name: newClientForm.name.trim(),
                phone: newClientForm.phone.trim(),
                dob: newClientForm.dob || '',
                anniversary: newClientForm.anniversary || '',
                globalStats: { totalVisits: 0, totalSpent: 0 },
                loyaltyPoints: 0,
                walletBalance: 0,
                unpaidBalance: 0,
                lastUpdated: new Date()
            };
            await setDoc(doc(db, 'customers', newClientForm.phone.trim()), clientData, { merge: true });
            setSelectedClient({ ...clientData, id: newClientForm.phone.trim() });
            setAllCustomers(prev => [{ id: newClientForm.phone.trim(), ...clientData }, ...prev]);
            setClientSearch('');
            setShowAddClientModal(false);
            setNewClientForm({ name: '', phone: '', dob: '', anniversary: '' });
        } catch (err) {
            alert('Failed to save client: ' + err.message);
        } finally {
            setIsSavingClient(false);
        }
    };

    // Row helpers
    const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    const addRow    = () => setRows(prev => [...prev, { ...EMPTY_SERVICE_ROW, id: Math.random().toString(36).substring(7) }]);
    const removeRow = id  => {
        if (rows.length === 1) {
            // If it's the last row, just clear it instead of removing it
            setRows([{ ...EMPTY_SERVICE_ROW, id: id }]);
        } else {
            setRows(prev => prev.filter(r => r.id !== id));
        }
    };

    // Auto-fill price when service selected
    const onServiceChange = (id, name) => {
        if (name === 'Custom Service...') {
            updateRow(id, 'serviceName', '');
            updateRow(id, 'price', '');
            return;
        }

        const svc = FLAT_SERVICES.find(s => s.name === name);
        if (svc && svc.subServices && svc.subServices.length > 0) {
            // Expand package/combo
            setRows(prev => {
                const targetIdx = prev.findIndex(r => r.id === id);
                if (targetIdx === -1) return prev;
                
                // Get the current staffId and time of the target row to prefill the expanded rows
                const currentStaff = prev[targetIdx].staffId;
                const currentTime = prev[targetIdx].time;

                const newRows = svc.subServices.map(sub => ({
                    id: Math.random().toString(36).substring(7),
                    serviceName: `${svc.name} - ${sub.name}`,
                    staffId: currentStaff || defaultStylistId || '',
                    time: currentTime || '',
                    price: sub.price,
                    qty: 1
                }));

                const copy = [...prev];
                copy.splice(targetIdx, 1, ...newRows);
                return copy;
            });
        } else {
            updateRow(id, 'serviceName', name);
            let price = '';
            if (svc?.price) price = svc.price;
            updateRow(id, 'price', price);
        }
    };

    // Financials
    const subtotal = rows.reduce((s, r) => s + (parseFloat(r.price) || 0) * (parseInt(r.qty) || 1), 0);
    const discAmt  = discountType === 'percentage' ? subtotal * ((parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
    const gstAmt   = (subtotal - discAmt) * ((parseFloat(gst) || 0) / 100);
    const tip      = parseFloat(tipAmount) || 0;
    const extra    = parseFloat(exCharge) || 0;
    const grandTotal = subtotal - discAmt + gstAmt + tip + extra;

    const fmt = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v || 0);

    // Sync payingNow default to grandTotal when it changes (only if user hasn't manually changed it)
    const payingNowNum = parseFloat(payingNow) || grandTotal;
    const dueAmount = Math.max(0, grandTotal - payingNowNum);

    const handleSave = async (e) => {
        e.preventDefault();
        if (rows.every(r => !r.serviceName)) return alert('Add at least one service.');
        if (rows.some(r => r.serviceName && !r.staffId)) return alert('Assign staff to all service rows.');
        // Warn on blank time
        if (!rows[0].time || !rows[0].time.trim()) {
            if (!window.confirm('No time entered — appointment will be saved at 10:00 AM. Continue?')) return;
        }
        setSaving(true);
        try {
            const dateStr = billDate || new Date().toISOString().split('T')[0];
            const parsed  = parseTimeInput(rows[0].time || '10:00') || { h: 10, m: 0 };
            const dt      = new Date(`${dateStr}T${String(parsed.h).padStart(2,'0')}:${String(parsed.m).padStart(2,'0')}:00`);

            const primaryStylist = stylists?.find(s => s.id === rows[0].staffId);
            const paying = payingNowNum;
            const due    = Math.max(0, grandTotal - paying);

            const appointmentData = {
                clientName:   selectedClient?.name || (isWalkin ? 'Walk-in' : clientSearch || 'Walk-in'),
                clientPhone:  selectedClient?.phone || '',
                isReturningClient: !!selectedClient,
                stylistId:    rows[0].staffId,
                stylistName:  primaryStylist?.name || '',
                services:     rows.filter(r => r.serviceName).map(r => ({
                    name:       r.serviceName,
                    staffId:    r.staffId,
                    staffName:  stylists?.find(s => s.id === r.staffId)?.name || '',
                    time:       r.time,
                    price:      parseFloat(r.price) || 0,
                    qty:        parseInt(r.qty) || 1,
                })),
                subtotal,
                discountAmount: discAmt,
                discountType,
                gstPercent:   parseFloat(gst) || 0,
                gstAmount:    gstAmt,
                tipAmount:    tip,
                exCharge:     extra,
                totalAmount:  grandTotal,
                payingNow:    paying,
                dueAmount:    due,
                paymentType:  payMode,
                couponCode:   coupon,
                notes,
                status:       due > 0 ? 'unpaid' : 'completed',
                timestamp:    Timestamp.fromDate(dt),
                createdAt:    serverTimestamp(),
                v2:           true,
                // Track if this bill was converted from an online booking
                ...(isCheckout && prefillAppointment?.id ? { convertedFromBookingId: prefillAppointment.id, source: 'checkout_converted' } : {}),
            };

            // If client exists in DB, update globalStats atomically
            if (selectedClient?.phone) {
                await runTransaction(db, async (tx) => {
                    const cRef = doc(db, 'customers', selectedClient.phone);
                    const cSnap = await tx.get(cRef);
                    const aptRef = doc(collection(db, 'appointments'));
                    tx.set(aptRef, appointmentData);
                    if (cSnap.exists()) {
                        const stats = cSnap.data().globalStats || {};
                        tx.update(cRef, {
                            'globalStats.totalVisits': (stats.totalVisits || 0) + 1,
                        });
                    }
                });
            } else {
                await addDoc(collection(db, 'appointments'), appointmentData);
            }

            // If converting from an online booking, mark original as completed
            if (isCheckout && prefillAppointment?.id) {
                await updateDoc(doc(db, 'appointments', prefillAppointment.id), {
                    status: 'completed',
                    checkedOutAt: serverTimestamp(),
                    checkedOutNote: 'Services modified at checkout',
                });
            }

            // Trigger automated payment notification based on active integrations config
            triggerPaymentNotification(appointmentData);

            onSaved?.();
            onClose();
        } catch (err) { alert(err.message); }
        finally { setSaving(false); }
    };

    const inputStyle = { width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
            <form onSubmit={handleSave} style={{ background: 'white', borderRadius: '12px', width: '900px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', background: isCheckout ? '#fffbeb' : 'white' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                            {isCheckout ? '✏️ Modify & Checkout' : 'New Appointment'}
                        </h2>
                        {isCheckout && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#92400e', fontWeight: '600' }}>
                                Online booking by {prefillAppointment?.clientName || 'Customer'} — adjust services as needed
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
                </div>

                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* ── Client + Date Row ── */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, position: 'relative', zIndex: 2000 }}>
                            <input
                                type="text"
                                placeholder="Search By Name / Contact / Address / File No / Card Number (At least 3 chars)"
                                value={isWalkin ? 'Walk-in Client' : (selectedClient ? `${selectedClient.name} · ${selectedClient.phone}` : clientSearch)}
                                onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setIsWalkin(false); }}
                                disabled={isWalkin}
                                style={{ ...inputStyle, paddingRight: '2rem' }}
                            />
                            {clientSuggestions.length > 0 && !selectedClient && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '2px' }}>
                                    {clientSuggestions.map(c => (
                                        <div key={c.phone} onClick={() => { setSelectedClient(c); setClientSearch(''); }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f3f4f6' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                                            <strong>{c.name}</strong> · {c.phone}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => { setIsWalkin(!isWalkin); setSelectedClient(null); setClientSearch(''); }}
                            style={{ padding: '0.5rem 1.25rem', background: isWalkin ? 'var(--v2-primary)' : '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            Walk-in Client
                        </button>
                        {showAddClientBtn && (
                            <button type="button" onClick={() => {
                                const isPhone = /^\d+$/.test(clientSearch);
                                setNewClientForm({ name: isPhone ? '' : clientSearch, phone: isPhone ? clientSearch : '', dob: '', anniversary: '' });
                                setShowAddClientModal(true);
                            }} style={{ padding: '0.5rem 1.25rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem', animation: 'fadeInBtn 0.2s ease' }}>
                                <span style={{ fontSize: '1rem' }}>＋</span> Add Client
                            </button>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ ...labelStyle }}>Bill Date</label>
                            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} required style={{ ...inputStyle, width: '150px' }} />
                        </div>
                    </div>

                    {/* ── Service Rows ── */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 0.7fr 1fr 36px', gap: '0.5rem', padding: '0.6rem 1rem', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '0.72rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>
                            <span>Services</span><span>Staff</span><span>Time</span><span>Price</span><span>Qty</span><span>Total</span><span></span>
                        </div>

                        {rows.map((row, i) => (
                            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 0.7fr 1fr 36px', gap: '0.5rem', padding: '0.6rem 1rem', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
                                {/* Service */}
                                <SearchableDropdown
                                    value={row.serviceName}
                                    onChange={val => onServiceChange(row.id, val)}
                                    options={FLAT_SERVICES.map(s => ({ value: s.name, label: `[${s.gender}] ${s.name} - ₹${s.price}` }))}
                                    placeholder="Select or type service…"
                                    style={{ zIndex: 100 - i }}
                                />
                                {/* Staff */}
                                <CustomDropdown
                                    value={row.staffId}
                                    onChange={val => {
                                        updateRow(row.id, 'staffId', val);
                                    }}
                                    options={[{ value: '', label: 'Select Staff' }, ...(stylists || []).map(s => ({ value: s.id, label: s.name }))]}
                                    style={{ zIndex: 90 - i }}
                                />
                                {/* Time — free text */}
                                <input
                                    type="text"
                                    value={row.time}
                                    onChange={e => updateRow(row.id, 'time', e.target.value)}
                                    placeholder="e.g. 8:15"
                                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                                />
                                {/* Price */}
                                <input type="number" min="0" step="0.01" value={row.price} onChange={e => updateRow(row.id, 'price', e.target.value)} placeholder="0.00" style={inputStyle} />
                                {/* Qty */}
                                <input type="number" min="1" value={row.qty} onChange={e => updateRow(row.id, 'qty', e.target.value)} style={inputStyle} />
                                {/* Row Total */}
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', paddingLeft: '0.25rem' }}>
                                    {((parseFloat(row.price) || 0) * (parseInt(row.qty) || 1)).toFixed(2)}
                                </div>
                                {/* Delete row */}
                                <button type="button" onClick={() => removeRow(row.id)} style={{ width: '28px', height: '28px', border: 'none', background: '#fee2e2', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                            </div>
                        ))}

                        {/* Add buttons */}
                        <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={addRow} style={{ padding: '0.4rem 1rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Add Services ＋</button>
                            <button type="button" style={{ padding: '0.4rem 1rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem', opacity: 0.5 }}>Add To Group ＋</button>
                            <button type="button" style={{ padding: '0.4rem 1rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem', opacity: 0.5 }}>Add Package ＋</button>
                        </div>
                    </div>

                    {/* ── Charges Row ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1.5fr', gap: '1rem', alignItems: 'end' }}>
                        <div>
                            <label style={labelStyle}>Ex Charges</label>
                            <input type="number" min="0" value={exCharge} onChange={e => setExCharge(e.target.value)} placeholder="0.00" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Discount</label>
                            <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0.00" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Discount Type</label>
                            <select value={discountType} onChange={e => setDiscountType(e.target.value)} style={inputStyle}>
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>GST %</label>
                            <input type="number" min="0" step="0.01" value={gst} onChange={e => setGst(e.target.value)} placeholder="0.00" style={inputStyle} />
                        </div>
                    </div>

                    {/* ── Payment + Summary ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* Left: payment */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Mode buttons */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['cash', 'card', 'upi', 'split'].map(m => (
                                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', border: `1.5px solid ${payMode === m ? 'var(--v2-primary)' : '#d1d5db'}`, borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textTransform: 'capitalize', color: payMode === m ? 'var(--v2-primary)' : '#374151' }}>
                                        <input type="radio" name="payMode" value={m} checked={payMode === m} onChange={() => setPayMode(m)} style={{ display: 'none' }} />{m}
                                    </label>
                                ))}
                            </div>
                            <div>
                                <label style={labelStyle}>Adjust Payment (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payingNow !== '' ? payingNow : grandTotal.toFixed(2)}
                                    onChange={e => setPayingNow(e.target.value)}
                                    style={inputStyle}
                                />
                                {dueAmount > 0 && (
                                    <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '700', marginTop: '4px' }}>
                                        ⚠️ Due after payment: {fmt(dueAmount)} — will be saved as <em>Unpaid</em>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    value={coupon}
                                    onChange={e => setCoupon(e.target.value)}
                                    placeholder="Coupon Code"
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button type="button"
                                    onClick={() => {
                                        if (!coupon.trim()) return alert('Enter a coupon code.');
                                        setCouponApplied(true);
                                        alert(`Coupon "${coupon}" noted. Manual discount adjustments can be applied above.`);
                                    }}
                                    style={{ padding: '0.5rem 1rem', background: couponApplied ? '#10b981' : '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>
                                    {couponApplied ? '✓ Applied' : 'Apply'}
                                </button>
                            </div>
                            <div>
                                <label style={labelStyle}>Tip Amount (₹)</label>
                                <input type="number" min="0" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
                            </div>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter Notes…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>

                        {/* Right: Summary */}
                        <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '1.25rem', fontSize: '0.9rem' }}>
                            {[
                                { l: 'Subtotal (₹):', v: fmt(subtotal) },
                                { l: 'Discount (₹):', v: `-${fmt(discAmt)}`, c: '#dc2626' },
                                { l: 'GST (₹):', v: fmt(gstAmt) },
                                { l: 'Tip Amount (₹):', v: fmt(tip) },
                                { l: 'Ex Charges (₹):', v: fmt(extra) },
                                { l: 'Total (₹):', v: fmt(grandTotal), bold: true },
                                { l: 'Taxable Amount (₹):', v: fmt(subtotal - discAmt) },
                                { l: 'Grand Total (₹):', v: fmt(grandTotal), bold: true, big: true },
                                { l: 'Paying Now (₹):', v: fmt(payingNowNum), big: true },
                                { l: 'Due Amount (₹):', v: fmt(dueAmount), c: dueAmount > 0 ? '#dc2626' : '#16a34a' },
                            ].map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: i < 9 ? '1px solid #e5e7eb' : 'none' }}>
                                    <span style={{ color: '#6b7280', fontWeight: r.bold ? '700' : '500' }}>{r.l}</span>
                                    <span style={{ fontWeight: r.big ? '900' : r.bold ? '700' : '600', color: r.c || (r.big ? 'var(--v2-primary)' : '#111827'), fontSize: r.big ? '1.05rem' : 'inherit' }}>{r.v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Footer Buttons ── */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" onClick={onClose} style={{ padding: '0.65rem 1.5rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                    <button type="submit" disabled={saving} style={{ padding: '0.65rem 2rem', background: isCheckout ? '#f59e0b' : 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '800', fontSize: '0.95rem' }}>
                        {saving ? 'Saving…' : (isCheckout ? '✅ Confirm & Checkout' : 'Book Appointment')}
                    </button>
                </div>
            </form>

            {/* ── Add Client Quick Modal ── */}
            {showAddClientModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowAddClientModal(false)}>
                    <form onSubmit={handleSaveNewClient} style={{ background: 'white', borderRadius: '16px', maxWidth: '460px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'slideUp 0.22s ease' }} onClick={e => e.stopPropagation()}>
                        <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.5rem 2rem' }}>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '900' }}>➕ Add New Client</h2>
                            <p style={{ margin: '0.35rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>Save client to database and auto-select for this appointment</p>
                        </div>
                        <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Full Name *</label>
                                    <input type="text" required value={newClientForm.name} onChange={e => setNewClientForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya Sharma" style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Phone *</label>
                                    <input type="tel" required maxLength={10} value={newClientForm.phone} onChange={e => setNewClientForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))} placeholder="10-digit number" style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Date of Birth</label>
                                    <input type="date" value={newClientForm.dob} onChange={e => setNewClientForm(p => ({ ...p, dob: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Anniversary</label>
                                    <input type="date" value={newClientForm.anniversary} onChange={e => setNewClientForm(p => ({ ...p, anniversary: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '1rem 2rem 1.75rem', display: 'flex', gap: '0.75rem' }}>
                            <button type="button" onClick={() => setShowAddClientModal(false)} style={{ flex: 1, padding: '0.7rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#374151' }}>Cancel</button>
                            <button type="submit" disabled={isSavingClient} style={{ flex: 2, padding: '0.7rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '0.95rem' }}>{isSavingClient ? 'Saving...' : '✓ Save & Select Client'}</button>
                        </div>
                    </form>
                    <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } } @keyframes fadeInBtn { from { opacity:0; transform:scale(0.95) } to { opacity:1; transform:scale(1) } }`}</style>
                </div>
            )}
        </div>
    );
}
