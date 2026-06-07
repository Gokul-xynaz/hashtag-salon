import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../../../context/DataProvider';
import { collection, addDoc, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { HASHTAG_SERVICES } from '../../utils/hashtagServices';

const buildDateStrip = () => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        result.push({ iso, day: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAYS[d.getDay()], num: d.getDate(), month: MONTHS[d.getMonth()] });
    }
    return result;
};

const BANDS = [
    { label: 'Morning',   hours: [10, 11, 12] },
    { label: 'Afternoon', hours: [13, 14, 15, 16] },
    { label: 'Evening',   hours: [17, 18, 19] },
];

const buildSlots = () => {
    const all = [];
    for (let h = 10; h <= 19; h++) {
        const time = `${String(h).padStart(2,'0')}:00`;
        const label = new Date(2000,0,1,h,0).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
        all.push({ time, label, hour: h });
    }
    return all;
};

const DATE_STRIP = buildDateStrip();
const ALL_SLOTS  = buildSlots();

const formatPrice = (p) => {
    if (typeof p === 'number') return `₹${p}`;
    if (!p) return '—';
    if (p.toLowerCase && p.toLowerCase() === 'free') return 'Free';
    if (p.toLowerCase && p.toLowerCase().includes('consultation')) return 'On Consultation';
    if (typeof p === 'string') {
        if (p.startsWith('₹')) return p;
        return `₹${p}`;
    }
    return '—';
};

export default function OnlineBooking() {
    const { stylists, services } = useData();

    const [step, setStep]               = useState(1); // 1=services, 2=time, 3=confirm, 4=success
    const [cart, setCart]               = useState([]);
    const [date, setDate]               = useState('');
    const [time, setTime]               = useState('');
    const [customer, setCustomer]       = useState({ name:'', phone:'', notes:'' });
    const [bookedTimes, setBookedTimes] = useState([]);
    const [loadingSlots, setLoading]    = useState(false);
    const [submitting, setSubmitting]   = useState(false);
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [mobileOrderOpen, setMobileOrderOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Men');
    const dateRef = useRef(null);
    const stepRef = useRef(step);

    const isDesktop = screenWidth >= 768;

    const activeStylistMap = useMemo(() => {
        return (stylists || []).filter(s => s.isActive !== false && s.role !== 'admin');
    }, [stylists]);

    const totalPrice = cart.reduce((acc,svc) => acc + (typeof svc.price==='number' ? svc.price : 0), 0);
    const totalDuration = cart.reduce((acc,svc)=>acc+(svc.duration||30),0);

    const addToCart = (svc) => {
        if (cart.find(i=>i.id===svc.id)) { setCart(cart.filter(i=>i.id!==svc.id)); return; }
        const hasSkin = cart.some(i=>i.category?.includes('Skin') || i.category?.includes('Facial'));
        const hasHair = cart.some(i=>i.category?.includes('Hair'));
        if ((svc.category?.includes('Skin') || svc.category?.includes('Facial')) && hasHair) { alert('Book skin consultation separately from hair services.'); return; }
        if (svc.category?.includes('Hair') && hasSkin) { alert('Book hair services separately from skin consultations.'); return; }
        setCart([...cart,svc]);
    };

    // Screen width listener
    useEffect(() => {
        const h = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    // Browser back support
    useEffect(() => { stepRef.current = step; }, [step]);
    useEffect(() => {
        const onPop = () => {
            const cur = stepRef.current;
            if (cur > 1) { setStep(cur - 1); window.history.pushState({ bookingStep: cur - 1 }, ''); }
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    const goToStep = (n) => { setStep(n); if (n > 1) window.history.pushState({ bookingStep: n }, ''); };

    // Load booked slots based on available professionals
    useEffect(() => {
        if (step!==2||!date) return;
        const load = async () => {
            setLoading(true);
            try {
                const s = new Date(date); s.setHours(0,0,0,0);
                const e = new Date(date); e.setHours(23,59,59,999);
                const q = query(collection(db,'appointments'), where('timestamp','>=',Timestamp.fromDate(s)), where('timestamp','<=',Timestamp.fromDate(e)));
                const snap = await getDocs(q);
                const allApps = snap.docs.map(d=>({id:d.id,...d.data()}));
                
                // Determine which staff are relevant based on category
                const hasSkin = cart.some(s=>s.category?.includes('Skin') || s.category?.includes('Facial'));
                const pool = hasSkin
                    ? activeStylistMap.filter(s => s.name.toLowerCase().includes('uvanciya'))
                    : activeStylistMap.filter(s => !s.name.toLowerCase().includes('uvanciya'));
                
                if (pool.length === 0) {
                    setBookedTimes([]);
                    return;
                }

                const active = allApps.filter(a => a.status!=='cancelled'&&a.status!=='void'&&a.status!=='no_show');
                const bookedByHour = {};
                active.forEach(a => {
                    if (!a.timestamp) return;
                    const hr = `${String(a.timestamp.toDate().getHours()).padStart(2,'0')}:00`;
                    if (!bookedByHour[hr]) bookedByHour[hr] = new Set();
                    bookedByHour[hr].add(a.stylistId);
                });
                
                const blockedTimes = [];
                Object.entries(bookedByHour).forEach(([hr, busyIds]) => {
                    // A time slot is only blocked if ALL staff in the pool are booked
                    if (pool.every(ps => busyIds.has(ps.id))) blockedTimes.push(hr);
                });
                setBookedTimes(blockedTimes);
            } catch(err){ console.error(err); }
            finally { setLoading(false); }
        };
        load();
    }, [date, step, cart, activeStylistMap]);

    const confirm = async (e) => {
        e.preventDefault();
        if (!date||!time||!cart.length||!customer.name||customer.phone.replace(/\D/g,'').length!==10) return alert('Please complete all required fields.');
        const key = `hashtag_book_${customer.phone}`;
        const prev = JSON.parse(localStorage.getItem(key)||'[]');
        const now = Date.now();
        const recent = prev.filter(t=>now-t<86400000);
        if (recent.length>=3) return alert('Max 3 bookings per 24 hrs. Contact the salon directly.');
        setSubmitting(true);
        try {
            const [h,m] = time.split(':').map(Number);
            const dt = new Date(date); dt.setHours(h,m,0,0);
            
            // Auto-assign any stylist
            let resolved = null;
            const hasSkin = cart.some(s=>s.category?.includes('Skin') || s.category?.includes('Facial'));
            if (hasSkin) resolved = activeStylistMap.find(s=>s.name.toLowerCase().includes('uvanciya'));
            else { 
                const hs=activeStylistMap.filter(s=>!s.name.toLowerCase().includes('uvanciya')); 
                if (hs.length > 0) resolved = hs[Math.floor(Math.random()*hs.length)]; 
            }

            await addDoc(collection(db,'appointments'), {
                clientName: customer.name, clientPhone: customer.phone, notes: customer.notes,
                stylistId: resolved?.id||'unassigned', stylistName: resolved?.name||'Any Professional',
                services: cart.map(s=>({id:s.id,name:s.name,price:s.price||0,duration:s.duration||30})),
                totalAmount: totalPrice, totalDuration, timestamp: Timestamp.fromDate(dt),
                status:'pending', source:'online_widget', createdAt: serverTimestamp()
            });
            localStorage.setItem(key,JSON.stringify([...recent,now]));
            setStep(4);
        } catch(err){ console.error(err); alert('Booking failed: '+err.message); }
        finally { setSubmitting(false); }
    };

    // ─── BREADCRUMB ──────────────────────────────────────────────────────────
    const breadcrumbLabels = ['Services','Time','Details','Done'];
    const renderBreadcrumb = () => {
        const activeIdx = step >= 4 ? 3 : step - 1;
        return (
            <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:'2rem', flexWrap:'wrap' }}>
                {breadcrumbLabels.map((label, i) => {
                    const isActive = i === activeIdx;
                    const isPast = i < activeIdx;
                    const isDone = i === 3;
                    return (
                        <React.Fragment key={label}>
                            {i > 0 && <span style={{ margin:'0 0.5rem', color:'#d1d5db', fontSize:'0.75rem', userSelect:'none' }}>›</span>}
                            <span
                                onClick={isPast && step < 4 ? () => goToStep(i + 1) : undefined}
                                style={{
                                    fontSize:'0.82rem',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'var(--v2-primary)' : isPast ? '#374151' : '#9ca3af',
                                    cursor: isPast && step < 4 ? 'pointer' : 'default',
                                    letterSpacing:'-0.01em',
                                    display:'flex', alignItems:'center', gap:'0.3rem'
                                }}
                            >
                                {label}
                                {isDone && step >= 4 && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v2-primary)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                                )}
                            </span>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    // ─── RIGHT SIDEBAR ───────────────────────────────────────────────────────
    const renderOrderPanel = () => {
        const formattedDate = date ? new Date(date).toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'}) : '';
        const formattedTime = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '';

        return (
            <div className="v2-order-panel">
                <div style={{ padding:'1.5rem', borderBottom:'1px solid var(--v2-border)', background:'var(--v2-bg-main)' }}>
                    <h3 style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--v2-text-main)', margin:0, letterSpacing:'-0.02em' }}>Order Summary</h3>
                    <p style={{ fontSize:'0.8rem', color:'var(--v2-text-muted)', margin:'0.2rem 0 0' }}>Hashtag Salon</p>
                </div>

                {cart.length > 0 ? (
                    <div style={{ padding:'1.5rem', borderBottom:'1px solid var(--v2-border)' }}>
                        {cart.map(svc => (
                            <div key={svc.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: '0.85rem' }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--v2-text-main)' }}>{svc.name}</div>
                                    <div style={{ fontSize:'0.72rem', color:'var(--v2-text-muted)' }}>{svc.duration ? `${svc.duration} min` : 'Varies'}</div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0, marginLeft:'0.75rem' }}>
                                    <span style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--v2-text-main)' }}>
                                        {formatPrice(svc.price)}
                                    </span>
                                    <button onClick={() => addToCart(svc)} style={{
                                        background:'rgba(239, 68, 68, 0.1)', color:'#ef4444', border:'none', borderRadius:'4px',
                                        cursor:'pointer', padding:'2px', display:'flex', alignItems:'center', justifyContent:'center'
                                    }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding:'2rem 1.5rem', textAlign:'center', borderBottom:'1px solid var(--v2-border)' }}>
                        <p style={{ fontSize:'0.85rem', color:'var(--v2-text-muted)', margin:0 }}>No services selected yet.</p>
                    </div>
                )}

                {date && (
                    <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--v2-border)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                            <div style={{ width:32, height:32, borderRadius:'8px', background:'var(--v2-primary-muted)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-primary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                            </div>
                            <div>
                                <div style={{ fontSize:'0.85rem', color:'var(--v2-text-main)', fontWeight:600 }}>{formattedDate}</div>
                                {time && <div style={{ fontSize:'0.75rem', color:'var(--v2-text-muted)' }}>at {formattedTime}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {cart.length > 0 && (
                    <div style={{ padding:'1.5rem', background:'var(--v2-bg-main)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                            <span style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--v2-text-main)' }}>Total</span>
                            <span style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--v2-primary)', letterSpacing:'-0.02em' }}>
                                {totalPrice > 0 ? `₹${totalPrice}` : 'TBD'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ─── STEP 1: SERVICES ────────────────────────────────────────────────────
    const renderServiceStep = () => {
        const categories = Object.keys(HASHTAG_SERVICES);
        const subcategories = HASHTAG_SERVICES[activeCategory];

        return (
        <div style={{ animation:'v2FadeIn 0.3s ease' }}>
            <h2 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--v2-text-main)', letterSpacing:'-0.03em', margin:'0 0 0.5rem' }}>Select Services</h2>
            <p style={{ color:'var(--v2-text-muted)', fontSize:'0.9rem', margin:'0 0 1.5rem' }}>Choose the services you'd like to book.</p>

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--v2-border)' }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            fontSize: '1rem',
                            fontWeight: activeCategory === cat ? '800' : '600',
                            color: activeCategory === cat ? 'var(--v2-primary)' : 'var(--v2-text-muted)',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeCategory === cat ? '3px solid var(--v2-primary)' : '3px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {Object.entries(subcategories).map(([subcat, svcs]) => (
                <div key={subcat} style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{ fontSize:'1.2rem', fontWeight:800, color:'var(--v2-text-main)', letterSpacing:'-0.02em', margin:'0 0 1rem' }}>{subcat}</h3>
                    <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap:'16px' }}>
                        {svcs.map(svc => {
                            // Assign an ID if it doesn't have one from FLAT_SERVICES, but since we're using HASHTAG_SERVICES directly, let's use name as ID for now or generate one based on name.
                            const svcId = svc.id || svc.name;
                            const sel = !!cart.find(i=>i.id===svcId || i.name===svc.name);
                            const priceDisplay = formatPrice(svc.price);

                            return (
                                <div
                                    key={svc.name}
                                    onClick={() => addToCart({ ...svc, id: svcId, category: subcat })}
                                    className={`v2-svc-card ${sel ? 'v2-svc-selected' : ''}`}
                                >
                                    <div style={{ flex:1, padding:'1.25rem 1rem 0.75rem' }}>
                                        <div className="v2-svc-name">{svc.name}</div>
                                        {svc.details && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', marginTop: '0.35rem', fontStyle: 'italic', lineHeight: '1.2' }}>
                                                Includes: {svc.details}
                                            </div>
                                        )}
                                        <div className="v2-svc-duration" style={{ marginTop: svc.details ? '0.5rem' : '0.25rem' }}>
                                            {svc.duration ? `${svc.duration} min` : 'Duration varies'}
                                        </div>
                                    </div>
                                    <div style={{ padding:'0.75rem 1rem 1rem' }}>
                                        <div className="v2-svc-price">{priceDisplay}</div>
                                    </div>
                                    {sel && (
                                        <div className="v2-svc-check">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {isDesktop && (
                <div style={{ marginTop:'2.5rem', display:'flex', justifyContent:'center' }}>
                    <button onClick={()=>goToStep(2)} disabled={cart.length===0} className="v2-btn-primary">
                        Continue to Time
                    </button>
                </div>
            )}
        </div>
    );
};

    // ─── STEP 2: DATE & TIME ─────────────────────────────────────────────────
    const renderDateTimeStep = () => {
        const now = new Date();
        const isToday = date === DATE_STRIP[0]?.iso;
        const cutoffHour = isToday ? now.getHours() + 1 : -1;

        return (
            <div style={{ animation:'v2FadeIn 0.3s ease' }}>
                <button onClick={()=>setStep(1)} className="v2-back-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                    Back to Services
                </button>
                <h2 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--v2-text-main)', letterSpacing:'-0.03em', margin:'0 0 2rem' }}>Choose Date & Time</h2>

                <div style={{ marginBottom:'2.5rem' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--v2-text-muted)', marginBottom:'1rem' }}>Select Date</div>
                    <div ref={dateRef} style={{ display:'flex', gap:'12px', overflowX:'auto', paddingBottom:'0.5rem' }} className="v2-hide-scrollbar">
                        {DATE_STRIP.map(d => {
                            const sel = date===d.iso;
                            return (
                                <button key={d.iso} onClick={()=>{setDate(d.iso);setTime('');setBookedTimes([]);}} className={`v2-date-btn ${sel?'v2-date-sel':''}`}>
                                    <span className="v2-date-day">{d.day}</span>
                                    <span className="v2-date-num">{d.num}</span>
                                    <span className="v2-date-month">{d.month}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {!date ? (
                    <div style={{ padding:'3rem 0', textAlign:'center', background:'var(--v2-bg-main)', borderRadius:'12px', border:'1px dashed var(--v2-border)' }}>
                        <p style={{ color:'var(--v2-text-muted)', fontSize:'0.9rem', fontWeight:500 }}>Select a date to view available slots</p>
                    </div>
                ) : loadingSlots ? (
                    <div style={{ padding:'3rem 0', textAlign:'center' }}>
                        <div className="v2-spinner" style={{ margin:'0 auto 1rem' }}/>
                        <p style={{ color:'var(--v2-text-muted)', fontSize:'0.9rem' }}>Loading availability...</p>
                    </div>
                ) : (
                    <div style={{ background:'var(--v2-bg-main)', padding:'1.5rem', borderRadius:'12px', border:'1px solid var(--v2-border)' }}>
                        {BANDS.map(band => {
                            const bandSlots = ALL_SLOTS.filter(s=>band.hours.includes(s.hour));
                            const slotsWithState = bandSlots.map(slot => ({
                                ...slot,
                                isPast: isToday && slot.hour <= cutoffHour,
                                booked: bookedTimes.includes(slot.time),
                            }));
                            if (!bandSlots.length) return null;
                            return (
                                <div key={band.label} style={{ marginBottom:'1.5rem' }}>
                                    <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--v2-text-muted)', marginBottom:'0.85rem' }}>{band.label}</div>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
                                        {slotsWithState.map(slot => {
                                            const sel = time===slot.time;
                                            const disabled = slot.booked || slot.isPast;
                                            return (
                                                <button key={slot.time} onClick={()=>!disabled&&setTime(slot.time)} disabled={disabled}
                                                    className={`v2-time-btn ${sel?'v2-time-sel':''} ${disabled?'v2-time-off':''}`}
                                                >{slot.label}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {isDesktop && (
                            <div style={{ marginTop:'2rem', display:'flex', justifyContent:'center' }}>
                                <button onClick={()=>goToStep(3)} disabled={!date||!time} className="v2-btn-primary">
                                    Continue to Details
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ─── STEP 3: CONFIRM ─────────────────────────────────────────────────────
    const renderConfirmStep = () => (
        <div style={{ animation:'v2FadeIn 0.3s ease' }}>
            <button onClick={()=>setStep(2)} className="v2-back-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                Back to Time
            </button>
            <h2 style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--v2-text-main)', letterSpacing:'-0.03em', margin:'0 0 0.5rem' }}>Almost there!</h2>
            <p style={{ color:'var(--v2-text-muted)', fontSize:'0.9rem', margin:'0 0 2.5rem' }}>Enter your details to confirm the booking.</p>

            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
                <div>
                    <label className="v2-input-label">Full Name *</label>
                    <input type="text" value={customer.name}
                        onChange={e=>setCustomer({...customer,name:e.target.value.replace(/[^a-zA-Z\s]/g,'')})}
                        placeholder="John Doe" className="v2-input"/>
                </div>
                <div>
                    <label className="v2-input-label">Mobile Number *</label>
                    <div style={{ display:'flex', position:'relative' }}>
                        <span style={{ position:'absolute', left:'1rem', top:'50%', transform:'translateY(-50%)', color:'var(--v2-text-muted)', fontWeight:600 }}>+91</span>
                        <input type="tel" value={customer.phone}
                            onChange={e=>setCustomer({...customer,phone:e.target.value.replace(/\D/g,'').slice(0,10)})}
                            placeholder="9876543210" className="v2-input"
                            style={{ paddingLeft:'3rem', borderColor: customer.phone&&customer.phone.length<10?'#ef4444':undefined }}/>
                    </div>
                    {customer.phone&&customer.phone.length<10&&<p style={{ fontSize:'0.75rem', color:'#ef4444', margin:'0.4rem 0 0', fontWeight:500 }}>Enter a valid 10-digit number</p>}
                </div>
                <div>
                    <label className="v2-input-label">Special Notes (Optional)</label>
                    <textarea value={customer.notes} onChange={e=>setCustomer({...customer,notes:e.target.value})}
                        placeholder="Any preferences or requests?" rows={3} className="v2-input" style={{ resize:'vertical' }}/>
                </div>
            </div>

            {isDesktop && (
                <div style={{ marginTop:'2.5rem', display:'flex', justifyContent:'center' }}>
                    <button onClick={confirm} disabled={!customer.name||customer.phone.length!==10||submitting} className="v2-btn-primary">
                        {submitting ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                </div>
            )}
        </div>
    );

    // ─── STEP 4: SUCCESS ─────────────────────────────────────────────────────
    const renderSuccess = () => (
        <div style={{ animation:'v2FadeIn 0.4s ease', paddingTop:'3rem', textAlign:'center' }}>
            <div style={{ width:80, height:80, background:'rgba(16, 185, 129, 0.1)', color:'#10b981', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 style={{ fontSize:'1.8rem', fontWeight:800, color:'var(--v2-text-main)', letterSpacing:'-0.03em', marginBottom:'0.75rem' }}>Booking Request Sent!</h2>
            <p style={{ color:'var(--v2-text-muted)', fontSize:'1rem', lineHeight:1.6, marginBottom:'0.5rem', maxWidth:'400px', margin:'0 auto 0.5rem' }}>
                Thank you, <strong>{customer.name}</strong>.<br/>
                Your request for <strong>{date && new Date(date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</strong> at <strong>{time && new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</strong> has been received.
            </p>
            <p style={{ color:'var(--v2-text-muted)', fontSize:'0.85rem', marginBottom:'2.5rem' }}>We'll send you a WhatsApp confirmation shortly.</p>
            <button onClick={()=>window.location.reload()} className="v2-btn-secondary">Book Another</button>
        </div>
    );

    // ─── MOBILE BOTTOM BAR ───────────────────────────────────────────────────
    const renderMobileBottomBar = () => {
        if (step === 4) return null;
        const hasItems = cart.length > 0;
        let btnLabel = 'Continue';
        let btnDisabled = true;
        let btnAction = () => {};

        if (step === 1) { btnLabel = hasItems ? `Continue · ${cart.length} item${cart.length>1?'s':''}` : 'Select services'; btnDisabled = !hasItems; btnAction = () => goToStep(2); }
        if (step === 2) { btnLabel = 'Review & Confirm'; btnDisabled = !date||!time; btnAction = () => goToStep(3); }
        if (step === 3) { btnLabel = submitting ? 'Confirming...' : 'Confirm Booking'; btnDisabled = !customer.name||customer.phone.length!==10||submitting; btnAction = confirm; }

        return (
            <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, background:'var(--v2-bg-card)', borderTop:'1px solid var(--v2-border)', paddingBottom:'env(safe-area-inset-bottom)' }}>
                {hasItems && step !== 3 && (
                    <div onClick={() => setMobileOrderOpen(!mobileOrderOpen)} style={{ padding:'0.75rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', borderBottom:'1px solid var(--v2-border)', background:'var(--v2-bg-main)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                            <span style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--v2-text-main)' }}>Your order</span>
                            <span style={{ background:'var(--v2-primary)', color:'#fff', padding:'2px 6px', borderRadius:'10px', fontSize:'0.7rem', fontWeight:700 }}>{cart.length}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                            <span style={{ fontSize:'0.9rem', fontWeight:800, color:'var(--v2-primary)' }}>{totalPrice > 0 ? `₹${totalPrice}` : 'TBD'}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-text-muted)" strokeWidth="2" style={{ transform: mobileOrderOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                    </div>
                )}
                <div style={{ padding:'0.75rem 1.25rem' }}>
                    <button onClick={btnAction} disabled={btnDisabled} className="v2-btn-primary" style={{ width:'100%', padding:'0.9rem 1.5rem', fontSize:'0.95rem' }}>
                        {btnLabel}
                    </button>
                </div>
            </div>
        );
    };

    // ─── MAIN LAYOUT ─────────────────────────────────────────────────────────
    return (
        <div className="v2-booking-root">
            <header className="v2-booking-header">
                <div className="v2-booking-header-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <div className="v2-logo" style={{ lineHeight: 1.1 }}>HASHTAG SALON</div>
                    <span style={{ fontSize: '0.62rem', color: 'var(--v2-text-muted)', fontWeight: 600, marginTop: '2px', letterSpacing: '0.04em', lineHeight: 1 }}>
                        powered by <a href="https://www.yoursxyn.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-primary)', textDecoration: 'none', fontWeight: 700 }}>XYN</a>
                    </span>
                </div>
            </header>

            <div className="v2-booking-main">
                <div className="v2-booking-content">
                    {renderBreadcrumb()}
                    {step===1 && renderServiceStep()}
                    {step===2 && renderDateTimeStep()}
                    {step===3 && renderConfirmStep()}
                    {step===4 && renderSuccess()}
                </div>

                {isDesktop && (
                    <aside className="v2-booking-sidebar">
                        {renderOrderPanel()}
                    </aside>
                )}
            </div>

            {!isDesktop && renderMobileBottomBar()}

            {!isDesktop && mobileOrderOpen && (
                <div className="v2-mobile-sheet-overlay" onClick={() => setMobileOrderOpen(false)}>
                    <div className="v2-mobile-sheet" onClick={e => e.stopPropagation()}>
                        <div style={{ padding:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--v2-border)' }}>
                            <h3 style={{ margin:0, fontSize:'1.1rem', fontWeight:700 }}>Your Order</h3>
                            <button onClick={()=>setMobileOrderOpen(false)} style={{ background:'none', border:'none', color:'var(--v2-text-muted)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                        {renderOrderPanel()}
                    </div>
                </div>
            )}

            <footer className="v2-booking-footer">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span>HASHTAG SALON – BOOKING V2</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--v2-text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'none' }}>
                        powered by <a href="https://www.yoursxyn.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-primary)', textDecoration: 'none', fontWeight: 700 }}>XYN</a>
                    </span>
                </div>
            </footer>

            <style>{`
                .v2-booking-root {
                    min-height: 100vh;
                    background: #f9fafb;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    color: #111827;
                    display: flex;
                    flex-direction: column;
                    --v2-primary: #0d9488;
                    --v2-primary-hover: #0f766e;
                    --v2-primary-muted: rgba(13, 148, 136, 0.1);
                    --v2-bg-main: #f9fafb;
                    --v2-bg-card: #ffffff;
                    --v2-border: #e5e7eb;
                    --v2-text-main: #111827;
                    --v2-text-muted: #6b7280;
                }

                .v2-booking-header { background: #ffffff; position: sticky; top: 0; z-index: 300; border-bottom: 1px solid var(--v2-border); }
                .v2-booking-header-inner { max-width: 1200px; margin: 0 auto; padding: 0 2rem; height: 64px; display: flex; align-items: center; }
                .v2-logo { font-weight: 900; font-size: 1.25rem; letter-spacing: -0.04em; color: var(--v2-text-main); }

                .v2-booking-main { max-width: 1200px; width: 100%; margin: 0 auto; padding: 3rem 2rem 8rem; display: flex; gap: 4rem; align-items: flex-start; flex: 1; box-sizing: border-box; }
                .v2-booking-content { flex: 1; min-width: 0; }
                .v2-booking-sidebar { flex: 0 0 360px; position: sticky; top: 96px; }

                /* Order panel */
                .v2-order-panel { background: var(--v2-bg-card); border: 1px solid var(--v2-border); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }

                /* Service Cards */
                .v2-svc-card {
                    background: var(--v2-bg-card); border: 2px solid var(--v2-border); border-radius: 12px; cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column;
                    position: relative; overflow: hidden; min-height: 140px;
                }
                .v2-svc-card:hover { border-color: var(--v2-primary-muted); transform: translateY(-2px); box-shadow: 0 8px 16px -4px rgba(13,148,136,0.1); }
                .v2-svc-selected { border-color: var(--v2-primary); background: #f0fdfa; }
                .v2-svc-name { font-weight: 700; font-size: 0.95rem; color: var(--v2-text-main); line-height: 1.3; margin-bottom: 0.4rem; }
                .v2-svc-duration { font-size: 0.8rem; color: var(--v2-text-muted); font-weight: 500; }
                .v2-svc-price { display: inline-block; padding: 0.4rem 0.8rem; background: var(--v2-bg-main); color: var(--v2-text-main); font-size: 0.85rem; font-weight: 800; border-radius: 8px; }
                .v2-svc-selected .v2-svc-price { background: var(--v2-primary); color: #fff; }
                .v2-svc-check { position: absolute; top: 0.75rem; right: 0.75rem; width: 24px; height: 24px; background: var(--v2-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; }

                /* Buttons & Links */
                .v2-btn-primary {
                    background: var(--v2-primary); color: #fff; border: none; border-radius: 8px;
                    padding: 0.85rem 2rem; font-weight: 700; font-size: 0.95rem;
                    cursor: pointer; transition: all 0.2s;
                }
                .v2-btn-primary:hover:not(:disabled) { background: var(--v2-primary-hover); transform: translateY(-1px); }
                .v2-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                
                .v2-btn-secondary {
                    background: #fff; color: var(--v2-text-main); border: 2px solid var(--v2-border); border-radius: 8px;
                    padding: 0.85rem 2rem; font-weight: 700; font-size: 0.95rem;
                    cursor: pointer; transition: all 0.2s;
                }
                .v2-btn-secondary:hover { border-color: var(--v2-text-main); }

                .v2-back-link {
                    background: none; border: none; color: var(--v2-text-muted); font-weight: 600; font-size: 0.85rem;
                    padding: 0; margin-bottom: 1.5rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;
                    transition: color 0.2s;
                }
                .v2-back-link:hover { color: var(--v2-primary); }

                /* Inputs */
                .v2-input-label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--v2-text-main); margin-bottom: 0.4rem; }
                .v2-input {
                    width: 100%; padding: 0.85rem 1rem; background: var(--v2-bg-card); border: 2px solid var(--v2-border);
                    border-radius: 8px; outline: none; font-size: 0.95rem; font-family: inherit; box-sizing: border-box;
                    transition: all 0.2s; color: var(--v2-text-main); font-weight: 500;
                }
                .v2-input::placeholder { color: #9ca3af; font-weight: 400; }
                .v2-input:focus { border-color: var(--v2-primary); box-shadow: 0 0 0 4px var(--v2-primary-muted); }

                /* Date & Time slots */
                .v2-date-btn {
                    flex-shrink: 0; width: 68px; padding: 0.85rem 0; background: var(--v2-bg-card);
                    border: 2px solid var(--v2-border); border-radius: 12px; cursor: pointer;
                    display: flex; flex-direction: column; align-items: center; gap: 4px;
                    transition: all 0.2s;
                }
                .v2-date-btn:hover { border-color: var(--v2-primary-muted); }
                .v2-date-sel { background: var(--v2-primary) !important; border-color: var(--v2-primary) !important; }
                .v2-date-day { font-size: 0.65rem; font-weight: 700; color: var(--v2-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
                .v2-date-num { font-size: 1.4rem; font-weight: 800; color: var(--v2-text-main); line-height: 1; }
                .v2-date-month { font-size: 0.65rem; font-weight: 600; color: var(--v2-text-muted); text-transform: uppercase; }
                .v2-date-sel .v2-date-day, .v2-date-sel .v2-date-month { color: rgba(255,255,255,0.8); }
                .v2-date-sel .v2-date-num { color: #fff; }

                .v2-time-btn {
                    padding: 0.75rem 1.25rem; background: var(--v2-bg-card); border: 2px solid var(--v2-border);
                    border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 600;
                    color: var(--v2-text-main); transition: all 0.2s; flex: 1; min-width: calc(33.33% - 10px); text-align: center;
                }
                .v2-time-btn:hover:not(:disabled) { border-color: var(--v2-primary); color: var(--v2-primary); }
                .v2-time-sel { background: var(--v2-primary) !important; border-color: var(--v2-primary) !important; color: #fff !important; }
                .v2-time-off { background: var(--v2-bg-main) !important; color: #d1d5db !important; cursor: not-allowed !important; border-color: var(--v2-border) !important; }

                /* Footer */
                .v2-booking-footer { border-top: 1px solid var(--v2-border); text-align: center; padding: 2rem; font-size: 0.75rem; font-weight: 600; color: var(--v2-text-muted); letter-spacing: 0.1em; }

                /* Mobile sheet */
                .v2-mobile-sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 400; display: flex; align-items: flex-end; backdrop-filter: blur(4px); }
                .v2-mobile-sheet { background: var(--v2-bg-card); width: 100%; max-height: 80vh; overflow-y: auto; border-radius: 24px 24px 0 0; animation: v2SlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

                /* Animations */
                @keyframes v2FadeIn { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
                @keyframes v2SlideUp { from{transform:translateY(100%);}to{transform:translateY(0);} }
                @keyframes v2Spin { to{transform:rotate(360deg);} }
                .v2-spinner { width: 28px; height: 28px; border: 3px solid var(--v2-border); border-top-color: var(--v2-primary); border-radius: 50%; animation: v2Spin 0.8s linear infinite; }

                .v2-hide-scrollbar::-webkit-scrollbar { display: none; }
                .v2-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                /* Responsive */
                @media (max-width: 767px) {
                    .v2-booking-main { padding: 1.5rem 1.25rem 9rem; gap: 0; }
                    .v2-booking-header-inner { padding: 0 1.25rem; }
                    .v2-booking-footer { display: none; }
                    .v2-time-btn { min-width: calc(50% - 5px); }
                }
            `}</style>
        </div>
    );
}
