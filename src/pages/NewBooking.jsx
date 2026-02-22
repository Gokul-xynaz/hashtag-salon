import { useState, useEffect, useRef, useMemo } from 'react';
import { serverTimestamp, collection, doc, setDoc, deleteDoc, Timestamp, getDocs, query, where, arrayUnion, increment, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataProvider';



export default function NewBooking() {
    const [step, setStep] = useState(1);
    const [client, setClient] = useState({ name: '', phone: '' });

    const { services, loadingServices, settings, customers, products } = useData();
    const [selectedServices, setSelectedServices] = useState([]);
    const [isReturningClient, setIsReturningClient] = useState(false);

    // Timer State
    const [timerActive, setTimerActive] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [timerStartMs, setTimerStartMs] = useState(null);
    const [timerBaseSeconds, setTimerBaseSeconds] = useState(0);
    const intervalRef = useRef(null);

    const [paymentType, setPaymentType] = useState('cash');
    const [referralCode, setReferralCode] = useState('');
    const [referralData, setReferralData] = useState(null); // { referrerPhone, originStylistId }
    const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customService, setCustomService] = useState({ name: '', price: '' });
    const [creditAmount, setCreditAmount] = useState(0);

    const [redeemPoints, setRedeemPoints] = useState(false);
    const [pointsApplied, setPointsApplied] = useState(0);

    const [productUsage, setProductUsage] = useState([]); // [{ id, name, amount, unit }]
    const [selectedUsageProductId, setSelectedUsageProductId] = useState('');
    const [usageAmount, setUsageAmount] = useState('');

    // Phase 10: Dynamic Retail Sales State
    const RETAIL_INVENTORY = useMemo(() => {
        return products.filter(p => p.isRetail === true);
    }, [products]);
    const [selectedRetail, setSelectedRetail] = useState([]); // [{ id, name, price, qty }]

    const { currentUser, selectedStylist, selectStylist } = useAuth();
    const navigate = useNavigate();

    const handlePhoneChange = (val) => {
        // Only allow digits, max 10
        const digits = val.replace(/\D/g, '').slice(0, 10);
        setClient(prev => ({ ...prev, phone: digits }));

        // Instant Lookup
        if (digits.length === 10) {
            const existing = customers?.find(c => c.phone === digits);
            if (existing) {
                // Auto-populate name if they are returning
                setClient(prev => ({ ...prev, name: existing.name }));
                setIsReturningClient(true);
            } else {
                setIsReturningClient(false);
            }
        } else {
            setIsReturningClient(false);
        }
    };

    const validateReferral = (code) => {
        setReferralCode(code.toUpperCase());
        if (!code) {
            setReferralData(null);
            return;
        }

        // Format: STYLISTCODE-LAST4
        const parts = code.split('-');
        if (parts.length !== 2) return;

        const [sCode, last4] = parts;

        // Anti-Spam: Only new customers can use referral codes
        if (isReturningClient) {
            setReferralData({ error: 'Referrals only for new clients.' });
            return;
        }

        // Find referrer by last 4 digits matching a customer phone
        const referrer = customers?.find(c => c.phone.endsWith(last4));
        const stylist = stylists?.find(s => s.shortCode === sCode.toUpperCase());

        if (referrer && stylist) {
            setReferralData({
                referrerPhone: referrer.phone,
                originStylistId: stylist.id,
                referrerName: referrer.name
            });
        } else {
            setReferralData({ error: 'Invalid Code.' });
        }
    };

    const handleNameChange = (val) => {
        // Only allow letters and spaces
        const sanitized = val.replace(/[^a-zA-Z\s]/g, '');
        setClient(prev => ({ ...prev, name: sanitized }));
    };

    const handleGoHome = () => {
        selectStylist(null);
        navigate('/');
    };

    // 1. Session Loading: Check for existing session on mount
    useEffect(() => {
        if (!selectedStylist) return;

        const loadSession = async () => {
            setIsLoaded(false); // Reset loading state when stylist changes
            // Reset local states to avoid cross-contamination
            setClient({ name: '', phone: '' });
            setSelectedServices([]);
            setStep(1);
            setSeconds(0);
            setTimerActive(false);
            setTimerStartMs(null);
            setTimerBaseSeconds(0);

            try {
                const snapshot = await getDocs(query(collection(db, 'ongoing_sessions'), where('stylistId', '==', selectedStylist.id)));

                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    // Resume state
                    setClient(data.client || { name: '', phone: '' });
                    setSelectedServices(data.selectedServices || []);
                    setStep(data.step || 1);
                    setPaymentType(data.paymentType || 'cash');

                    // Resume timer logic
                    if (data.timerActive && data.timerStartMs) {
                        const elapsedSinceStart = Math.floor((Date.now() - data.timerStartMs) / 1000);
                        const totalSeconds = (data.timerBaseSeconds || 0) + elapsedSinceStart;
                        setSeconds(totalSeconds);
                        setTimerStartMs(data.timerStartMs);
                        setTimerBaseSeconds(data.timerBaseSeconds || 0);
                        setTimerActive(true);
                    } else {
                        setSeconds(data.seconds || 0);
                        setTimerActive(false);
                        setTimerStartMs(null);
                        setTimerBaseSeconds(data.seconds || 0);
                    }
                }
            } catch (err) {
                console.error("Session load error:", err);
            } finally {
                setIsLoaded(true);
            }
        };
        loadSession();
    }, [selectedStylist]);

    // 2. Session Auto-Save: Sync local state to Firestore
    useEffect(() => {
        if (!selectedStylist || !isLoaded || (step === 1 && !client.phone)) return;

        const saveSession = async () => {
            try {
                const sessionRef = doc(db, 'ongoing_sessions', selectedStylist.id);
                await setDoc(sessionRef, {
                    stylistId: selectedStylist.id,
                    stylistName: selectedStylist.name,
                    client,
                    selectedServices,
                    step,
                    seconds,
                    timerActive,
                    timerStartMs,
                    timerBaseSeconds,
                    paymentType,
                    lastUpdated: serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.error("Session auto-save failed:", err);
            }
        };

        const timeout = setTimeout(saveSession, 1500);
        return () => clearTimeout(timeout);
    }, [client, selectedServices, step, timerActive, timerStartMs, timerBaseSeconds, paymentType, selectedStylist, isLoaded]);

    // Optimized: Filter services based on stylist permissions
    const displayedServices = useMemo(() => {
        if (!selectedStylist || !selectedStylist.allowedServices || selectedStylist.allowedServices.length === 0) {
            return services;
        }
        return services.filter(s => selectedStylist.allowedServices.includes(s.id));
    }, [services, selectedStylist]);

    useEffect(() => {
        if (timerActive) {
            intervalRef.current = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [timerActive]);

    const startTimer = () => {
        if (timerActive) return;
        const now = Date.now();
        setTimerStartMs(now);
        setTimerBaseSeconds(seconds);
        setTimerActive(true);
    };

    const pauseTimer = () => {
        setTimerActive(false);
        setTimerStartMs(null);
        setTimerBaseSeconds(seconds);
    };

    const finishSession = () => {
        pauseTimer();
        setStep(4);
    };

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleService = (service) => {
        const existing = selectedServices.find(s => s.id === service.id);
        if (existing) {
            setSelectedServices(selectedServices.filter(s => s.id !== service.id));
        } else {
            setSelectedServices([...selectedServices, { ...service, discount: 0 }]);
        }
    };

    const addCustomService = () => {
        if (!customService.name || !customService.price) return;
        const newService = {
            id: 'custom_' + Date.now(),
            name: customService.name + ' (Custom)',
            price: parseFloat(customService.price),
            discount: 0,
            isCustom: true
        };
        setSelectedServices([...selectedServices, newService]);
        setCustomService({ name: '', price: '' });
        setShowCustomModal(false);
    };

    const addProductUsage = (product, amount) => {
        const existing = productUsage.find(p => p.id === product.id);
        if (existing) {
            setProductUsage(productUsage.map(p =>
                p.id === product.id ? { ...p, amount: p.amount + parseFloat(amount) } : p
            ));
        } else {
            setProductUsage([...productUsage, {
                id: product.id,
                name: product.name,
                amount: parseFloat(amount),
                unit: product.unit || 'ml'
            }]);
        }
        setShowProductSearch(false);
    };

    const removeProductUsage = (id) => {
        setProductUsage(productUsage.filter(p => p.id !== id));
    };

    // Phase 9: Retail Management Functions
    const addRetailProduct = (product) => {
        const existing = selectedRetail.find(p => p.id === product.id);
        if (existing) {
            setSelectedRetail(selectedRetail.map(p =>
                p.id === product.id ? { ...p, qty: p.qty + 1 } : p
            ));
        } else {
            setSelectedRetail([...selectedRetail, { ...product, qty: 1 }]);
        }
    };

    const removeRetailProduct = (id) => {
        const existing = selectedRetail.find(p => p.id === id);
        if (existing.qty > 1) {
            setSelectedRetail(selectedRetail.map(p =>
                p.id === id ? { ...p, qty: p.qty - 1 } : p
            ));
        } else {
            setSelectedRetail(selectedRetail.filter(p => p.id !== id));
        }
    };

    const updateDiscount = (id, value) => {
        const val = Math.min(100, Math.max(0, parseFloat(value) || 0));
        setSelectedServices(selectedServices.map(s =>
            s.id === id ? { ...s, discount: val } : s
        ));
    };

    const calculateTotal = useMemo(() => {
        const servicesTotal = selectedServices.reduce((sum, s) => {
            const discountedPrice = s.price - (s.price * (s.discount / 100));
            return sum + discountedPrice;
        }, 0);

        const retailTotal = selectedRetail.reduce((sum, p) => sum + (p.price * p.qty), 0);

        const loyaltyDiscount = redeemPoints ? (pointsApplied / (settings?.pointsToInrRate || 10)) : 0;
        return Math.max(0, servicesTotal + retailTotal - loyaltyDiscount);
    }, [selectedServices, selectedRetail, redeemPoints, pointsApplied, settings]);

    const calculateServiceTotal = useMemo(() => {
        const servicesTotal = selectedServices.reduce((sum, s) => {
            const discountedPrice = s.price - (s.price * (s.discount / 100));
            return sum + discountedPrice;
        }, 0);
        const loyaltyDiscount = redeemPoints ? (pointsApplied / (settings?.pointsToInrRate || 10)) : 0;
        return Math.max(0, servicesTotal - loyaltyDiscount);
    }, [selectedServices, redeemPoints, pointsApplied, settings]);

    const calculateRetailTotal = useMemo(() => {
        return selectedRetail.reduce((sum, p) => sum + (p.price * p.qty), 0);
    }, [selectedRetail]);

    const handleCheckout = async () => {
        if (selectedServices.length === 0) return;

        // Validation: Dynamic Max Discount from Settings
        const maxLimit = settings?.maxDiscount ?? 50;
        const excessiveDiscount = selectedServices.find(s => s.discount > maxLimit);
        if (excessiveDiscount) {
            alert(`Maximum allowed discount is ${maxLimit}%. Please adjust ${excessiveDiscount.name}.`);
            return;
        }

        setLoading(true);

        try {
            if (!selectedStylist) {
                alert('Session lost. Please select your name on the dashboard again.');
                setLoading(false);
                return;
            }

            const stylistName = selectedStylist.name;
            const stylistId = selectedStylist.id;

            // Load reward settings
            const refBonus = settings?.referralDiscountAmount ?? 100;
            const loyaltyRatio = settings?.loyaltyPointRatio ?? 100;

            let finalAmount = calculateTotal;
            let appliedReferralBalance = 0;

            const serviceAmount = calculateServiceTotal;
            const retailAmount = calculateRetailTotal;

            if (referralData && !referralData.error) {
                finalAmount = Math.max(0, finalAmount - refBonus);
                appliedReferralBalance = refBonus;
            }

            const effectiveDate = new Date(billingDate);
            const now = new Date();
            if (billingDate === now.toISOString().split('T')[0]) {
                effectiveDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            } else {
                effectiveDate.setHours(12, 0, 0, 0);
            }

            const visitData = {
                stylistId,
                stylistName,
                clientName: client.name,
                clientPhone: client.phone,
                services: selectedServices,
                retailItems: selectedRetail, // Phase 9: Log retail items
                serviceRevenue: serviceAmount, // Split for reporting
                retailRevenue: retailAmount,   // Split for reporting
                totalAmount: finalAmount,
                durationSeconds: seconds,
                durationMinutes: Math.ceil(seconds / 60),
                paymentType,
                referralRewardUsed: appliedReferralBalance,
                productUsage, // Consumption metrics
                timestamp: Timestamp.fromDate(effectiveDate),
                createdTimestamp: serverTimestamp(),
            };

            // Fix Apprended data before Saving
            const finalCreditAmount = paymentType === 'credit' ? creditAmount : 0;
            if (paymentType === 'credit') {
                visitData.creditAmount = finalCreditAmount;
                visitData.paidAmount = finalAmount - finalCreditAmount;
            } else {
                visitData.paidAmount = finalAmount;
            }

            const customerRef = doc(db, 'customers', client.phone);
            const existingCustomer = customers?.find(c => c.phone === client.phone);
            const newReferralCode = existingCustomer?.referralCode || `${selectedStylist.shortCode || 'SAL'}-${client.phone.slice(-4)}`;
            const isReturningCustomer = !!existingCustomer;

            const appointmentRef = doc(collection(db, 'appointments'));
            const retailRefs = selectedRetail.map(item => ({
                ref: doc(db, 'products', item.id),
                qty: item.qty,
                name: item.name,
                type: 'retail'
            }));

            const usageRefs = productUsage.map(item => ({
                id: item.id,
                ref: doc(db, 'products', item.id),
                qty: item.amount,
                name: item.name,
                unit: item.unit,
                type: 'usage'
            }));

            const allProductRefs = [...retailRefs, ...usageRefs];

            let referrerRef = null;
            if (referralData && !referralData.error && !isReturningCustomer) {
                referrerRef = doc(db, 'customers', referralData.referrerPhone);
            }

            // ATOMIC TRANSACTION START
            await runTransaction(db, async (transaction) => {
                // 1. Read Stock
                const stockUpdates = [];
                for (const item of allProductRefs) {
                    const pDoc = await transaction.get(item.ref);
                    if (!pDoc.exists()) throw new Error(`Product ${item.name} not found in database.`);
                    const currentStock = pDoc.data().stock || 0;
                    if (currentStock < item.qty) {
                        throw new Error(`Insufficient stock for ${item.name}. Only ${currentStock} left.`);
                    }
                    stockUpdates.push({ ref: item.ref, newStock: currentStock - item.qty, item });
                }

                // 2. Perform Writes (Stock Deduction & Logs)
                for (const update of stockUpdates) {
                    transaction.update(update.ref, { stock: update.newStock });

                    // Phase 15: Create global consumption log if this was service usage
                    if (update.item.type === 'usage') {
                        const logRef = doc(collection(db, 'consumption_logs'));
                        transaction.set(logRef, {
                            productId: update.item.id,
                            productName: update.item.name,
                            amount: update.item.qty,
                            unit: update.item.unit,
                            reason: 'Service Consumption',
                            loggedBy: `Stylist: ${stylistName}`,
                            timestamp: serverTimestamp()
                        });
                    }
                }

                // 3. Save Appointment
                transaction.set(appointmentRef, visitData);

                // 4. Upsert Customer Record
                const updateData = {
                    name: client.name,
                    phone: client.phone,
                    associatedStylists: arrayUnion(selectedStylist.id),
                    [`stylistData.${selectedStylist.id}.visits`]: increment(1),
                    [`stylistData.${selectedStylist.id}.spent`]: increment(finalAmount),
                    [`stylistData.${selectedStylist.id}.lastVisit`]: serverTimestamp(),
                    globalStats: {
                        totalVisits: increment(1),
                        totalSpent: increment(finalAmount),
                        lastVisitOverall: serverTimestamp()
                    },
                    loyaltyPoints: increment(Math.floor(finalAmount / loyaltyRatio) - (redeemPoints ? pointsApplied : 0)),
                    lastUpdated: serverTimestamp(),
                    referralCode: newReferralCode
                };

                if (paymentType === 'credit') {
                    updateData.pendingBalance = increment(finalCreditAmount);
                }

                transaction.set(customerRef, updateData, { merge: true });

                // 5. Update Referrer (if applicable)
                if (referrerRef) {
                    transaction.set(referrerRef, { referralRewardsBalance: increment(refBonus) }, { merge: true });
                    transaction.set(customerRef, { referredBy: referralData.referrerPhone, originStylistId: referralData.originStylistId }, { merge: true });
                }
            });

            // Clean up persistent session
            try {
                await deleteDoc(doc(db, 'ongoing_sessions', selectedStylist.id));
            } catch (cleanupErr) {
                console.warn("Session cleanup failed:", cleanupErr);
            }

            alert('Booking Completed!');
            selectStylist(null);
            navigate('/');
        } catch (error) {
            console.error("Booking failed:", error);
            alert(error.message || 'Error processing booking.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    return (
        <div className="container" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    onClick={handleGoHome}
                    className="btn-outline"
                    style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        opacity: 0.7,
                        transition: 'opacity 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.opacity = 1}
                    onMouseOut={e => e.currentTarget.style.opacity = 0.7}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    HOME
                </button>
                <h2 style={{ margin: 0 }}>New Booking</h2>
            </div>

            {/* Progress Bar */}
            <div style={{ display: 'flex', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', fontSize: '0.8rem' }}>
                <div style={{ marginRight: '1rem', color: step >= 1 ? 'var(--primary)' : 'var(--text-secondary)' }}>1. Client</div>
                <div style={{ marginRight: '1rem', color: step >= 2 ? 'var(--primary)' : 'var(--text-secondary)' }}>2. Services</div>
                <div style={{ marginRight: '1rem', color: step >= 3 ? 'var(--primary)' : 'var(--text-secondary)' }}>3. Session</div>
                <div style={{ color: step >= 4 ? 'var(--primary)' : 'var(--text-secondary)' }}>4. Pay</div>
            </div>

            {step === 1 && (
                <div className="card animate-fade-in">
                    <h3>Client Details</h3>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="tel"
                                className="form-input"
                                value={client.phone}
                                onChange={e => handlePhoneChange(e.target.value)}
                                placeholder="9876543210 (Digits only)"
                                maxLength={10}
                            />
                            {client.phone.length >= 3 && customers?.filter(c => c.phone.includes(client.phone)).length > 0 && !isReturningClient && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 100,
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    border: '1px solid var(--border-color)',
                                    marginTop: '0.25rem',
                                    animation: 'slide-down 0.2s ease-out'
                                }}>
                                    {customers.filter(c => c.phone.includes(client.phone)).slice(0, 5).map(c => (
                                        <div
                                            key={c.phone}
                                            onClick={() => {
                                                setClient({ name: c.name, phone: c.phone });
                                                setIsReturningClient(true);
                                            }}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                            onMouseOut={e => e.currentTarget.style.background = 'white'}
                                        >
                                            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{c.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.phone}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Client Name</label>
                        <input
                            type="text"
                            className="form-input"
                            value={client.name}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="Client Name (Letters only)"
                            style={{ background: isReturningClient ? '#f8fafc' : 'white' }}
                        />
                    </div>
                    {isReturningClient ? (
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: 'rgba(74, 222, 128, 0.05)',
                            border: '1px solid rgba(74, 222, 128, 0.2)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: '#16a34a', fontSize: '1rem' }}>✓</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#16a34a' }}>REGULAR CLIENT IDENTIFIED</span>
                            </div>
                            <button
                                onClick={() => {
                                    setClient({ name: '', phone: '' });
                                    setIsReturningClient(false);
                                }}
                                style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Clear
                            </button>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                Referral Code (Optional)
                                {referralData && (
                                    <span style={{ color: referralData.error ? 'var(--danger)' : 'var(--success)', fontSize: '0.65rem', fontWeight: '800' }}>
                                        {referralData.error ? referralData.error : `REWARD: ${referralData.referrerName?.toUpperCase()}`}
                                    </span>
                                )}
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={referralCode}
                                onChange={e => validateReferral(e.target.value)}
                                placeholder="STYLIST-CODE (e.g. SAM-1234)"
                                style={{ borderColor: referralData?.error ? 'var(--danger)' : referralData ? 'var(--success)' : 'var(--border-color)' }}
                            />
                        </div>
                    )}
                    <button
                        className="btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => setStep(2)}
                        disabled={!client.name || client.phone.length < 10}
                    >
                        Next: Select Services
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="card animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ marginBottom: 0 }}>Select Services</h3>
                        <button
                            onClick={() => setShowCustomModal(true)}
                            className="btn-outline"
                            style={{ height: '2rem', padding: '0 1rem', fontSize: '0.7rem' }}
                        >
                            + Custom Service
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', margin: '2rem 0' }}>
                        {displayedServices.map(service => {
                            const isSelected = selectedServices.find(s => s.id === service.id);
                            return (
                                <div
                                    key={service.id}
                                    onClick={() => toggleService(service)}
                                    style={{
                                        padding: '1.25rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                        background: isSelected ? 'var(--bg-secondary)' : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{service.name}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                        {formatCurrency(service.price)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {selectedServices.filter(s => s.isCustom).length > 0 && (
                        <div style={{ marginBottom: '1.5rem', background: '#f9f9f9', padding: '1rem', borderLeft: '3px solid black' }}>
                            <h4 style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Added Custom:</h4>
                            {selectedServices.filter(s => s.isCustom).map(s => (
                                <div key={s.id} onClick={() => toggleService(s)} style={{ cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                    • {s.name} ({formatCurrency(s.price)}) <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>[remove]</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
                        <button
                            className="btn-primary"
                            style={{ flex: 2 }}
                            onClick={() => setStep(3)}
                            disabled={selectedServices.length === 0}
                        >
                            Next: Start Session
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Session Duration</h3>

                    <div style={{
                        fontSize: '5rem',
                        fontWeight: '800',
                        fontFamily: 'monospace',
                        margin: '1.5rem 0',
                        color: timerActive ? 'var(--primary)' : 'var(--text-secondary)',
                        letterSpacing: '-0.02em'
                    }}>
                        {formatTime(seconds)}
                    </div>

                    <p style={{ marginBottom: '2.5rem', fontSize: '0.9rem' }}>
                        CLIENT: <span style={{ fontWeight: '800', borderBottom: '2px solid' }}>{client.name}</span>
                    </p>

                    <div style={{ display: 'grid', gap: '1rem', maxWidth: '340px', margin: '0 auto' }}>
                        {!timerActive ? (
                            <button
                                className="btn-primary"
                                onClick={startTimer}
                                style={{ background: 'var(--success)', borderColor: 'var(--success)', height: '4rem', fontSize: '1rem' }}
                            >
                                {seconds === 0 ? 'START SESSION' : 'RESUME'}
                            </button>
                        ) : (
                            <button
                                className="btn-secondary"
                                onClick={pauseTimer}
                                style={{ height: '4rem', fontSize: '1rem' }}
                            >
                                PAUSE SESSION
                            </button>
                        )}

                        <button
                            onClick={finishSession}
                            className="btn-primary"
                            style={{ height: '4rem', fontSize: '1rem' }}
                        >
                            FINISH & CHECKOUT &rarr;
                        </button>
                    </div>

                    <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.1em', fontWeight: '800' }}>PRODUCT CONSUMPTION</h4>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <select
                                className="form-input"
                                style={{ flex: 2, height: '3rem', appearance: 'auto' }}
                                value={selectedUsageProductId}
                                onChange={(e) => setSelectedUsageProductId(e.target.value)}
                            >
                                <option value="">Select Product...</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.unit || 'ml/grm'})</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="Amount"
                                style={{ flex: 1, height: '3rem', textAlign: 'center' }}
                                value={usageAmount}
                                onChange={(e) => setUsageAmount(e.target.value)}
                            />
                            <button
                                className="btn-primary"
                                style={{ height: '3rem', padding: '0 1rem' }}
                                onClick={() => {
                                    const p = products.find(x => x.id === selectedUsageProductId);
                                    if (p && usageAmount) {
                                        addProductUsage(p, usageAmount);
                                        setSelectedUsageProductId('');
                                        setUsageAmount('');
                                    }
                                }}
                            >
                                ADD
                            </button>
                        </div>

                        {productUsage.length > 0 ? (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {productUsage.map(p => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{p.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{p.amount} {p.unit}</span>
                                            <button
                                                onClick={() => removeProductUsage(p.id)}
                                                style={{ border: 'none', background: 'transparent', color: 'var(--danger)', fontSize: '1.2rem', cursor: 'pointer', padding: '0 0.5rem' }}
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>No products logged for this session yet.</p>
                        )}
                    </div>

                    <button className="btn-outline" onClick={() => setStep(2)} style={{ marginTop: '2.5rem', border: 'none' }}>
                        &larr; Modify Services
                    </button>
                </div>
            )}

            {step === 4 && (
                <div className="card animate-fade-in">
                    {isReturningClient && (() => {
                        const customer = customers?.find(c => c.phone === client.phone);
                        if (!customer) return null;
                        const hasCredit = (customer.pendingBalance || 0) > 0;

                        return (
                            <div style={{
                                marginBottom: '1.5rem',
                                padding: '1.25rem',
                                background: 'var(--text-primary)',
                                color: 'white',
                                borderRadius: 'var(--radius-md)',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                                boxShadow: 'var(--shadow-md)'
                            }}>
                                <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontSize: '0.6rem', opacity: 0.7, letterSpacing: '0.1em', fontWeight: '800' }}>EXISTING CREDIT</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: hasCredit ? '#fca5a5' : 'white' }}>
                                        {formatCurrency(customer.pendingBalance || 0)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', opacity: 0.7, letterSpacing: '0.1em', fontWeight: '800' }}>LOYALTY BALANCE</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#f59e0b' }}>
                                        {customer.loyaltyPoints || 0} PTS
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    <div style={{ margin: '1.5rem 0', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                            <span>DURATION: {formatTime(seconds)}</span>
                            <span>STYLIST: {selectedStylist ? selectedStylist.name : 'Unknown'}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-strong)', fontWeight: '800', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                            <span>SERVICE</span>
                            <span style={{ textAlign: 'center' }}>DISC %</span>
                            <span style={{ textAlign: 'right' }}>FINAL</span>
                        </div>

                        {selectedServices.map(s => {
                            const discountedPrice = s.price - (s.price * (s.discount / 100));
                            const isExcessive = s.discount > (settings?.maxDiscount ?? 50);
                            return (
                                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: isExcessive ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: isExcessive ? '800' : '400' }}>
                                            {isExcessive ? '! EXCEEDS MAX LIMIT' : `${formatCurrency(s.price)} base`}
                                        </div>
                                    </div>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ height: '2.5rem', padding: '0 0.5rem', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', borderColor: isExcessive ? 'var(--danger)' : 'var(--border-color)', background: isExcessive ? '#fff1f2' : 'white' }}
                                        value={s.discount}
                                        onChange={(e) => updateDiscount(s.id, e.target.value)}
                                        placeholder="0"
                                    />
                                    <span style={{ textAlign: 'right', fontWeight: '800', fontSize: '1rem' }}>{formatCurrency(discountedPrice)}</span>
                                </div>
                            );
                        })}

                        {/* Phase 9 & 10: Retail Checkout Section Redesign */}
                        <div style={{ marginTop: '3.5rem', paddingTop: '2.5rem', borderTop: '2px dashed var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', letterSpacing: '0.05em', fontWeight: '800' }}>RETAIL STOREFRONT</h4>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add products to current bill</div>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '700', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                                    {RETAIL_INVENTORY.length} Items Available
                                </div>
                            </div>

                            {/* Inventory Selector (Grid Layout for better breathing space) */}
                            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1.5rem', marginBottom: '2rem', scrollbarWidth: 'thin' }}>
                                {RETAIL_INVENTORY.map(p => {
                                    const outOfStock = (p.stock || 0) <= 0;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => !outOfStock && addRetailProduct(p)}
                                            style={{
                                                minWidth: '180px',
                                                padding: '1.25rem',
                                                background: outOfStock ? 'var(--bg-secondary)' : 'white',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: outOfStock ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: outOfStock ? 'none' : 'var(--shadow-sm)',
                                                opacity: outOfStock ? 0.6 : 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                            onMouseOver={e => !outOfStock && (e.currentTarget.style.borderColor = 'var(--text-primary)', e.currentTarget.style.transform = 'translateY(-2px)')}
                                            onMouseOut={e => !outOfStock && (e.currentTarget.style.borderColor = 'var(--border-color)', e.currentTarget.style.transform = 'translateY(0)')}
                                        >
                                            {outOfStock && (
                                                <div style={{ position: 'absolute', top: '10px', right: '-25px', background: 'var(--danger)', color: 'white', fontSize: '0.6rem', fontWeight: '900', padding: '0.2rem 2.5rem', transform: 'rotate(45deg)', letterSpacing: '0.1em' }}>
                                                    SOLD OUT
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem' }}>{p.category?.toUpperCase() || 'GENERAL'}</div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: outOfStock ? 'var(--danger)' : 'var(--success)', background: outOfStock ? '#fee2e2' : '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                    In Stock: {p.stock || 0}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '800', lineHeight: '1.3', flex: 1, marginBottom: '1rem', color: 'var(--text-primary)' }}>{p.name}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(p.price)}</div>
                                                {!outOfStock && <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>+</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Selected Retail Items */}
                            {selectedRetail.length > 0 && (
                                <div className="animate-fade-in" style={{ background: 'var(--text-primary)', color: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', display: 'grid', gap: '1rem', boxShadow: 'var(--shadow-md)' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.1em', opacity: 0.8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                        ITEMS ADDED TO BILL
                                    </div>
                                    {selectedRetail.map(p => (
                                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{formatCurrency(p.price)} &times; {p.qty}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <span style={{ fontWeight: '900', fontSize: '1.1rem', color: '#fca5a5' }}>{formatCurrency(p.price * p.qty)}</span>
                                                <button
                                                    onClick={() => removeRetailProduct(p.id)}
                                                    style={{ border: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em' }}>RETAIL SUBTOTAL</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f59e0b' }}>{formatCurrency(calculateRetailTotal)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ borderTop: '2px solid var(--border-strong)', marginTop: '2rem', paddingTop: '1.5rem' }}>
                            {settings?.loyaltyRedemptionEnabled && isReturningClient && (
                                (() => {
                                    const customer = customers?.find(c => c.phone === client.phone);
                                    const balance = customer?.loyaltyPoints || 0;
                                    const conversionRate = settings?.pointsToInrRate || 10;

                                    if (balance > 0) {
                                        return (
                                            <div style={{
                                                marginBottom: '1.5rem',
                                                padding: '1.25rem',
                                                background: redeemPoints ? 'rgba(74, 222, 128, 0.1)' : 'white',
                                                border: redeemPoints ? '1px solid #4ade80' : '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-sm)',
                                                transition: 'all 0.3s'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em' }}>REDEEM POINTS</div>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Worth ≈{formatCurrency(balance / conversionRate)}</div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            if (!redeemPoints) setPointsApplied(balance);
                                                            else setPointsApplied(0);
                                                            setRedeemPoints(!redeemPoints);
                                                        }}
                                                        style={{
                                                            width: '44px',
                                                            height: '24px',
                                                            background: redeemPoints ? '#4ade80' : '#cbd5e1',
                                                            borderRadius: '12px',
                                                            padding: '2px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: redeemPoints ? 'flex-end' : 'flex-start'
                                                        }}
                                                    >
                                                        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%' }}></div>
                                                    </div>
                                                </div>

                                                {redeemPoints && (
                                                    <div className="animate-fade-in" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dotted #4ade80', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Applying {pointsApplied} pts</span>
                                                        <span style={{ color: '#16a34a', fontWeight: '900' }}>-{formatCurrency(pointsApplied / conversionRate)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontWeight: '800', fontSize: '0.75rem' }}>TOTAL PAYABLE</span>
                                <span style={{ color: 'var(--text-accent)', fontSize: '2rem', fontWeight: '900' }}>{formatCurrency(calculateTotal)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <label className="form-label" style={{ marginBottom: '1rem' }}>Billing Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={billingDate}
                                onChange={e => setBillingDate(e.target.value)}
                                style={{ height: '3.5rem', padding: '0 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ marginBottom: '1rem' }}>Payment Method</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setPaymentType('cash')}
                                    className={paymentType === 'cash' ? 'btn-primary' : 'btn-outline'}
                                    style={{ padding: '0.5rem', height: '3.5rem', fontSize: '0.75rem' }}
                                >
                                    CASH
                                </button>
                                <button
                                    onClick={() => setPaymentType('card')}
                                    className={paymentType === 'card' ? 'btn-primary' : 'btn-outline'}
                                    style={{ padding: '0.5rem', height: '3.5rem', fontSize: '0.75rem' }}
                                >
                                    CARD/UPI
                                </button>
                                <button
                                    onClick={() => {
                                        setPaymentType('credit');
                                        setCreditAmount(calculateTotal);
                                    }}
                                    className={paymentType === 'credit' ? 'btn-primary' : 'btn-outline'}
                                    style={{ padding: '0.5rem', height: '3.5rem', fontSize: '0.75rem', borderColor: paymentType === 'credit' ? 'var(--danger)' : 'var(--border-color)', color: paymentType === 'credit' ? 'white' : 'var(--danger)', background: paymentType === 'credit' ? 'var(--danger)' : 'transparent' }}
                                >
                                    CREDIT
                                </button>
                            </div>
                        </div>
                    </div>

                    {paymentType === 'credit' && (
                        <div className="animate-fade-in" style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: '#fff1f2',
                            border: '1px solid var(--danger)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <label className="form-label" style={{ color: 'var(--danger)', marginBottom: '0.25rem' }}>ENTER CREDIT AMOUNT (DEBT)</label>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0 }}>Remaining will be recorded as paid</p>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: 'var(--danger)' }}>₹</span>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={creditAmount}
                                        onChange={(e) => {
                                            const val = Math.min(calculateTotal, Math.max(0, parseFloat(e.target.value) || 0));
                                            setCreditAmount(val);
                                        }}
                                        style={{
                                            width: '120px',
                                            height: '3.5rem',
                                            padding: '0 1rem 0 2rem',
                                            fontSize: '1.2rem',
                                            fontWeight: '900',
                                            textAlign: 'right',
                                            borderColor: 'var(--danger)',
                                            color: 'var(--danger)'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>PAYING NOW: {formatCurrency(calculateTotal - creditAmount)}</span>
                                <span style={{ color: 'var(--danger)' }}>TO CREDIT: {formatCurrency(creditAmount)}</span>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(3)}>Back</button>
                        <button className="btn-primary" style={{ flex: 2, height: '4rem' }} onClick={handleCheckout} disabled={loading}>
                            {loading ? 'Completing...' : `CONFIRM & CLOSE`}
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Service Modal */}
            {showCustomModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255,255,255,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ background: 'white', padding: '2.5rem', borderRadius: 'var(--radius-md)', minWidth: '320px', boxShadow: 'var(--shadow-lg)' }}>
                        <h3>Other Service</h3>
                        <div className="form-group">
                            <label className="form-label">Service Name</label>
                            <input className="form-input" value={customService.name} onChange={e => setCustomService({ ...customService, name: e.target.value })} placeholder="e.g. Wedding Package" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Price (₹)</label>
                            <input className="form-input" type="number" value={customService.price} onChange={e => setCustomService({ ...customService, price: e.target.value })} placeholder="0.00" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn-primary" onClick={addCustomService}>Add</button>
                            <button className="btn-secondary" onClick={() => setShowCustomModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
