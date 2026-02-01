import { useState, useEffect, useRef, useMemo } from 'react';
import { serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataProvider';

export default function NewBooking() {
    const [step, setStep] = useState(1);
    const [client, setClient] = useState({ name: '', phone: '' });

    const { services, loadingServices, settings } = useData();
    const [selectedServices, setSelectedServices] = useState([]);

    // Timer State
    const [timerActive, setTimerActive] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const intervalRef = useRef(null);

    const [paymentType, setPaymentType] = useState('cash');
    const [loading, setLoading] = useState(false);

    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customService, setCustomService] = useState({ name: '', price: '' });

    const { currentUser, selectedStylist } = useAuth();
    const navigate = useNavigate();

    const handlePhoneChange = (val) => {
        // Only allow digits, max 10
        const digits = val.replace(/\D/g, '').slice(0, 10);
        setClient(prev => ({ ...prev, phone: digits }));
    };

    const handleNameChange = (val) => {
        // Only allow letters and spaces
        const sanitized = val.replace(/[^a-zA-Z\s]/g, '');
        setClient(prev => ({ ...prev, name: sanitized }));
    };

    // Optimized: Filter services based on stylist permissions
    const displayedServices = useMemo(() => {
        if (!selectedStylist || !selectedStylist.allowedServices || selectedStylist.allowedServices.length === 0) {
            return services;
        }
        return services.filter(s => selectedStylist.allowedServices.includes(s.id));
    }, [services, selectedStylist]);

    useEffect(() => {
        return () => clearInterval(intervalRef.current);
    }, []);

    const startTimer = () => {
        if (timerActive) return;
        setTimerActive(true);
        intervalRef.current = setInterval(() => {
            setSeconds(prev => prev + 1);
        }, 1000);
    };

    const pauseTimer = () => {
        setTimerActive(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
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

    const updateDiscount = (id, value) => {
        const val = Math.min(100, Math.max(0, parseFloat(value) || 0));
        setSelectedServices(selectedServices.map(s =>
            s.id === id ? { ...s, discount: val } : s
        ));
    };

    const calculateTotal = useMemo(() => {
        return selectedServices.reduce((sum, s) => {
            const discountedPrice = s.price - (s.price * (s.discount / 100));
            return sum + discountedPrice;
        }, 0);
    }, [selectedServices]);

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

            const visitData = {
                stylistId,
                stylistName,
                clientName: client.name,
                clientPhone: client.phone,
                services: selectedServices,
                totalAmount: calculateTotal,
                durationSeconds: seconds,
                durationMinutes: Math.ceil(seconds / 60),
                paymentType,
                timestamp: serverTimestamp(),
            };

            await addDoc(collection(db, 'appointments'), visitData);
            alert('Booking Completed!');
            navigate('/');
        } catch (error) {
            console.error("Booking failed:", error);
            alert('Error processing booking.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };

    return (
        <div className="container" style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '2rem' }}>New Booking</h2>

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
                        <label className="form-label">Phone Number</label>
                        <input
                            type="tel"
                            className="form-input"
                            value={client.phone}
                            onChange={e => handlePhoneChange(e.target.value)}
                            placeholder="9876543210 (Digits only)"
                            maxLength={10}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Client Name</label>
                        <input
                            type="text"
                            className="form-input"
                            value={client.name}
                            onChange={e => handleNameChange(e.target.value)}
                            placeholder="Client Name (Letters only)"
                        />
                    </div>
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

                    <button className="btn-outline" onClick={() => setStep(2)} style={{ marginTop: '2.5rem', border: 'none' }}>
                        &larr; Modify Services
                    </button>
                </div>
            )}

            {step === 4 && (
                <div className="card animate-fade-in">
                    <h3>Review & Pay</h3>
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
                            return (
                                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatCurrency(s.price)} base</div>
                                    </div>
                                    <input
                                        type="number"
                                        className="form-input"
                                        style={{ height: '2.5rem', padding: '0 0.5rem', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', borderColor: s.discount > (settings?.maxDiscount ?? 50) ? 'var(--danger)' : 'var(--border-color)' }}
                                        value={s.discount}
                                        onChange={(e) => updateDiscount(s.id, e.target.value)}
                                        placeholder="0"
                                    />
                                    <span style={{ textAlign: 'right', fontWeight: '800', fontSize: '1rem' }}>{formatCurrency(discountedPrice)}</span>
                                </div>
                            );
                        })}
                        <div style={{ borderTop: '2px solid var(--border-strong)', marginTop: '2rem', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: '800', fontSize: '0.75rem' }}>TOTAL PAYABLE</span>
                            <span style={{ color: 'var(--text-accent)', fontSize: '2rem', fontWeight: '900' }}>{formatCurrency(calculateTotal)}</span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label className="form-label" style={{ marginBottom: '1rem' }}>Select Payment Method</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setPaymentType('cash')}
                                className={paymentType === 'cash' ? 'btn-primary' : 'btn-outline'}
                                style={{ flex: 1, padding: '1rem' }}
                            >
                                Cash
                            </button>
                            <button
                                onClick={() => setPaymentType('card')}
                                className={paymentType === 'card' ? 'btn-primary' : 'btn-outline'}
                                style={{ flex: 1, padding: '1rem' }}
                            >
                                Card / UPI
                            </button>
                        </div>
                    </div>

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
