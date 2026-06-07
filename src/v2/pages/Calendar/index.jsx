import Layout from '../../components/Layout';
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../../context/DataProvider';
import { collection, query, where, orderBy, onSnapshot, Timestamp, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import NewAppointmentModal from './NewAppointmentModal';
import { triggerAppointmentNotification } from '../../../services/notifications';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8AM–8PM
const COLORS = ['#0d9488','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#ef4444','#10b981','#6366f1'];
const STATUS_STYLE = {
    scheduled:  { bg:'#dbeafe', color:'#1e40af' },
    completed:  { bg:'#dcfce7', color:'#166534' },
    no_show:    { bg:'#fee2e2', color:'#991b1b' },
    pending:    { bg:'#fef9c3', color:'#854d0e' }, // Yellow for pending
};

// Priority order for calendar columns
const CALENDAR_ORDER = ['gowtham','shivin','chandru','santhose','sandy','suresh','raghul','uvanciya'];

function toLocalDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hourLabel(h) { return h===12?'12 PM':h>12?`${h-12} PM`:`${h} AM`; }

const fmt = v => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v||0);

export default function V2Calendar() {
    const { stylists: allStylists } = useData();
    const stylists = useMemo(() => (allStylists || []).filter(s => s.isActive !== false && s.status !== 'inactive'), [allStylists]);
    const [view, setView]               = useState('day');
    const [current, setCurrent]         = useState(new Date());
    const [appts, setAppts]             = useState([]);
    const [blocks, setBlocks]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [detail, setDetail]           = useState(null);
    const [showNewAppt, setShowNewAppt] = useState(false);
    const [newApptCtx, setNewApptCtx]   = useState({ date:'', stylistId:'' });
    // Block time form
    const [showBlock, setShowBlock]     = useState(false);
    const [blockForm, setBlockForm]     = useState({ stylistId:'', date:'', startHour:10, endHour:11, reason:'' });
    const [savingBlock, setSavingBlock] = useState(false);

    // Pending Bookings
    const [pendingAppts, setPendingAppts] = useState([]);

    const [attendanceModalStylist, setAttendanceModalStylist] = useState(null);
    const [stylistTodayLogs, setStylistTodayLogs] = useState([]);
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [attendancePhotoFile, setAttendancePhotoFile] = useState(null);
    const [checkoutAppt, setCheckoutAppt] = useState(null); // for Modify & Checkout flow

    // Fetch logs for the selected stylist to prevent multiple clock-ins and handle auto-clock-outs
    useEffect(() => {
        if (!attendanceModalStylist) {
            setStylistTodayLogs([]);
            return;
        }
        const q = query(collection(db, 'attendance_logs'), where('stylistId', '==', attendanceModalStylist.id));
        const unsub = onSnapshot(q, snap => {
            const now = new Date();
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            
            const allLogs = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

            // Auto clock-out check
            if (allLogs.length > 0 && allLogs[0].type === 'clock_in') {
                const lastLogDate = allLogs[0].timestamp?.toDate?.();
                if (lastLogDate) {
                    const shiftEnd = new Date(lastLogDate);
                    shiftEnd.setHours(18, 0, 0, 0); // Assume 18:00 is standard shift end
                    
                    let shouldAutoClockOut = false;
                    let clockOutTime = shiftEnd;

                    if (lastLogDate < startOfToday) {
                        // Previous day missing clock out
                        shouldAutoClockOut = true;
                        if (lastLogDate > shiftEnd) {
                            // If they clocked in after 18:00 yesterday, clock out 1 hour later
                            clockOutTime = new Date(lastLogDate.getTime() + 60 * 60 * 1000); 
                        }
                    } else if (now > shiftEnd && lastLogDate < shiftEnd) {
                        // Today, currently past shift end, and they clocked in before shift end
                        shouldAutoClockOut = true;
                    }

                    if (shouldAutoClockOut) {
                        addDoc(collection(db, 'attendance_logs'), {
                            stylistId: attendanceModalStylist.id,
                            stylistName: attendanceModalStylist.name,
                            type: 'clock_out',
                            timestamp: Timestamp.fromDate(clockOutTime),
                            autoClockedOut: true
                        }).catch(err => console.error("Auto clock-out failed", err));
                        // The snapshot will re-trigger with the new clock_out, so we don't need to do anything else.
                    }
                }
            }

            const todayLogs = allLogs.filter(l => l.timestamp?.toDate?.() >= startOfToday);
            setStylistTodayLogs(todayLogs);
        });
        return () => unsub();
    }, [attendanceModalStylist]);

    const hasClockedInToday = stylistTodayLogs.some(l => l.type === 'clock_in');
    const isCurrentlyClockedIn = hasClockedInToday && !stylistTodayLogs.some(l => l.type === 'clock_out');

    useEffect(() => {
        const qP = query(collection(db, 'appointments'), where('status', '==', 'pending'));
        const unsub = onSnapshot(qP, snap => {
            setPendingAppts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.timestamp?.toMillis?.()||0) - (b.timestamp?.toMillis?.()||0)));
        });
        return () => unsub();
    }, []);

    const handleApprove = async (id) => {
        if (!window.confirm("Approve this online booking?")) return;
        await updateDoc(doc(db, 'appointments', id), { status: 'scheduled' });
        
        const appt = pendingAppts.find(a => a.id === id);
        if (appt) {
            await triggerAppointmentNotification(appt);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm("Reject and cancel this booking?")) return;
        await updateDoc(doc(db, 'appointments', id), { status: 'cancelled' });

        const appt = pendingAppts.find(a => a.id === id);
        if (appt && appt.clientPhone) {
            const dateStr = appt.timestamp?.toDate?.()?.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = appt.timestamp?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const msg = `Hi ${appt.clientName}, we regret to inform you that your booking request for ${dateStr} at ${timeStr} has been declined. Please select another slot at our website or contact us directly.`;
            window.open(`https://wa.me/91${appt.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    };

    const handleMoveAppointment = async (apptId, targetStylistId, targetHour) => {
        try {
            const targetStylist = stylists.find(s => s.id === targetStylistId);
            const targetStylistName = targetStylist ? targetStylist.name : 'Unassigned / Online';
            
            const newDate = new Date(current);
            newDate.setHours(targetHour, 0, 0, 0);
            
            await updateDoc(doc(db, 'appointments', apptId), {
                stylistId: targetStylistId,
                stylistName: targetStylistName,
                timestamp: Timestamp.fromDate(newDate)
            });
        } catch (error) {
            console.error('Failed to move appointment:', error);
            alert('Failed to move appointment: ' + error.message);
        }
    };

    const handleMoveAppointmentWeek = async (apptId, targetDate) => {
        try {
            const appt = appts.find(a => a.id === apptId);
            if (!appt) return;
            const originalDate = appt.timestamp?.toDate?.() || new Date();
            
            const newDate = new Date(targetDate);
            newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds(), originalDate.getMilliseconds());
            
            await updateDoc(doc(db, 'appointments', apptId), {
                timestamp: Timestamp.fromDate(newDate)
            });
        } catch (error) {
            console.error('Failed to move appointment:', error);
            alert('Failed to move appointment: ' + error.message);
        }
    };

    const handleAttendance = async (type) => {
        setIsSavingAttendance(true);
        try {
            let photoUrl = null;
            if (attendancePhotoFile) {
                photoUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(attendancePhotoFile);
                });
            }

            await addDoc(collection(db, 'attendance_logs'), {
                stylistId: attendanceModalStylist?.id,
                stylistName: attendanceModalStylist?.name,
                type, // 'clock_in' or 'clock_out'
                timestamp: serverTimestamp(),
                photoUrl: photoUrl
            });
            alert(`Successfully logged ${type.replace('_', ' ')} for ${attendanceModalStylist?.name}`);
            setAttendanceModalStylist(null);
            setAttendancePhotoFile(null);
        } catch (error) {
            console.error('Error logging attendance:', error);
            alert('Failed to log attendance.');
        } finally {
            setIsSavingAttendance(false);
        }
    };

    // Fetch appointments + blocks
    useEffect(() => {
        setLoading(true);
        const start = new Date(current); start.setHours(0,0,0,0);
        const end   = new Date(current); end.setHours(23,59,59,999);
        if (view === 'week') {
            start.setDate(start.getDate() - start.getDay());
            end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
        } else if (view === 'month') {
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
        }
        const qA = query(collection(db,'appointments'), where('timestamp','>=',Timestamp.fromDate(start)), where('timestamp','<=',Timestamp.fromDate(end)), orderBy('timestamp','asc'));
        const qB = query(collection(db,'calendarBlocks'), where('date','>=',toLocalDateStr(start)), where('date','<=',toLocalDateStr(end)));
        const u1 = onSnapshot(qA, snap => { setAppts(snap.docs.map(d=>({id:d.id,...d.data()})).filter(a => (a.status || '').toLowerCase() !== 'cancelled')); setLoading(false); }, ()=>setLoading(false));
        const u2 = onSnapshot(qB, snap => setBlocks(snap.docs.map(d=>({id:d.id,...d.data()}))));
        return () => { u1(); u2(); };
    }, [current, view]);

    const navigate = dir => {
        const d = new Date(current);
        if (view === 'month') {
            d.setMonth(d.getMonth() + dir);
        } else {
            d.setDate(d.getDate() + (view==='week'?dir*7:dir));
        }
        setCurrent(d);
    };

    const byStylist = useMemo(() => {
        const map = {};
        (stylists||[]).forEach(s => { 
            if (s && s.id) {
                map[s.id]={stylist:s,appts:[],blocks:[]}; 
            }
        });
        // Unassigned bucket for online bookings or mismatched IDs
        map['__unassigned__'] = { stylist: { id:'__unassigned__', name:'Unassigned / Online' }, appts: [], blocks: [] };
        appts.forEach(a => {
            const sid = a.stylistId || a.stylistName || a.items?.[0]?.stylistId;
            if (sid && map[sid]) {
                map[sid].appts.push(a);
            } else {
                // Try name-based match for online bookings or mismatched IDs
                const nameMatch = sid && (stylists||[]).find(s => {
                    const sName = (s.name || '').trim().toLowerCase();
                    const bName = String(sid).trim().toLowerCase();
                    if (sName === bName) return true;
                    
                    const sFirst = sName.split(' ')[0];
                    const bFirst = bName.split(' ')[0];
                    const isSanthoseName = name => name.startsWith('santho') || name === 'santos';
                    if (isSanthoseName(sFirst) && isSanthoseName(bFirst)) return true;
                    
                    return sFirst && bFirst && sFirst === bFirst;
                });
                if (nameMatch && map[nameMatch.id]) {
                    map[nameMatch.id].appts.push(a);
                } else {
                    map['__unassigned__'].appts.push(a);
                }
            }
        });
        blocks.forEach(b => {
            if (b.stylistId && map[b.stylistId]) map[b.stylistId].blocks.push(b);
        });
        const allGroups = Object.values(map).filter(g => g.stylist.id !== '__unassigned__' || g.appts.length > 0);

        // Sort by CALENDAR_ORDER: priority names first, then remaining alphabetically
        allGroups.sort((a, b) => {
            let aFirst = (a.stylist.name || '').trim().split(' ')[0].toLowerCase();
            let bFirst = (b.stylist.name || '').trim().split(' ')[0].toLowerCase();
            
            // Normalize Santhose/Santhosh spelling variations to 'santhose' for CALENDAR_ORDER lookup
            if (aFirst.startsWith('santho') || aFirst === 'santos') aFirst = 'santhose';
            if (bFirst.startsWith('santho') || bFirst === 'santos') bFirst = 'santhose';

            const aIdx = CALENDAR_ORDER.indexOf(aFirst);
            const bIdx = CALENDAR_ORDER.indexOf(bFirst);
            if (aIdx === -1 && bIdx === -1) return aFirst.localeCompare(bFirst);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });

        return allGroups;
    }, [stylists, appts, blocks]);

    const weekDates = useMemo(() => {
        const s = new Date(current); s.setDate(s.getDate()-s.getDay());
        return Array.from({length:7},(_,i)=>{ const d=new Date(s); d.setDate(s.getDate()+i); return d; });
    }, [current]);

    const monthDates = useMemo(() => {
        const start = new Date(current.getFullYear(), current.getMonth(), 1);
        const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        const dates = [];
        // Fill leading days from previous month
        for (let i = start.getDay(); i > 0; i--) {
            const d = new Date(start); d.setDate(d.getDate() - i); dates.push(d);
        }
        // Current month days
        for (let i = 1; i <= end.getDate(); i++) {
            dates.push(new Date(current.getFullYear(), current.getMonth(), i));
        }
        // Fill trailing days for a full grid
        const remaining = (7 - (dates.length % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(end); d.setDate(d.getDate() + i); dates.push(d);
        }
        return dates;
    }, [current]);

    const openNewAppt = (date, stylistId='') => {
        setNewApptCtx({ date: typeof date === 'string' ? date : toLocalDateStr(date), stylistId });
        setShowNewAppt(true);
    };

    const openBlockForm = (stylistId='', date='', hour=10) => {
        setBlockForm({ stylistId, date: date || toLocalDateStr(current), startHour: hour, endHour: hour+1, reason:'' });
        setShowBlock(true);
    };

    const saveBlock = async e => {
        e.preventDefault();
        if (!blockForm.stylistId) return alert('Select a stylist.');
        setSavingBlock(true);
        try {
            await addDoc(collection(db,'calendarBlocks'), {
                stylistId:  blockForm.stylistId,
                stylistName: stylists?.find(s=>s.id===blockForm.stylistId)?.name||'',
                date:       blockForm.date,
                startHour:  Number(blockForm.startHour),
                endHour:    Number(blockForm.endHour),
                reason:     blockForm.reason || 'Blocked',
            });
            setShowBlock(false);
        } catch(err){ alert(err.message); }
        finally{ setSavingBlock(false); }
    };

    const deleteBlock = async (id) => {
        if (!window.confirm('Remove this block?')) return;
        await deleteDoc(doc(db,'calendarBlocks',id));
    };


    const headerStr = view==='day'
        ? current.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
        : view === 'week'
        ? `${weekDates[0].toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${weekDates[6].toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
        : current.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <Layout>
            {/* ── Top Bar ── */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <button onClick={()=>navigate(-1)} style={{width:'36px',height:'36px',borderRadius:'50%',border:'1px solid var(--v2-border)',background:'white',cursor:'pointer'}}>←</button>
                    <span style={{fontWeight:'700',fontSize:'1.05rem',minWidth:'240px', textAlign: 'center'}}>{headerStr}</span>
                    <button onClick={()=>navigate(1)}  style={{width:'36px',height:'36px',borderRadius:'50%',border:'1px solid var(--v2-border)',background:'white',cursor:'pointer'}}>→</button>
                    <button onClick={()=>setCurrent(new Date())} style={{padding:'0.4rem 0.9rem',borderRadius:'20px',border:'1px solid var(--v2-border)',background:'white',cursor:'pointer',fontSize:'0.8rem',fontWeight:'600'}}>Today</button>
                </div>
                <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                    <button onClick={()=>openNewAppt(current)} style={{padding:'0.5rem 1.25rem',background:'var(--v2-primary)',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:'700',fontSize:'0.85rem'}}>+ New Appointment</button>
                    <button onClick={()=>openBlockForm()} style={{padding:'0.5rem 1.25rem',background:'#f59e0b',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:'700',fontSize:'0.85rem'}}>⛔ Block Time</button>
                    {['day','week','month'].map(m=>(
                        <button key={m} onClick={()=>setView(m)} style={{padding:'0.5rem 1.1rem',borderRadius:'20px',border:'none',fontWeight:'600',cursor:'pointer',textTransform:'capitalize',background:view===m?'var(--v2-primary)':'white',color:view===m?'white':'var(--v2-text-muted)',boxShadow:'var(--v2-shadow-sm)'}}>{m}</button>
                    ))}
                </div>
            </div>

            {/* ── Stats ── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem',marginBottom:'1.5rem'}}>
                {[{
                    l:'Bookings',
                    v:appts.length
                },{
                    l:'Revenue',
                    v:fmt(appts.filter(a=>(a.status||'completed').toLowerCase()==='completed').reduce((s,a)=>s+(a.totalAmount||0),0)),
                    c:'var(--v2-primary)'
                },{
                    l:'Cash',
                    v:fmt(appts.filter(a=>(a.status||'completed').toLowerCase()==='completed' && (a.paymentType||'cash')==='cash').reduce((s,a)=>s+(a.totalAmount||0),0))
                },{
                    l:'Blocks',
                    v:blocks.length,
                    c:'#f59e0b'
                }].map((s,i)=>(
                    <div key={i} className="v2-card" style={{padding:'1rem 1.25rem'}}>
                        <div style={{fontSize:'0.65rem',color:'var(--v2-text-muted)',textTransform:'uppercase',fontWeight:'700'}}>{s.l}</div>
                        <div style={{fontSize:'1.4rem',fontWeight:'900',color:s.c||'var(--v2-text-main)'}}>{s.v}</div>
                    </div>
                ))}
            </div>

            {/* ── Pending Approvals Widget ── */}
            {pendingAppts.length > 0 && (
                <div style={{ marginBottom: '1.5rem', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--v2-shadow-md)', animation: 'pulse 2s infinite' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔔</span>
                        <h3 style={{ margin: 0, color: '#92400e', fontWeight: '900', fontSize: '1.1rem' }}>Action Required: {pendingAppts.length} Pending Online {pendingAppts.length === 1 ? 'Booking' : 'Bookings'}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {pendingAppts.map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                <div>
                                    <div style={{ fontWeight: '800', fontSize: '1rem', color: '#92400e' }}>
                                        {p.clientName} <span style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: '600' }}>({p.clientPhone})</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#713f12', marginTop: '0.25rem', fontWeight: '600' }}>
                                        {p.timestamp?.toDate?.()?.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                                        &nbsp;·&nbsp; {p.stylistName || 'Any Stylist'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#a16207', marginTop: '0.25rem' }}>
                                        Services: {(p.services || []).map(s => s.name).join(', ')} (Total: {fmt(p.totalAmount)})
                                    </div>
                                    {p.notes && <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.25rem', fontStyle: 'italic' }}>Notes: {p.notes}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => handleReject(p.id)} style={{ padding: '0.5rem 1rem', border: '1px solid #ef4444', color: '#ef4444', background: 'white', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>Reject</button>
                                    <button onClick={() => handleApprove(p.id)} style={{ padding: '0.5rem 1.25rem', border: 'none', color: 'white', background: '#10b981', borderRadius: '6px', fontWeight: '800', cursor: 'pointer' }}>Approve Booking</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <style>{`
                        @keyframes pulse {
                            0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                            70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
                            100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                        }
                    `}</style>
                </div>
            )}

            {/* ── Grid ── */}
            <div className="v2-card" style={{padding:0,overflow:'hidden'}}>
                {loading ? <div style={{padding:'4rem',textAlign:'center',color:'var(--v2-text-muted)'}}>Loading…</div>
                : view==='day' ? (
                    <div style={{overflowX:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:`72px repeat(${byStylist.length||1},minmax(180px,1fr))`,minWidth:'600px'}}>
                            {/* Header */}
                            <div style={{padding:'0.75rem',borderBottom:'2px solid var(--v2-border)',borderRight:'1px solid var(--v2-border)',background:'var(--v2-bg-main)',fontSize:'0.65rem',fontWeight:'800',color:'var(--v2-text-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}>TIME</div>
                            {byStylist.map((g,gi)=>(
                                <div key={g.stylist?.id || gi} 
                                     onClick={() => g.stylist && setAttendanceModalStylist(g.stylist)}
                                     style={{padding:'0.75rem 1rem',borderBottom:'2px solid var(--v2-border)',borderRight:'1px solid var(--v2-border)',background:'var(--v2-bg-main)',display:'flex',alignItems:'center',gap:'0.6rem',cursor:'pointer',transition:'background 0.2s'}}
                                     onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                     onMouseLeave={e => e.currentTarget.style.background = 'var(--v2-bg-main)'}>
                                    <div style={{width:'30px',height:'30px',borderRadius:'50%',background:COLORS[gi%COLORS.length],color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'800',fontSize:'0.75rem',flexShrink:0}}>{g.stylist?.name?.charAt(0) || '?'}</div>
                                    <div>
                                        <div style={{fontWeight:'700',fontSize:'0.85rem'}}>{g.stylist?.name || 'Unknown'}</div>
                                        <div style={{fontSize:'0.65rem',color:'var(--v2-text-muted)'}}>{g.appts.length} bookings · {g.blocks.length} blocks</div>
                                    </div>
                                </div>
                            ))}
                            {/* Rows */}
                            {HOURS.map(hour=>(
                                <React.Fragment key={hour}>
                                    <div style={{padding:'0 0.5rem',borderRight:'1px solid var(--v2-border)',borderBottom:'1px solid var(--v2-border)',background:'var(--v2-bg-main)',fontSize:'0.7rem',color:'var(--v2-text-muted)',fontWeight:'600',minHeight:'75px',height:'auto',display:'flex',alignItems:'center',justifyContent:'center'}}>{hourLabel(hour)}</div>
                                    {byStylist.map((g,gi)=>{
                                        const slotAppts = g.appts.filter(a=>a.timestamp?.toDate?.()?.getHours()===hour);
                                        const slotBlocks = g.blocks.filter(b=>hour>=b.startHour && hour<b.endHour);
                                        const isBlocked = slotBlocks.length > 0;
                                        return (
                                            <div key={`${g.stylist?.id || gi}-${hour}`}
                                                onClick={()=>!isBlocked && g.stylist?.id && openNewAppt(current, g.stylist.id)}
                                                onDragOver={e => {
                                                    if (!isBlocked && g.stylist?.id) {
                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect = 'move';
                                                    }
                                                }}
                                                onDragEnter={e => {
                                                    if (!isBlocked && g.stylist?.id) {
                                                        e.currentTarget.style.background = '#e2e8f0';
                                                    }
                                                }}
                                                onDragLeave={e => {
                                                    if (!isBlocked && g.stylist?.id) {
                                                        e.currentTarget.style.background = isBlocked ? '#fef3c7' : 'white';
                                                    }
                                                }}
                                                onDrop={async e => {
                                                    if (isBlocked || !g.stylist?.id) return;
                                                    e.preventDefault();
                                                    e.currentTarget.style.background = 'white';
                                                    const apptId = e.dataTransfer.getData('text/plain');
                                                    if (!apptId) return;
                                                    await handleMoveAppointment(apptId, g.stylist.id, hour);
                                                }}
                                                style={{padding:'6px',borderRight:'1px solid var(--v2-border)',borderBottom:'1px solid var(--v2-border)',minHeight:'75px',height:'auto',cursor:isBlocked?'default':'pointer',background:isBlocked?'#fef3c7':'white',position:'relative',display:'flex',flexDirection:'column',gap:'4px'}}>
                                                {isBlocked && slotBlocks.map(bl=>(
                                                    <div key={bl.id} style={{padding:'4px 6px',background:'#fef3c7',borderLeft:'3px solid #f59e0b',borderRadius:'4px',fontSize:'0.7rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                                        <span style={{fontWeight:'700',color:'#92400e'}}>⛔ {bl.reason}</span>
                                                        <button onClick={e=>{e.stopPropagation();deleteBlock(bl.id);}} style={{border:'none',background:'transparent',cursor:'pointer',color:'#dc2626',fontSize:'0.8rem',padding:'0 2px'}} title="Remove block">✕</button>
                                                    </div>
                                                ))}
                                                {slotAppts.map(a=>{
                                                    const st=(a.status||'completed').toLowerCase();
                                                    const sc=STATUS_STYLE[st]||STATUS_STYLE.completed;
                                                    return (
                                                        <div key={a.id} 
                                                            onClick={e=>{e.stopPropagation();setDetail(a);}}
                                                            draggable={st !== 'completed' && st !== 'cancelled' && st !== 'no_show'}
                                                            onDragStart={e => {
                                                                e.dataTransfer.setData('text/plain', a.id);
                                                                e.dataTransfer.effectAllowed = 'move';
                                                                e.currentTarget.style.opacity = '0.5';
                                                            }}
                                                            onDragEnd={e => {
                                                                e.currentTarget.style.opacity = '1';
                                                            }}
                                                            style={{padding:'5px 8px',borderRadius:'6px',background:sc.bg,borderLeft:`3px solid ${sc.color}`,cursor:'pointer',fontSize:'0.72rem',position:'relative',zIndex:2,boxShadow:'var(--v2-shadow-sm)',transition:'0.2s',marginBottom:'2px'}}>
                                                            <div style={{fontWeight:'800',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:sc.color}}>{a.clientName||'Walk-in'}</div>
                                                            {(a.clientPhone||a.phone) && <div style={{color:sc.color,opacity:0.75,fontSize:'0.62rem',marginTop:'1px',fontWeight:'600'}}>{a.clientPhone||a.phone}</div>}
                                                            <div style={{color:sc.color,opacity:0.7,fontSize:'0.62rem',marginTop:'2px'}}>{(a.services||a.items||[]).map(s=>s.name).join(', ')}</div>
                                                            <div style={{marginTop:'3px',display:'inline-block',background:sc.color,color:'#fff',fontSize:'0.55rem',fontWeight:'800',padding:'1px 5px',borderRadius:'2px',textTransform:'uppercase',letterSpacing:'0.04em'}}>{st.replace('_',' ')}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ) : view === 'week' ? (
                    /* WEEK VIEW */
                    <div style={{overflowX:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(140px,1fr))',minWidth:'800px'}}>
                            {weekDates.map((date,i)=>{
                                const isToday=date.toDateString()===new Date().toDateString();
                                return (
                                    <div key={i} onClick={() => { setCurrent(date); setView('day'); }} style={{padding:'0.75rem',borderBottom:'2px solid var(--v2-border)',borderRight:'1px solid var(--v2-border)',background:isToday?'var(--v2-primary)':'var(--v2-bg-main)',textAlign:'center',cursor:'pointer'}}>
                                        <div style={{fontSize:'0.65rem',fontWeight:'700',color:isToday?'rgba(255,255,255,0.7)':'var(--v2-text-muted)',textTransform:'uppercase'}}>{'SunMonTueWedThuFriSat'.match(/.{3}/g)[date.getDay()]}</div>
                                        <div style={{fontSize:'1.25rem',fontWeight:'900',color:isToday?'white':'var(--v2-text-main)'}}>{date.getDate()}</div>
                                    </div>
                                );
                            })}
                            {weekDates.map((date,i)=>{
                                const ds = toLocalDateStr(date);
                                const dayAppts = appts.filter(a=>{const d=a.timestamp?.toDate?.();return d&&d.toDateString()===date.toDateString();});
                                const dayBlocks = blocks.filter(b=>b.date===ds);
                                const isToday = date.toDateString()===new Date().toDateString();
                                return (
                                    <div key={`b-${i}`} 
                                        onDragOver={e => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                        }}
                                        onDragEnter={e => {
                                            e.currentTarget.style.background = '#e2e8f0';
                                        }}
                                        onDragLeave={e => {
                                            e.currentTarget.style.background = isToday ? '#f0fdfa' : 'white';
                                        }}
                                        onDrop={async e => {
                                            e.preventDefault();
                                            e.currentTarget.style.background = isToday ? '#f0fdfa' : 'white';
                                            const apptId = e.dataTransfer.getData('text/plain');
                                            if (!apptId) return;
                                            await handleMoveAppointmentWeek(apptId, date);
                                        }}
                                        style={{padding:'0.75rem',borderRight:'1px solid var(--v2-border)',minHeight:'350px',background:isToday?'#f0fdfa':'white',position:'relative',display:'flex',flexDirection:'column'}}>
                                        {/* Book Slot Link */}
                                        <div onClick={()=>openNewAppt(date)} style={{fontSize:'0.7rem',color:'var(--v2-text-muted)',textAlign:'center',padding:'0.35rem',border:'1px dashed var(--v2-border)',borderRadius:'6px',marginBottom:'0.75rem',cursor:'pointer',background:'rgba(0,0,0,0.02)',fontWeight:'700'}}>
                                            + Book Slot
                                        </div>
                                        
                                        <div style={{flex:1, overflowY:'auto', maxHeight:'280px', display:'flex', flexDirection:'column', gap:'6px', paddingRight:'2px'}}>
                                            {dayBlocks.map(bl=>(
                                                <div key={bl.id} onClick={e=>e.stopPropagation()} style={{padding:'4px 8px',background:'#fef3c7',borderLeft:'3px solid #f59e0b',borderRadius:'4px',fontSize:'0.72rem',display:'flex',justifyContent:'space-between'}}>
                                                    <span style={{fontWeight:'700',color:'#92400e'}}>⛔ {bl.reason} ({hourLabel(bl.startHour)}–{hourLabel(bl.endHour)})</span>
                                                    <button onClick={()=>deleteBlock(bl.id)} style={{border:'none',background:'transparent',cursor:'pointer',color:'#dc2626',fontSize:'0.75rem'}}>✕</button>
                                                </div>
                                            ))}
                                            {dayAppts.length===0&&dayBlocks.length===0&&<div style={{color:'var(--v2-text-muted)',fontSize:'0.72rem',textAlign:'center',paddingTop:'1.5rem',opacity:0.5}}>No bookings</div>}
                                            {dayAppts.map(a=>{
                                                const st=(a.status||'completed').toLowerCase();
                                                const sc=STATUS_STYLE[st]||STATUS_STYLE.completed;
                                                return (
                                                    <div key={a.id} 
                                                        onClick={e=>{e.stopPropagation();setDetail(a);}}
                                                        draggable={st !== 'completed' && st !== 'cancelled' && st !== 'no_show'}
                                                        onDragStart={e => {
                                                            e.dataTransfer.setData('text/plain', a.id);
                                                            e.dataTransfer.effectAllowed = 'move';
                                                            e.currentTarget.style.opacity = '0.5';
                                                        }}
                                                        onDragEnd={e => {
                                                            e.currentTarget.style.opacity = '1';
                                                        }}
                                                        style={{padding:'6px 8px',borderRadius:'6px',background:sc.bg,border:`1px solid ${sc.color}40`,cursor:'pointer',boxShadow:'var(--v2-shadow-sm)',zIndex:2,position:'relative'}}>
                                                        <div style={{fontWeight:'800',fontSize:'0.78rem',color:sc.color}}>{a.clientName||'Walk-in'}</div>
                                                        {(a.clientPhone||a.phone) && <div style={{fontSize:'0.66rem',color:sc.color,opacity:0.8,marginTop:'1px',fontWeight:'600'}}>{a.clientPhone||a.phone}</div>}
                                                        <div style={{fontSize:'0.68rem',color:sc.color,opacity:0.7,margin:'2px 0'}}>{a.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · {a.stylistName||'—'}</div>
                                                        <span style={{fontSize:'0.6rem',fontWeight:'800',padding:'1px 5px',borderRadius:'2px',background:sc.color,color:'#fff',textTransform:'uppercase',display:'inline-block',marginTop:'2px'}}>{st.replace('_',' ')}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* MONTH VIEW */
                    <div style={{overflowX:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(7, 1fr)',minWidth:'800px'}}>
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
                                <div key={d} style={{padding:'0.75rem',background:'var(--v2-bg-main)',borderBottom:'1px solid var(--v2-border)',borderRight:'1px solid var(--v2-border)',textAlign:'center',fontSize:'0.65rem',fontWeight:'800',color:'var(--v2-text-muted)',textTransform:'uppercase'}}>{d}</div>
                            ))}
                            {monthDates.map((date,i)=>{
                                const ds = toLocalDateStr(date);
                                const dayAppts = appts.filter(a=>{const d=a.timestamp?.toDate?.();return d&&d.toDateString()===date.toDateString();});
                                const dayBlocks = blocks.filter(b=>b.date===ds);
                                const isToday = date.toDateString()===new Date().toDateString();
                                const isCurrentMonth = date.getMonth() === current.getMonth();
                                return (
                                    <div key={i} onClick={() => { setCurrent(date); setView('day'); }}
                                        style={{padding:'0.5rem',borderRight:'1px solid var(--v2-border)',borderBottom:'1px solid var(--v2-border)',minHeight:'110px',background:isToday?'#f0fdfa':(isCurrentMonth?'white':'#f9fafb'),cursor:'pointer',opacity:isCurrentMonth?1:0.5}}>
                                        <div style={{fontSize:'0.85rem',fontWeight:isToday?'900':'700',color:isToday?'var(--v2-primary)':'var(--v2-text-main)',marginBottom:'0.5rem'}}>{date.getDate()}</div>
                                        <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                                            {dayBlocks.map(bl=>(
                                                <div key={bl.id} style={{fontSize:'0.6rem',background:'#fef3c7',color:'#92400e',padding:'2px 4px',borderRadius:'2px',fontWeight:'700'}}>⛔ {bl.reason}</div>
                                            ))}
                                            {dayAppts.slice(0, 3).map(a=>(
                                                <div key={a.id} style={{fontSize:'0.6rem',background:'var(--v2-bg-main)',color:'var(--v2-text-main)',padding:'2px 4px',borderRadius:'2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',border:'1px solid var(--v2-border)'}}>
                                                    {a.timestamp?.toDate?.()?.getHours()}:{String(a.timestamp?.toDate?.()?.getMinutes()).padStart(2,'0')} {a.clientName||'Walk-in'}
                                                </div>
                                            ))}
                                            {dayAppts.length > 3 && <div style={{fontSize:'0.6rem',color:'var(--v2-text-muted)',textAlign:'center'}}>+{dayAppts.length - 3} more</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Block Time Modal ── */}
            {showBlock && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setShowBlock(false)}>
                    <form onSubmit={saveBlock} className="v2-card" style={{maxWidth:'400px',width:'100%'}} onClick={e=>e.stopPropagation()}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
                            <h2 style={{margin:0,fontSize:'1.1rem'}}>⛔ Block Time Slot</h2>
                            <button type="button" onClick={()=>setShowBlock(false)} style={{border:'none',background:'transparent',fontSize:'1.4rem',cursor:'pointer'}}>×</button>
                        </div>
                        <div style={{display:'grid',gap:'1rem'}}>
                            <div>
                                <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',marginBottom:'4px',color:'#6b7280',textTransform:'uppercase'}}>Stylist *</label>
                                <select required value={blockForm.stylistId} onChange={e=>setBlockForm({...blockForm,stylistId:e.target.value})} style={{width:'100%',padding:'0.6rem',border:'1px solid var(--v2-border)',borderRadius:'6px',outline:'none'}}>
                                    <option value="">Select Stylist</option>
                                    {(stylists||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',marginBottom:'4px',color:'#6b7280',textTransform:'uppercase'}}>Date *</label>
                                <input type="date" required value={blockForm.date} onChange={e=>setBlockForm({...blockForm,date:e.target.value})} style={{width:'100%',padding:'0.6rem',border:'1px solid var(--v2-border)',borderRadius:'6px',outline:'none'}}/>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
                                <div>
                                    <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',marginBottom:'4px',color:'#6b7280',textTransform:'uppercase'}}>From Hour</label>
                                    <select value={blockForm.startHour} onChange={e=>setBlockForm({...blockForm,startHour:Number(e.target.value)})} style={{width:'100%',padding:'0.6rem',border:'1px solid var(--v2-border)',borderRadius:'6px',outline:'none'}}>
                                        {HOURS.map(h=><option key={h} value={h}>{hourLabel(h)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',marginBottom:'4px',color:'#6b7280',textTransform:'uppercase'}}>To Hour</label>
                                    <select value={blockForm.endHour} onChange={e=>setBlockForm({...blockForm,endHour:Number(e.target.value)})} style={{width:'100%',padding:'0.6rem',border:'1px solid var(--v2-border)',borderRadius:'6px',outline:'none'}}>
                                        {HOURS.filter(h=>h>blockForm.startHour).map(h=><option key={h} value={h}>{hourLabel(h)}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{display:'block',fontSize:'0.72rem',fontWeight:'700',marginBottom:'4px',color:'#6b7280',textTransform:'uppercase'}}>Reason</label>
                                <input type="text" value={blockForm.reason} onChange={e=>setBlockForm({...blockForm,reason:e.target.value})} placeholder="e.g. Lunch break, Personal leave…" style={{width:'100%',padding:'0.6rem',border:'1px solid var(--v2-border)',borderRadius:'6px',outline:'none'}}/>
                            </div>
                        </div>
                        <div style={{display:'flex',gap:'0.75rem',marginTop:'1.5rem'}}>
                            <button type="button" onClick={()=>setShowBlock(false)} style={{flex:1,padding:'0.65rem',border:'1px solid var(--v2-border)',background:'white',borderRadius:'6px',cursor:'pointer',fontWeight:'600'}}>Cancel</button>
                            <button type="submit" disabled={savingBlock} style={{flex:1,padding:'0.65rem',background:'#f59e0b',color:'white',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:'800'}}>{savingBlock?'Saving…':'Block Slot'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Detail Modal ── */}
            {detail && (
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}} onClick={()=>setDetail(null)}>
                    <div className="v2-card" style={{maxWidth:'460px',width:'100%'}} onClick={e=>e.stopPropagation()}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
                            <h2 style={{margin:0,fontSize:'1.1rem'}}>Booking Detail</h2>
                            <button onClick={()=>setDetail(null)} style={{border:'none',background:'transparent',fontSize:'1.5rem',cursor:'pointer'}}>×</button>
                        </div>
                        {[{l:'Client',v:`${detail.clientName||'Walk-in'}${detail.clientPhone?' · '+String(detail.clientPhone):''}`},{l:'Stylist',v:detail.stylistName||'—'},{l:'Time',v:detail.timestamp?.toDate?.()?.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})||'—'},{l:'Payment',v:(detail.paymentType||'cash').toUpperCase()}].map(r=>(
                            <div key={r.l} style={{marginBottom:'0.75rem'}}>
                                <div style={{fontSize:'0.65rem',color:'var(--v2-text-muted)',textTransform:'uppercase',fontWeight:'700'}}>{r.l}</div>
                                <div style={{fontWeight:'600',fontSize:'0.875rem'}}>{r.v}</div>
                            </div>
                        ))}
                        <div style={{marginBottom:'0.75rem'}}>
                            <div style={{fontSize:'0.65rem',color:'var(--v2-text-muted)',textTransform:'uppercase',fontWeight:'700',marginBottom:'0.5rem'}}>Services</div>
                            {(detail.services||detail.items||[]).map((s,i)=>(
                                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.4rem 0',borderBottom:'1px solid var(--v2-border)',fontSize:'0.875rem'}}>
                                    <span>{s.name}</span><span style={{fontWeight:'700'}}>{fmt(s.price)}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',padding:'0.75rem 0',borderTop:'2px solid var(--v2-border)',fontWeight:'900',fontSize:'1rem'}}>
                            <span>Grand Total</span><span style={{color:'var(--v2-primary)'}}>{fmt(detail.totalAmount)}</span>
                        </div>
                        
                        {/* Modify & Checkout — only for pending/scheduled online bookings */}
                        {['pending','scheduled'].includes((detail.status||'').toLowerCase()) && (
                            <div style={{marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--v2-border)'}}>
                                <div style={{fontSize:'0.72rem',color:'#92400e',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'6px',padding:'0.5rem 0.75rem',marginBottom:'0.75rem',fontWeight:'600'}}>
                                    ⚠️ Customer has arrived? Adjust actual services before billing.
                                </div>
                                <button
                                    onClick={() => { setCheckoutAppt(detail); setDetail(null); }}
                                    style={{width:'100%',padding:'0.75rem',background:'#f59e0b',color:'white',border:'none',borderRadius:'8px',fontWeight:'800',fontSize:'0.95rem',cursor:'pointer',letterSpacing:'0.01em'}}>
                                    ✏️ Modify & Checkout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── New Appointment Modal ── */}
            {showNewAppt && (
                <NewAppointmentModal
                    defaultDate={newApptCtx.date}
                    defaultStylistId={newApptCtx.stylistId}
                    onClose={()=>setShowNewAppt(false)}
                    onSaved={()=>setShowNewAppt(false)}
                />
            )}

            {/* ── Modify & Checkout Modal ── */}
            {checkoutAppt && (
                <NewAppointmentModal
                    prefillAppointment={checkoutAppt}
                    onClose={()=>setCheckoutAppt(null)}
                    onSaved={()=>setCheckoutAppt(null)}
                />
            )}
            
            {attendanceModalStylist && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.18s ease' }} onClick={() => { setAttendanceModalStylist(null); setAttendancePhotoFile(null); }}>
                    <style>{`
                        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
                        @keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
                        .att-btn { transition: all 0.18s ease; }
                        .att-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
                        .att-btn:active:not(:disabled) { transform: translateY(0); }
                        .att-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                        .att-cancel:hover { background: #f3f4f6 !important; }
                    `}</style>
                    <div style={{ background: 'white', borderRadius: '20px', maxWidth: '380px', width: '100%', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', animation: 'slideUp 0.22s ease' }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', padding: '2rem 2rem 1.5rem', textAlign: 'center', position: 'relative' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontSize: '1.5rem', fontWeight: '900', color: 'white', border: '2px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                                {attendanceModalStylist?.name?.charAt(0) || '?'}
                            </div>
                            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', fontWeight: '800', color: 'white' }}>{attendanceModalStylist?.name || 'Unknown'}</h2>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: '500' }}>Log attendance for {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'short' })}</p>
                            <button onClick={() => { setAttendanceModalStylist(null); setAttendancePhotoFile(null); }} style={{ position:'absolute', top:'1rem', right:'1rem', background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'8px', width:'30px', height:'30px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white', transition:'background 0.15s' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>

                        {/* Photo Upload */}
                        <div style={{ padding: '1.5rem 1.5rem 0', textAlign: 'center' }}>
                            <label style={{ display: 'block', padding: '1rem', border: '2px dashed #cbd5e1', borderRadius: '12px', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' }}>
                                <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={e => setAttendancePhotoFile(e.target.files[0])} />
                                {attendancePhotoFile ? (
                                    <div style={{ color: '#0d9488', fontWeight: '700', fontSize: '0.85rem' }}>
                                        ✓ Photo Selected ({attendancePhotoFile.name})
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', fontWeight: '500' }}>Tap to change</div>
                                    </div>
                                ) : (
                                    <div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.85rem' }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📸</div>
                                        Tap to take a photo
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button
                                className="att-btn"
                                onClick={() => handleAttendance('clock_in')}
                                disabled={isSavingAttendance || hasClockedInToday}
                                style={{ padding: '1.25rem 1rem', border: '2px solid #10b981', background: '#f0fdf4', color: '#065f46', borderRadius: '14px', fontWeight: '700', cursor: hasClockedInToday ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', opacity: (isSavingAttendance || hasClockedInToday) ? 0.5 : 1 }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                                </div>
                                {hasClockedInToday ? 'Already Clocked In' : 'Clock In'}
                            </button>
                            <button
                                className="att-btn"
                                onClick={() => handleAttendance('clock_out')}
                                disabled={isSavingAttendance || !isCurrentlyClockedIn}
                                style={{ padding: '1.25rem 1rem', border: '2px solid #ef4444', background: '#fff1f2', color: '#991b1b', borderRadius: '14px', fontWeight: '700', cursor: !isCurrentlyClockedIn ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', opacity: (isSavingAttendance || !isCurrentlyClockedIn) ? 0.5 : 1 }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                                </div>
                                Clock Out
                            </button>
                        </div>

                        {/* Cancel */}
                        <div style={{ padding: '0 1.5rem 1.5rem' }}>
                            <button className="att-cancel" onClick={() => { setAttendanceModalStylist(null); setAttendancePhotoFile(null); }} style={{ width: '100%', padding: '0.7rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', color: '#6b7280', fontSize: '0.875rem', transition: 'background 0.15s' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
