import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../../context/DataProvider';
import { collection, doc, setDoc, getDoc, runTransaction, serverTimestamp, query, where, getDocs, increment, arrayUnion, limit, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import Layout from '../../components/Layout';
import ReceiptModal from '../../components/ReceiptModal';
import CustomDropdown from '../../components/CustomDropdown';
import SearchableDropdown from '../../components/SearchableDropdown';
import { triggerPaymentNotification } from '../../../services/notifications';
import { logError } from '../../utils/logger';

const genId = () => Math.random().toString(36).substring(7);



const getServicesForDatalist = (staffId, stylistsList, servicesList) => {
    return servicesList || [];
};

const EMPTY_SERVICE = () => ({ id: genId(), name: '', staffId: '', time: '', price: '', qty: 1, isRedemption: false, redeemedPackageId: null });
const EMPTY_PRODUCT = () => ({ id: genId(), name: '', staffId: '', price: '', qty: 1 });
const EMPTY_MEMBERSHIP = () => ({ id: genId(), name: '', price: '', qty: 1 });
const EMPTY_PACKAGE = () => ({ id: genId(), name: '', price: '', qty: 1 });
const EMPTY_WALLET_RECHARGE = () => ({ id: genId(), name: 'E-Wallet Recharge', price: '', qty: 1 });

export default function V2QuickSale() {
    const { stylists: allStylists, services, products, packages, memberships, settings } = useData();
    const stylists = useMemo(() => (allStylists || []).filter(s => s.isActive !== false && s.status !== 'inactive'), [allStylists]);
    const isProcessingRef = useRef(false); // Double-click protection

    // Client
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [isWalkin, setIsWalkin] = useState(false);
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);

    // Rows
    const [serviceRows, setServiceRows] = useState([EMPTY_SERVICE()]);
    const [productRows, setProductRows] = useState([]);
    const [membershipRows, setMembershipRows] = useState([]);
    const [packageRows, setPackageRows] = useState([]);
    const [walletRows, setWalletRows] = useState([]);

    // Modifiers
    const [exCharge, setExCharge] = useState('');
    const [discount, setDiscount] = useState('');
    const [discountType, setDiscountType] = useState('percentage');
    const [gst, setGst] = useState('');
    const [tipAmount, setTipAmount] = useState('');
    
    // Wallet / Loyalty Usage
    const [rewardPoints, setRewardPoints] = useState('');
    const [walletUsed, setWalletUsed] = useState('');
    
    // Promo & Gift Card
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [giftCardInput, setGiftCardInput] = useState('');
    const [appliedGiftCard, setAppliedGiftCard] = useState(null);

    // Payment
    const [payMode, setPayMode] = useState('cash');
    const [adjustPayment, setAdjustPayment] = useState('');
    const [notes, setNotes] = useState('');
    
    // Security overrides
    const [showAdminPINModal, setShowAdminPINModal] = useState(false);
    const [adminPINInput, setAdminPINInput] = useState('');
    const [bypassAuthorized, setBypassAuthorized] = useState(false);

    // Referral Engine state
    const [referredByPhone, setReferredByPhone] = useState('');
    const [referrerName, setReferrerName] = useState('');
    const [referrerError, setReferrerError] = useState('');

    useEffect(() => {
        let isMounted = true;
        async function checkReferrer() {
            if (referredByPhone.length === 10) {
                if (referredByPhone === (selectedClient?.phone || '')) {
                    setReferrerError('Cannot refer self');
                    setReferrerName('');
                } else {
                    try {
                        const refDoc = await getDoc(doc(db, 'customers', referredByPhone));
                        if (refDoc.exists() && isMounted) {
                            setReferrerName(refDoc.data().name);
                            setReferrerError('');
                        } else if (isMounted) {
                            setReferrerName('');
                            setReferrerError('Phone number not found');
                        }
                    } catch (err) {
                        if (isMounted) setReferrerError('Error verifying number');
                    }
                }
            } else {
                setReferrerName('');
                setReferrerError('');
            }
        }
        checkReferrer();
        return () => { isMounted = false; };
    }, [referredByPhone, selectedClient]);

    // Add Client modal state
    const [showAddClientModal, setShowAddClientModal] = useState(false);
    const [newClientForm, setNewClientForm] = useState({ name: '', phone: '', dob: '', anniversary: '' });
    const [isSavingClient, setIsSavingClient] = useState(false);

    // Print State
    const [lastBill, setLastBill] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);

    const [allCustomers, setAllCustomers] = useState([]);
    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDocs(collection(db, 'customers'));
                setAllCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Failed to load customers for QuickSale:", err);
            }
        };
        load();
    }, []);

    // Client search (Client-side case-insensitive substring match)
    const [clientSuggestions, setClientSuggestions] = useState([]);
    
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

    // Apply auto-discount if client has active membership
    useEffect(() => {
        if (selectedClient?.activeMembership && !appliedPromo) {
            const mem = memberships?.find(m => m.name === selectedClient.activeMembership.name);
            if (mem && mem.discountPercent) {
                setDiscount(mem.discountPercent);
                setDiscountType('percentage');
            }
        } else if (!appliedPromo) {
            setDiscount('');
        }
    }, [selectedClient, memberships, appliedPromo]);

    const handleApplyPromo = async () => {
        if (!promoInput) return;
        const q = query(collection(db, 'promotions'), where('code', '==', promoInput.toUpperCase()));
        const snap = await getDocs(q);
        if (snap.empty) return alert('Invalid Promo Code');
        const promo = snap.docs[0];
        const data = promo.data();
        if (!data.isActive) return alert('This Promo Code is inactive.');
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) return alert('This Promo Code has expired.');
        if (data.minOrderValue > 0 && subtotal < data.minOrderValue) return alert(`Minimum order value of ₹${data.minOrderValue} required.`);
        
        setAppliedPromo({ id: promo.id, ...data });
        setDiscountType(data.type);
        setDiscount(data.value);
        alert('Promo Code Applied!');
    };

    const handleApplyGiftCard = async () => {
        if (!giftCardInput) return;
        const q = query(collection(db, 'giftcards'), where('code', '==', giftCardInput.toUpperCase()));
        const snap = await getDocs(q);
        if (snap.empty) return alert('Invalid Gift Card Code');
        const gc = snap.docs[0];
        const data = gc.data();
        if (!data.isActive) return alert('Gift Card is inactive.');
        if (data.balance <= 0) return alert('Gift Card balance is zero.');
        
        setAppliedGiftCard({ id: gc.id, ...data });
        alert(`Gift Card Applied! Balance: ₹${data.balance}`);
    };

    // Auto-fill Helpers
    const onServiceChange = (rowId, name) => {
        setServiceRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            if (name === 'Custom Service...') {
                return { ...r, name: '', price: '', isRedemption: false };
            }
            let price = r.price;
            const svc = (services || []).find(s => s.name === name);
            if (svc) price = svc.price;
            return { ...r, name, price, isRedemption: false };
        }));
    };

    const onStaffChange = (rowId, staffId) => {
        setServiceRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            let price = r.price;
            if (staffId && r.name) {
                const svc = (services || []).find(s => s.name === r.name);
                if (svc) price = svc.price;
            }
            return { ...r, staffId, price };
        }));
    };

    const onProductChange = (id, name) => {
        const prd = (products || []).find(p => p.name === name);
        setProductRows(prev => prev.map(r => r.id === id ? { ...r, name, price: prd?.price || r.price } : r));
    };

    const onMembershipChange = (id, name) => {
        const mem = (memberships || []).find(m => m.name === name);
        setMembershipRows(prev => prev.map(r => r.id === id ? { ...r, name, price: mem?.price || r.price } : r));
    };

    const onPackageChange = (id, name) => {
        const pkg = (packages || []).find(p => p.name === name);
        setPackageRows(prev => prev.map(r => r.id === id ? { ...r, name, price: pkg?.price || r.price } : r));
    };

    // Financials
    const calcSubtotal = (rows) => rows.reduce((s, r) => s + (parseFloat(r.price) || 0) * (parseInt(r.qty) || 1), 0);
    const svcSub = calcSubtotal(serviceRows);
    const prdSub = calcSubtotal(productRows);
    const memSub = calcSubtotal(membershipRows);
    const pkgSub = calcSubtotal(packageRows);
    const walSub = calcSubtotal(walletRows);
    
    // Taxable amount includes services and products only, not wallet topups or memberships/packages (depending on local tax laws, but simplified here).
    const subtotal = svcSub + prdSub + memSub + pkgSub + walSub;
    const discAmt = discountType === 'percentage' ? subtotal * ((parseFloat(discount) || 0) / 100) : (parseFloat(discount) || 0);
    const gstAmt = (subtotal - discAmt) * ((parseFloat(gst) || 0) / 100);
    const tip = parseFloat(tipAmount) || 0;
    const extra = parseFloat(exCharge) || 0;
    
    const pointsDeduction = (parseFloat(rewardPoints) || 0) * 0.1; // 10 points = 1 rupee
    const walletDeduction = parseFloat(walletUsed) || 0;

    const totalBeforePoints = subtotal - discAmt + gstAmt + tip + extra;
    const totalAfterPoints = Math.max(0, totalBeforePoints - pointsDeduction - walletDeduction);
    
    // Gift Card deduction
    const giftCardDeduction = appliedGiftCard ? Math.min(appliedGiftCard.balance, totalAfterPoints) : 0;
    const grandTotal = Math.max(0, totalAfterPoints - giftCardDeduction);
    
    const taxableAmount = subtotal - discAmt;

    // Effect to sync paying now
    useEffect(() => {
        setAdjustPayment(grandTotal.toFixed(2));
    }, [grandTotal]);

    const payingNow = parseFloat(adjustPayment) || 0;
    const dueAmount = grandTotal - payingNow;

    const fmt = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v || 0);

    const handleCheckout = async (e) => {
        if (e) e.preventDefault();
        // Ref-based double-click guard (faster than state, prevents duplicate transactions)
        if (isProcessingRef.current) return;
        
        const allItems = [...serviceRows, ...productRows, ...membershipRows, ...packageRows, ...walletRows].filter(r => r.name);
        if (allItems.length === 0) return alert('Add at least one item.');
        if (serviceRows.some(r => r.name && !r.staffId)) return alert('Assign staff to all services.');
        if (productRows.some(r => r.name && !r.staffId)) return alert('Assign staff to all products.');
        
        // Security: Discount Cap Verification
        const isExceedingPercent = discountType === 'percentage' && (parseFloat(discount) || 0) > 15;
        const isExceedingFixed = discountType === 'fixed' && (parseFloat(discount) || 0) > (subtotal * 0.15);
        if ((isExceedingPercent || isExceedingFixed) && !bypassAuthorized) {
            setShowAdminPINModal(true);
            return;
        }

        if (walletDeduction > (selectedClient?.walletBalance || 0)) return alert('Wallet deduction exceeds available balance.');
        if (parseFloat(rewardPoints) > (selectedClient?.loyaltyPoints || 0)) return alert('Reward points deduction exceeds available balance.');

        if (referredByPhone && referredByPhone.length !== 10) {
            return alert('Referrer phone number must be exactly 10 digits.');
        }

        isProcessingRef.current = true;
        setIsProcessing(true);
        let billId = '';
        try {
            await runTransaction(db, async (tx) => {
                const billRef = doc(collection(db, 'appointments'));
                billId = billRef.id;
                const allStaffIds = [...new Set([
                    ...serviceRows.filter(r => r.name && r.staffId).map(r => r.staffId),
                    ...productRows.filter(r => r.name && r.staffId).map(r => r.staffId)
                ])];
                let primaryStylistId = '';
                let combinedStylistName = '';
                if (allStaffIds.length > 1) {
                    primaryStylistId = 'multiple';
                    combinedStylistName = allStaffIds.map(id => stylists?.find(s => s.id === id)?.name || '').filter(Boolean).join(', ');
                } else if (allStaffIds.length === 1) {
                    primaryStylistId = allStaffIds[0];
                    combinedStylistName = stylists?.find(s => s.id === allStaffIds[0])?.name || '';
                }

                // Referral lookup and verification
                let referrerRef = null;
                let referrerSnap = null;
                if (referredByPhone) {
                    if (referredByPhone === (selectedClient?.phone || '')) {
                        throw new Error('A client cannot refer themselves.');
                    }
                    referrerRef = doc(db, 'customers', referredByPhone);
                    referrerSnap = await tx.get(referrerRef);
                    if (!referrerSnap.exists()) {
                        throw new Error(`Referrer phone number ${referredByPhone} does not exist in the customer database.`);
                    }
                }

                const billData = {
                    clientName: selectedClient?.name || (isWalkin ? 'Walk-in' : clientSearch || 'Walk-in'),
                    clientPhone: selectedClient?.phone || '',
                    isReturningClient: !!selectedClient,
                    stylistId: primaryStylistId || '',
                    stylistName: combinedStylistName || '',
                    services: serviceRows.filter(r => r.name).map(r => ({ ...r, type: 'service', staffName: stylists?.find(s => s.id === r.staffId)?.name || '' })),
                    products: productRows.filter(r => r.name).map(r => ({ ...r, type: 'product', staffName: stylists?.find(s => s.id === r.staffId)?.name || '' })),
                    memberships: membershipRows.filter(r => r.name).map(r => ({ ...r, type: 'membership' })),
                    packages: packageRows.filter(r => r.name).map(r => ({ ...r, type: 'package' })),
                    walletTopups: walletRows.filter(r => r.name).map(r => ({ ...r, type: 'wallet' })),
                    subtotal,
                    discountAmount: discAmt,
                    discountType,
                    gstPercent: parseFloat(gst) || 0,
                    gstAmount: gstAmt,
                    tipAmount: tip,
                    exCharge: extra,
                    rewardPointsUsed: parseFloat(rewardPoints) || 0,
                    walletUsed: walletDeduction,
                    giftCardUsed: appliedGiftCard?.code || null,
                    giftCardDeduction,
                    promoCodeUsed: appliedPromo?.code || null,
                    totalAmount: grandTotal,
                    payingNow,
                    dueAmount,
                    paymentType: payMode,
                    notes,
                    status: 'completed',
                    isLocked: true, // Immutable Lock Protocol
                    referredBy: referredByPhone || null,
                    timestamp: serverTimestamp(),
                    v2: true,
                    quickSale: true
                };

                tx.set(billRef, billData);

                // Inventory decrement
                productRows.filter(r => r.name).forEach(item => {
                    const prd = products?.find(p => p.name === item.name);
                    if (prd) {
                        const pRef = doc(db, 'products', prd.id);
                        tx.update(pRef, { stock: Math.max(0, (prd.stock || 0) - item.qty) });
                    }
                });

                // Customer loyalty, wallet, and arrears updates
                if (selectedClient) {
                    const cRef = doc(db, 'customers', selectedClient.phone);
                    const pointsGained = Math.floor(grandTotal / 100);
                    const pointsUsed = parseFloat(rewardPoints) || 0;
                    
                    let newWalletBalance = Math.max(0, (selectedClient.walletBalance || 0) - walletDeduction + walSub);
                    let newUnpaidBalance = (selectedClient.unpaidBalance || 0) + dueAmount;

                    // Add new packages to client
                    let newActivePackages = [...(selectedClient.activePackages || [])];
                    packageRows.filter(r => r.name).forEach(pkgRow => {
                        const pkgRef = packages?.find(p => p.name === pkgRow.name);
                        if (pkgRef) {
                            newActivePackages.push({
                                id: genId(),
                                name: pkgRef.name,
                                totalSessions: pkgRef.sessions || 1,
                                usedSessions: 0,
                                purchasedAt: new Date().toISOString()
                            });
                        }
                    });

                    // Deduct redeemed packages
                    serviceRows.filter(r => r.name && r.isRedemption).forEach(red => {
                        const pIdx = newActivePackages.findIndex(p => p.id === red.redeemedPackageId);
                        if (pIdx >= 0) {
                            newActivePackages[pIdx].usedSessions += parseInt(red.qty);
                        }
                    });

                    // Filter out fully used packages
                    newActivePackages = newActivePackages.filter(p => p.usedSessions < p.totalSessions);

                    // Membership updates
                    let newMembership = selectedClient.activeMembership || null;
                    const latestMem = membershipRows.filter(r => r.name).pop();
                    if (latestMem) {
                        newMembership = {
                            name: latestMem.name,
                            purchasedAt: new Date().toISOString()
                        };
                    }

                    tx.update(cRef, {
                        loyaltyPoints: Math.max(0, (selectedClient.loyaltyPoints || 0) - pointsUsed + pointsGained),
                        walletBalance: newWalletBalance,
                        unpaidBalance: newUnpaidBalance,
                        activePackages: newActivePackages,
                        activeMembership: newMembership,
                        'globalStats.totalSpent': (selectedClient.globalStats?.totalSpent || 0) + grandTotal,
                        'globalStats.totalVisits': (selectedClient.globalStats?.totalVisits || 0) + 1
                    });
                }

                // Credit the referrer E-Wallet with audit history
                if (referrerRef && referrerSnap) {
                    const refData = referrerSnap.data();
                    tx.update(referrerRef, {
                        walletBalance: (refData.walletBalance || 0) + 200,
                        referralHistory: arrayUnion({
                            date: new Date().toISOString(),
                            referredClientPhone: selectedClient?.phone || 'Walk-in',
                            referredClientName: selectedClient?.name || (isWalkin ? 'Walk-in' : clientSearch || 'Walk-in'),
                            rewardAmount: 200
                        })
                    });
                }

                // Update Promos & Gift Cards with Audit Trail
                const auditTrailObj = {
                    date: new Date().toISOString(),
                    clientName: selectedClient?.name || (isWalkin ? 'Walk-in' : clientSearch || 'Walk-in'),
                    clientPhone: selectedClient?.phone || 'NA',
                    stylistName: combinedStylistName || 'Unknown',
                    invoiceId: billRef.id
                };

                if (appliedPromo) {
                    tx.update(doc(db, 'promotions', appliedPromo.id), { 
                        usageCount: increment(1),
                        redemptionHistory: arrayUnion({ ...auditTrailObj, discountAmount: discAmt })
                    });
                }
                if (appliedGiftCard) {
                    tx.update(doc(db, 'giftcards', appliedGiftCard.id), { 
                        balance: Math.max(0, appliedGiftCard.balance - giftCardDeduction),
                        redemptionHistory: arrayUnion({ ...auditTrailObj, amountDeducted: giftCardDeduction })
                    });
                }
            });

            alert('Invoice Generated Successfully! 🖨️ Preparing receipt...');
            
            // Store bill data for reprint and trigger auto-print
            const billSnapshot = {
                id: billId,
                clientName: selectedClient?.name || (isWalkin ? 'Walk-in' : clientSearch || 'Walk-in'),
                clientPhone: selectedClient?.phone || '',
                stylistName: combinedStylistName || '',
                services: serviceRows.filter(r => r.name).map(r => ({ ...r, staffName: stylists?.find(s => s.id === r.staffId)?.name || '' })),
                products: productRows.filter(r => r.name).map(r => ({ ...r, staffName: stylists?.find(s => s.id === r.staffId)?.name || '' })),
                memberships: membershipRows.filter(r => r.name),
                packages: packageRows.filter(r => r.name),
                walletTopups: walletRows.filter(r => r.name),
                subtotal,
                discountAmount: discAmt,
                gstPercent: parseFloat(gst) || 0,
                gstAmount: gstAmt,
                tipAmount: tip,
                exCharge: extra,
                walletUsed: walletDeduction,
                giftCardUsed: appliedGiftCard?.code || null,
                giftCardDeduction,
                promoCodeUsed: appliedPromo?.code || null,
                totalAmount: grandTotal,
                payingNow,
                dueAmount,
                paymentType: payMode,
                notes,
                timestamp: new Date()
            };
            setLastBill(billSnapshot);
            setShowReceiptModal(true); // Open the sleek preview modal instead of raw print
            
            // Trigger automated payment notification based on active integrations config
            triggerPaymentNotification(billSnapshot);

            // Reset
            setServiceRows([EMPTY_SERVICE()]);
            setProductRows([]);
            setMembershipRows([]);
            setPackageRows([]);
            setWalletRows([]);
            setSelectedClient(null);
            setClientSearch('');
            setIsWalkin(false);
            setDiscount('');
            setExCharge('');
            setGst('');
            setReferredByPhone(''); // Clear referral box
            setTipAmount('');
            setRewardPoints('');
            setWalletUsed('');
            setPromoInput('');
            setAppliedPromo(null);
            setGiftCardInput('');
            setAppliedGiftCard(null);
            setNotes('');
            setBypassAuthorized(false); // Reset bypass for next sale
        } catch (err) {
            logError('QuickSale Checkout', err, {
                clientPhone: selectedClient?.phone,
                billTotal: getSubtotal()
            });
            alert(err.message);
        } finally {
            setIsProcessing(false);
            isProcessingRef.current = false;
        }
    };

    const handleAdminPINSubmit = (e) => {
        e.preventDefault();
        const correctPIN = settings?.adminOverridePIN || '0261'; // Reads from Firestore settings
        if (adminPINInput === correctPIN) {
            setBypassAuthorized(true);
            setShowAdminPINModal(false);
            setAdminPINInput('');
            alert('Admin override authorized. Generating bill...');
            setTimeout(() => handleCheckout(), 100);
        } else {
            alert('Incorrect Admin PIN. Access Denied!');
        }
    };

    const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontSize: '0.85rem' };
    const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' };

    return (
        <Layout>
            <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '1.5rem', color: 'var(--v2-text-main)' }}>Create Invoice</h1>
                
                <form onSubmit={handleCheckout} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--v2-border)', boxShadow: 'var(--v2-shadow-sm)' }}>
                    
                    {/* ── Client Search ── */}
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, position: 'relative', zIndex: 2000 }}>
                            <input
                                type="text"
                                placeholder="Search By Name / Contact / Address / File No / Card Number..."
                                value={isWalkin ? 'Walk-in Client' : (selectedClient ? `${selectedClient.name} · ${selectedClient.phone}` : clientSearch)}
                                onChange={e => { setClientSearch(e.target.value); setSelectedClient(null); setIsWalkin(false); }}
                                disabled={isWalkin}
                                style={inputStyle}
                            />
                            {clientSuggestions.length > 0 && !selectedClient && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: '2px' }}>
                                    {clientSuggestions.map(c => (
                                        <div key={c.phone} onClick={() => { setSelectedClient(c); setClientSearch(''); }} style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f3f4f6' }}>
                                            <strong>{c.name}</strong> · {c.phone}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button type="button" onClick={() => { setIsWalkin(!isWalkin); setSelectedClient(null); setClientSearch(''); }} style={{ padding: '0.5rem 1.25rem', background: isWalkin ? 'var(--v2-primary)' : '#1f2937', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>Walkin Client</button>
                        {showAddClientBtn && (
                            <button type="button" onClick={() => {
                                // Pre-fill phone if it looks like a number, else pre-fill name
                                const isPhone = /^\d+$/.test(clientSearch);
                                setNewClientForm({ name: isPhone ? '' : clientSearch, phone: isPhone ? clientSearch : '', dob: '', anniversary: '' });
                                setShowAddClientModal(true);
                            }} style={{ padding: '0.5rem 1.25rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem', animation: 'fadeInBtn 0.2s ease' }}>
                                <span style={{ fontSize: '1rem' }}>＋</span> Add Client
                            </button>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Bill Date</span>
                            <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} required style={{ ...inputStyle, width: '150px' }} />
                        </div>
                    </div>

                    {/* ── Client Profile Card ── */}
                    {(selectedClient || isWalkin) && (
                        <>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--v2-border)', background: '#f8fafc' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
                                    <div>
                                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: 'var(--v2-text-muted)', fontWeight: '600' }}>Name:</span> <strong>{selectedClient?.name || 'Walk-In'}</strong></div>
                                        <div><span style={{ color: 'var(--v2-text-muted)', fontWeight: '600' }}>Phone:</span> {selectedClient?.phone || 'NA'}</div>
                                    </div>
                                    <div>
                                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: 'var(--v2-text-muted)', fontWeight: '600' }}>Reward Points:</span> <strong>{selectedClient?.loyaltyPoints || 0}</strong></div>
                                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: 'var(--v2-text-muted)', fontWeight: '600' }}>Membership:</span> <strong style={{color:'var(--v2-primary)'}}>{selectedClient?.activeMembership?.name || 'NA'}</strong></div>
                                    </div>
                                    <div>
                                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: 'var(--v2-text-muted)', fontWeight: '600' }}>E-Wallet Bal:</span> <strong>₹{selectedClient?.walletBalance || 0}</strong></div>
                                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: 'var(--v2-text-muted)', fontWeight: '600' }}>Active Packages:</span> <strong>{selectedClient?.activePackages?.length || 0}</strong></div>
                                    </div>
                                    <div>
                                        <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#dc2626', fontWeight: '700' }}>Unpaid Arrears:</span> <strong style={{ color: '#dc2626' }}>₹{selectedClient?.unpaidBalance || 0}</strong></div>
                                        {selectedClient?.unpaidBalance > 0 && (
                                            <button type="button" onClick={() => {
                                                setServiceRows(prev => [...prev, { ...EMPTY_SERVICE(), name: 'Arrears Clearance', price: selectedClient.unpaidBalance }]);
                                            }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}>Pay Arrears Now</button>
                                        )}
                                    </div>
                                </div>
                                
                                {selectedClient?.activePackages?.length > 0 && (
                                    <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--v2-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Available Packages to Redeem</div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {selectedClient.activePackages.map(pkg => (
                                                <div key={pkg.id} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <strong>{pkg.name}</strong> ({pkg.totalSessions - pkg.usedSessions} left)
                                                    <button type="button" onClick={() => {
                                                        setServiceRows(prev => [...prev, { ...EMPTY_SERVICE(), name: `[Redeem] ${pkg.name}`, price: 0, isRedemption: true, redeemedPackageId: pkg.id }]);
                                                    }} style={{ background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: '700' }}>Redeem</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Item Grids ── */}
                    <div style={{ padding: '1.5rem', background: '#f8fafc' }}>
                        
                        {/* Services Grid */}
                        {serviceRows.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '800' }}>
                                    <span>Services</span><span>Staff</span><span>Time</span><span>Price</span><span>Qty</span><span>Total</span><span></span>
                                </div>
                                {serviceRows.map((row, i) => (
                                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <SearchableDropdown
                                            value={row.name}
                                            onChange={val => onServiceChange(row.id, val)}
                                            options={getServicesForDatalist(row.staffId, stylists, services).map(s => ({ value: s.name, label: s.name }))}
                                            placeholder="Select Service"
                                            disabled={row.isRedemption}
                                            style={{ zIndex: 100 - i }}
                                        />
                                        <CustomDropdown
                                            value={row.staffId}
                                            onChange={val => onStaffChange(row.id, val)}
                                            options={[{ value: '', label: 'Select Staff' }, ...(stylists || []).map(s => ({ value: s.id, label: s.name }))]}
                                            style={{ zIndex: 90 - i }}
                                        />
                                        <input type="text" value={row.time} onChange={e => setServiceRows(prev => prev.map(r => r.id === row.id ? { ...r, time: e.target.value } : r))} placeholder="e.g. 04:45 PM" style={inputStyle} />
                                        <input type="number" min="0" value={row.price} disabled={row.isRedemption} onChange={e => setServiceRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))} style={inputStyle} />
                                        <input type="number" min="1" value={row.qty} onChange={e => setServiceRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value } : r))} style={inputStyle} />
                                        <div style={{ fontWeight: '700' }}>{((parseFloat(row.price)||0) * (parseInt(row.qty)||1)).toFixed(2)}</div>
                                        <button type="button" onClick={() => setServiceRows(prev => prev.length>1 ? prev.filter(r => r.id!==row.id) : [EMPTY_SERVICE()])} style={{ border:'none', background:'transparent', color:'#dc2626', cursor:'pointer', fontSize:'1rem' }}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Products Grid */}
                        {productRows.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '800' }}>
                                    <span>Select Product</span><span>Select Staff</span><span>Price</span><span>Qty</span><span>Total</span><span></span>
                                </div>
                                {productRows.map((row, i) => (
                                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <SearchableDropdown
                                            value={row.name}
                                            onChange={val => onProductChange(row.id, val)}
                                            options={(products || []).map(s => ({ value: s.name, label: s.name }))}
                                            placeholder="Select Product"
                                            style={{ zIndex: 100 - i }}
                                        />
                                        <CustomDropdown
                                            value={row.staffId}
                                            onChange={val => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, staffId: val } : r))}
                                            options={[{ value: '', label: 'Select Staff' }, ...(stylists || []).map(s => ({ value: s.id, label: s.name }))]}
                                            style={{ zIndex: 90 - i }}
                                        />
                                        <input type="number" min="0" value={row.price} onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))} style={inputStyle} />
                                        <input type="number" min="1" value={row.qty} onChange={e => setProductRows(prev => prev.map(r => r.id === row.id ? { ...r, qty: e.target.value } : r))} style={inputStyle} />
                                        <div style={{ fontWeight: '700' }}>{((parseFloat(row.price)||0) * (parseInt(row.qty)||1)).toFixed(2)}</div>
                                        <button type="button" onClick={() => setProductRows(prev => prev.filter(r => r.id!==row.id))} style={{ border:'none', background:'transparent', color:'#dc2626', cursor:'pointer', fontSize:'1rem' }}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Memberships Grid */}
                        {membershipRows.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '800' }}>
                                    <span>Select Membership</span><span>Price</span><span>Qty</span><span>Total</span><span></span>
                                </div>
                                {membershipRows.map((row, i) => (
                                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <SearchableDropdown
                                            value={row.name}
                                            onChange={val => onMembershipChange(row.id, val)}
                                            options={(memberships || []).map(s => ({ value: s.name, label: s.name }))}
                                            placeholder="Select Membership"
                                            style={{ zIndex: 100 - i }}
                                        />
                                        <input type="number" min="0" value={row.price} onChange={e => setMembershipRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))} style={inputStyle} />
                                        <input type="number" min="1" value={row.qty} disabled style={inputStyle} />
                                        <div style={{ fontWeight: '700' }}>{((parseFloat(row.price)||0) * (parseInt(row.qty)||1)).toFixed(2)}</div>
                                        <button type="button" onClick={() => setMembershipRows(prev => prev.filter(r => r.id!==row.id))} style={{ border:'none', background:'transparent', color:'#dc2626', cursor:'pointer', fontSize:'1rem' }}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Packages Grid */}
                        {packageRows.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '800' }}>
                                    <span>Select Package</span><span>Price</span><span>Qty</span><span>Total</span><span></span>
                                </div>
                                {packageRows.map((row, i) => (
                                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <SearchableDropdown
                                            value={row.name}
                                            onChange={val => onPackageChange(row.id, val)}
                                            options={(packages || []).map(s => ({ value: s.name, label: s.name }))}
                                            placeholder="Select Package"
                                            style={{ zIndex: 100 - i }}
                                        />
                                        <input type="number" min="0" value={row.price} onChange={e => setPackageRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))} style={inputStyle} />
                                        <input type="number" min="1" value={row.qty} disabled style={inputStyle} />
                                        <div style={{ fontWeight: '700' }}>{((parseFloat(row.price)||0) * (parseInt(row.qty)||1)).toFixed(2)}</div>
                                        <button type="button" onClick={() => setPackageRows(prev => prev.filter(r => r.id!==row.id))} style={{ border:'none', background:'transparent', color:'#dc2626', cursor:'pointer', fontSize:'1rem' }}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Wallet Grid */}
                        {walletRows.length > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '800' }}>
                                    <span>Top Up Item</span><span>Top Up Amount</span><span>Qty</span><span>Total</span><span></span>
                                </div>
                                {walletRows.map((row, i) => (
                                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 0.7fr 1fr 36px', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                        <input type="text" value={row.name} disabled style={{...inputStyle, background:'#e2e8f0'}} />
                                        <input type="number" min="0" value={row.price} onChange={e => setWalletRows(prev => prev.map(r => r.id === row.id ? { ...r, price: e.target.value } : r))} placeholder="Enter Amount" style={inputStyle} />
                                        <input type="number" min="1" value={row.qty} disabled style={inputStyle} />
                                        <div style={{ fontWeight: '700' }}>{((parseFloat(row.price)||0) * (parseInt(row.qty)||1)).toFixed(2)}</div>
                                        <button type="button" onClick={() => setWalletRows(prev => prev.filter(r => r.id!==row.id))} style={{ border:'none', background:'transparent', color:'#dc2626', cursor:'pointer', fontSize:'1rem' }}>🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setServiceRows(prev => [...prev, EMPTY_SERVICE()])} style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Add Services ＋</button>
                            <button type="button" onClick={() => setProductRows(prev => [...prev, EMPTY_PRODUCT()])} style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Add Product ＋</button>
                            <button type="button" onClick={() => setMembershipRows(prev => [...prev, EMPTY_MEMBERSHIP()])} style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Add Membership ＋</button>
                            <button type="button" onClick={() => setPackageRows(prev => [...prev, EMPTY_PACKAGE()])} style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Add Package ＋</button>
                            <button type="button" onClick={() => setWalletRows(prev => [...prev, EMPTY_WALLET_RECHARGE()])} style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Top Up Wallet 💳</button>
                        </div>
                    </div>

                    {/* ── Modifiers ── */}
                    <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', borderTop: '1px solid var(--v2-border)', borderBottom: '1px solid var(--v2-border)' }}>
                        <div>
                            <label style={labelStyle}>Use Points</label>
                            <input type="number" placeholder="0" value={rewardPoints} onChange={e => setRewardPoints(e.target.value)} max={selectedClient?.loyaltyPoints || 0} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Use E-Wallet</label>
                            <input type="number" placeholder="₹0.00" value={walletUsed} onChange={e => setWalletUsed(e.target.value)} max={selectedClient?.walletBalance || 0} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Ex Charges</label>
                            <input type="number" placeholder="0.00" value={exCharge} onChange={e => setExCharge(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Discount</label>
                            <input type="number" placeholder="0" value={discount} onChange={e => { setDiscount(e.target.value); setAppliedPromo(null); }} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Discount Type</label>
                            <select value={discountType} onChange={e => { setDiscountType(e.target.value); setAppliedPromo(null); }} style={inputStyle}>
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Promo Code</label>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <input type="text" placeholder="CODE" value={promoInput} onChange={e => setPromoInput(e.target.value)} style={{...inputStyle, textTransform: 'uppercase'}} />
                                <button type="button" onClick={handleApplyPromo} style={{ background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', padding: '0 0.5rem' }}>✓</button>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Gift Card</label>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <input type="text" placeholder="GIFT-XXXX" value={giftCardInput} onChange={e => setGiftCardInput(e.target.value)} style={{...inputStyle, textTransform: 'uppercase'}} />
                                <button type="button" onClick={handleApplyGiftCard} style={{ background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', padding: '0 0.5rem' }}>✓</button>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>GST %</label>
                            <input type="number" placeholder="0.00" value={gst} onChange={e => setGst(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Referred By (Phone)</label>
                            <input type="text" placeholder="10-digit number" value={referredByPhone} onChange={e => setReferredByPhone(e.target.value.replace(/\D/g, ''))} maxLength={10} style={inputStyle} />
                            {referrerName && (
                                <div style={{ color: '#10b981', fontSize: '0.72rem', marginTop: '0.25rem', fontWeight: '700' }}>
                                    ✅ {referrerName}
                                </div>
                            )}
                            {referrerError && (
                                <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', fontWeight: '700' }}>
                                    ❌ {referrerError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Bottom Section (Payment & Summary) ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', background: '#f8fafc', padding: '1.5rem', gap: '2rem' }}>
                        
                        {/* Payment Left */}
                        <div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                {['cash', 'card', 'upi', 'split'].map(m => (
                                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.6rem 1rem', border: `1.5px solid ${payMode === m ? 'var(--v2-primary)' : '#d1d5db'}`, borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textTransform: 'capitalize', color: payMode === m ? 'var(--v2-primary)' : '#374151', background: 'white' }}>
                                        <input type="radio" name="payMode" value={m} checked={payMode === m} onChange={() => setPayMode(m)} style={{ display: 'none' }} />{m}
                                    </label>
                                ))}
                            </div>
                            
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={labelStyle}>Paying Now (Adjust for Partial Payment/Arrears)</label>
                                <input type="number" value={adjustPayment} onChange={e => setAdjustPayment(e.target.value)} style={{ ...inputStyle, fontSize: '1rem', fontWeight: '800' }} />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={labelStyle}>Tip Amount</label>
                                <input type="number" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
                            </div>

                            <textarea placeholder="Enter Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>

                        {/* Summary Right */}
                        <div>
                            <div style={{ background: '#e2e8f0', borderRadius: '8px', padding: '1.5rem' }}>
                                {[
                                    { l: 'Subtotal (₹):', v: fmt(subtotal) },
                                    { l: 'Tip Amount (₹):', v: fmt(tip) },
                                    { l: 'Total (₹):', v: fmt(totalBeforePoints), bold: true },
                                    { l: 'Taxable Amount (₹):', v: fmt(taxableAmount) },
                                    { l: 'Reward Points (₹):', v: `-${fmt(pointsDeduction)}`, c: '#dc2626' },
                                    { l: 'Wallet Paid (₹):', v: `-${fmt(walletDeduction)}`, c: '#dc2626' },
                                    ...(appliedGiftCard ? [{ l: 'Gift Card Paid (₹):', v: `-${fmt(giftCardDeduction)}`, c: '#059669' }] : []),
                                    { l: 'Grand Total (₹):', v: fmt(grandTotal), big: true },
                                    { l: 'Paying Now (₹):', v: fmt(payingNow), big: true },
                                    { l: 'Arrears Generated (₹):', v: fmt(dueAmount), big: true, c: dueAmount > 0 ? '#dc2626' : 'inherit' },
                                ].map((r, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < 6 ? '1px solid #cbd5e1' : 'none' }}>
                                        <span style={{ color: '#475569', fontWeight: r.bold || r.big ? '700' : '600', fontSize: r.big ? '0.95rem' : '0.85rem' }}>{r.l}</span>
                                        <span style={{ fontWeight: '900', color: r.c || 'var(--v2-text-main)', fontSize: r.big ? '1.25rem' : '1rem' }}>{r.v}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <button type="submit" disabled={isProcessing} style={{ width: '100%', padding: '1.25rem', marginTop: '1.5rem', background: '#1f2937', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                {isProcessing ? 'Processing...' : 'Generate Bill'}
                            </button>
                            {lastBill && (
                                <button type="button" onClick={() => setShowReceiptModal(true)} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', background: 'white', color: '#1f2937', border: '2px solid #1f2937', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}>
                                    🧾 View / Print Last Receipt
                                </button>
                            )}
                        </div>

                    </div>
                </form>
            </div>

            {/* Admin PIN Override Modal */}
            {showAdminPINModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setShowAdminPINModal(false)}>
                    <form onSubmit={handleAdminPINSubmit} className="v2-card" style={{ maxWidth: '350px', width: '100%', padding: '2rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', marginBottom: '0.5rem' }}>Admin Approval Required</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--v2-text-muted)', marginBottom: '1.5rem' }}>This checkout exceeds the 15% discount limit. Please enter the Admin PIN to authorize.</p>
                        
                        <input
                            type="password"
                            required
                            placeholder="Enter 4-digit PIN"
                            value={adminPINInput}
                            onChange={e => setAdminPINInput(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                            style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', marginBottom: '1.5rem' }}
                        />

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => setShowAdminPINModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" style={{ flex: 1, padding: '0.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>Authorize</button>
                        </div>
                    </form>
                </div>
            )}

            {showReceiptModal && lastBill && (
                <ReceiptModal bill={lastBill} onClose={() => setShowReceiptModal(false)} />
            )}

            {/* ── Add Client Quick Modal ── */}
            {showAddClientModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowAddClientModal(false)}>
                    <form onSubmit={handleSaveNewClient} style={{ background: 'white', borderRadius: '16px', maxWidth: '460px', width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'slideUp 0.22s ease' }} onClick={e => e.stopPropagation()}>
                        <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.5rem 2rem' }}>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: '900' }}>➕ Add New Client</h2>
                            <p style={{ margin: '0.35rem 0 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>Save client to database and auto-select for this bill</p>
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
        </Layout>
    );
}
