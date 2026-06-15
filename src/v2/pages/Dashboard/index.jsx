import Layout from '../../components/Layout';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataProvider';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import StatCard from '../../components/StatCard';
import { useAuth } from '../../../context/AuthContext';
import { 
  Layers, IndianRupee, Banknote, CreditCard, CalendarClock, 
  Users, UserPlus, ShoppingBag, Receipt, Calculator, Clock
} from 'lucide-react';

const STATUS_COLORS = {
  completed:  { bg: '#dcfce7', color: '#166534' },
  scheduled:  { bg: '#dbeafe', color: '#1e40af' },
  pending:    { bg: '#fef9c3', color: '#854d0e' },
  confirmed:  { bg: '#e0f2fe', color: '#0369a1' },
  checked_in: { bg: '#f3e8ff', color: '#7e22ce' },
  cancelled:  { bg: '#fee2e2', color: '#991b1b' },
  no_show:    { bg: '#f3f4f6', color: '#374151' },
};

function getDateBounds(range) {
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const end   = new Date(now); end.setHours(23,59,59,999);
  if (range === 'yesterday') { start.setDate(start.getDate()-1); end.setDate(end.getDate()-1); }
  else if (range === 'last7')  { start.setDate(start.getDate()-6); }
  else if (range === 'last30') { start.setDate(start.getDate()-29); }
  else if (range === 'month')  { start.setDate(1); }
  else if (range === 'lastMonth') {
    start.setMonth(start.getMonth()-1); start.setDate(1);
    end.setDate(0);
  } else if (range === 'all') {
    start.setFullYear(2020);
  }
  return { start, end };
}

export default function V2Dashboard() {
  const { stylists, products, settings } = useData();
  const { userRole, currentUser } = useAuth();
  const navigate = useNavigate();
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const todayDateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  
  const isAdmin = userRole === 'admin';

  // Single source of truth: ALL records from Firestore, filtered client-side
  const [allRecords, setAllRecords]   = useState([]);
  const [fbLoading, setFbLoading]     = useState(true);
  const unsubRef = useRef(null);

  // Filters
  const [dateRange,    setDateRange]    = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stylistFilter,setStylistFilter]= useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [entries,      setEntries]      = useState(25);
  const [activeTab,    setActiveTab]    = useState('all'); // all | appointments | sales

  // Fetch ALL appointments once (live)
  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    setFbLoading(true);
    const q = query(collection(db, 'appointments'), orderBy('timestamp', 'desc'), limit(200));
    unsubRef.current = onSnapshot(q, snap => {
      setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFbLoading(false);
    }, () => setFbLoading(false));
    return () => unsubRef.current?.();
  }, []);

  // Client-side filtering
  const filtered = useMemo(() => {
    // Allow both Admin and Stylists to use dateRange
    const effectiveDateRange = dateRange;
    const { start, end } = getDateBounds(effectiveDateRange);
    const startTs = start.getTime();
    const endTs   = end.getTime();
    const q = searchQuery.toLowerCase().trim();

    return allRecords.filter(item => {
      const ts = item.timestamp?.toDate?.()?.getTime?.();

      // Date range
      if (ts && (ts < startTs || ts > endTs)) return false;

      // Stylist Access Control & Filter
      const sid = item.stylistId || item.items?.[0]?.stylistId;
      if (!isAdmin) {
        const involved = (item.stylistId === currentUser?.uid) || 
          [...(item.services||[]), ...(item.products||[]), ...(item.items||[]), ...(item.packages||[]), ...(item.memberships||[])]
          .some(i => i.staffId === currentUser?.uid || i.stylistId === currentUser?.uid);
        if (!involved) return false;
      } else {
        if (stylistFilter !== 'all' && sid !== stylistFilter) return false;
      }

      // Status
      const status = (item.status || 'completed').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Tab
      if (activeTab === 'appointments' && item.v2 === true) return false;
      if (activeTab === 'sales' && item.v2 !== true) return false;

      // Search — check name, phone, id, services
      if (q) {
        const name    = (item.clientName  || '').toLowerCase();
        const phone   = String(item.clientPhone || '');
        const id      = (item.id           || '').toLowerCase();
        const svcs    = (item.services || item.items || []).map(s => (s.name||'').toLowerCase()).join(' ');
        const stylistName = (item.stylistName || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !id.includes(q) && !svcs.includes(q) && !stylistName.includes(q)) return false;
      }

      return true;
    });
  }, [allRecords, dateRange, statusFilter, stylistFilter, searchQuery, activeTab, isAdmin, currentUser]);

  const displayed = useMemo(() => filtered.slice(0, entries), [filtered, entries]);

  // Completed records within the selected date range & scope
  const completedInRange = useMemo(() => {
    const effectiveDateRange = dateRange;
    const { start, end } = getDateBounds(effectiveDateRange);
    const startTs = start.getTime(); const endTs = end.getTime();
    
    return allRecords.filter(r => {
      const ts = r.timestamp?.toDate?.()?.getTime?.();
      const inDate = ts && ts >= startTs && ts <= endTs;
      const isCompleted = (r.status || 'completed').toLowerCase() === 'completed';
      
      if (!isAdmin) {
        const involved = (r.stylistId === currentUser?.uid) || 
          [...(r.services||[]), ...(r.products||[]), ...(r.items||[]), ...(r.packages||[]), ...(r.memberships||[])]
          .some(i => i.staffId === currentUser?.uid || i.stylistId === currentUser?.uid);
        return inDate && isCompleted && involved;
      }
      return inDate && isCompleted;
    });
  }, [allRecords, dateRange, isAdmin, currentUser]);

  // KPIs from date-filtered data (ignore tab/search/status for KPIs)
  const kpis = useMemo(() => {
    const effectiveDateRange = dateRange;
    const { start, end } = getDateBounds(effectiveDateRange);
    const startTs = start.getTime(); const endTs = end.getTime();
    
    const inRange = allRecords.filter(r => { 
      const ts = r.timestamp?.toDate?.()?.getTime?.(); 
      const inDate = ts && ts >= startTs && ts <= endTs;
      if (!isAdmin) {
        const involved = (r.stylistId === currentUser?.uid) || 
          [...(r.services||[]), ...(r.products||[]), ...(r.items||[]), ...(r.packages||[]), ...(r.memberships||[])]
          .some(i => i.staffId === currentUser?.uid || i.stylistId === currentUser?.uid);
        return inDate && involved;
      }
      return inDate;
    });

    const activeInRange = inRange.filter(r => (r.status || 'completed').toLowerCase() !== 'cancelled');
    
    const getProdTot = (r) => [...(r.services || []), ...(r.products || []), ...(r.items || []), ...(r.memberships || []), ...(r.packages || []), ...(r.walletTopups || [])]
      .filter(i => i.type === 'product')
      .reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
    
    const totalRev = completedInRange.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const productSales = completedInRange.reduce((s, r) => s + getProdTot(r), 0);
    const cash    = completedInRange.filter(r => (r.paymentType||'cash') === 'cash').reduce((s, r) => s + (r.totalAmount || 0), 0);
    const card    = completedInRange.filter(r => (r.paymentType||'cash') !== 'cash').reduce((s, r) => s + (r.totalAmount || 0), 0);
    const appts   = activeInRange.filter(r => r.status === 'scheduled' || r.status === 'confirmed' || r.status === 'pending' || r.status === 'checked_in').length;
    const unpaid  = activeInRange.filter(r => (r.status||'').toLowerCase() === 'unpaid').length;
    const returning = inRange.filter(r => r.isReturningClient).length;
    const walkins = inRange.filter(r => !r.isReturningClient).length;
    const avgBill = completedInRange.length > 0 ? (totalRev / completedInRange.length) : 0;

    return { 
      count: activeInRange.length, 
      totalRev, 
      productSales,
      cash, 
      card, 
      appts, 
      unpaid, 
      returning, 
      walkins,
      avgBill,
      completedCount: completedInRange.length
    };
  }, [allRecords, dateRange, completedInRange, isAdmin, currentUser]);

  const fmt = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
  const lowStock = (products || []).filter(p => (p.stock || 0) < 5);

  return (
    <Layout>
      {/* ── GREETING & ACTIONS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--v2-text-main)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {greeting}, {settings?.businessName || 'BUSINESS'}
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)', marginTop: '0.2rem', fontWeight: '500' }}>
            {todayDateStr}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/v2/pos')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#0d9488', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(13, 148, 136, 0.2)', transition: 'background 0.2s', letterSpacing: '0.02em' }} onMouseEnter={e => e.currentTarget.style.background = '#0f766e'} onMouseLeave={e => e.currentTarget.style.background = '#0d9488'}>
            <Receipt size={14} strokeWidth={2.5} /> NEW BILL
          </button>

          <button onClick={() => navigate('/v2/calendar')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.2)', transition: 'background 0.2s', letterSpacing: '0.02em' }} onMouseEnter={e => e.currentTarget.style.background = '#7c3aed'} onMouseLeave={e => e.currentTarget.style.background = '#8b5cf6'}>
            <CalendarClock size={14} strokeWidth={2.5} /> CALENDAR
          </button>

          <button onClick={() => navigate('/v2/expenses')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)', transition: 'background 0.2s', letterSpacing: '0.02em' }} onMouseEnter={e => e.currentTarget.style.background = '#dc2626'} onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>
            <Clock size={14} strokeWidth={2.5} /> EXPENSES
          </button>

          <select 
            className="form-select" 
            style={{ width: 'auto', padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid var(--v2-border)', fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-main)', background: 'white', outline: 'none', cursor: 'pointer', letterSpacing: '0.02em' }}
            value={dateRange} 
            onChange={e => setDateRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      {isAdmin ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <StatCard label="Revenue" value={fmt(kpis.totalRev)} icon={IndianRupee} accentColor="var(--v2-primary)" accentBg="rgba(13, 148, 136, 0.1)" />
          <StatCard label="Products" value={fmt(kpis.productSales)} icon={ShoppingBag} accentColor="#f59e0b" accentBg="rgba(245, 158, 11, 0.1)" />
          <StatCard label="Cash" value={fmt(kpis.cash)} icon={Banknote} accentColor="#16a34a" accentBg="rgba(22, 163, 74, 0.1)" />
          <StatCard label="Card / UPI" value={fmt(kpis.card)} icon={CreditCard} accentColor="#2563eb" accentBg="rgba(37, 99, 235, 0.1)" />
          <StatCard label="Avg. Bill" value={fmt(kpis.avgBill)} icon={Calculator} accentColor="#7c3aed" accentBg="rgba(124, 58, 237, 0.1)" />
          <StatCard label="Walk-ins" value={kpis.walkins} icon={UserPlus} accentColor="#ec4899" accentBg="rgba(236, 72, 153, 0.1)" />
          <StatCard label="Unpaid" value={kpis.unpaid} icon={Receipt} accentColor="#dc2626" accentBg="rgba(220, 38, 38, 0.1)" />
          <StatCard label="Returning" value={kpis.returning} icon={Users} accentColor="#0891b2" accentBg="rgba(8, 145, 178, 0.1)" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <StatCard label="Bills Done" value={kpis.completedCount} icon={Layers} accentColor="var(--v2-text-sub)" accentBg="#f1f5f9" description="Today's completed count" />
          <StatCard label="Scheduled" value={kpis.appts} icon={CalendarClock} accentColor="#3b82f6" accentBg="rgba(59, 130, 246, 0.1)" description="Today's appointments" />
          <StatCard label="Unpaid" value={kpis.unpaid} icon={Receipt} accentColor="#dc2626" accentBg="rgba(220, 38, 38, 0.1)" description="Pending dues" />
          <StatCard label="Today's Rev" value={fmt(kpis.totalRev)} icon={IndianRupee} accentColor="var(--v2-primary)" accentBg="rgba(13, 148, 136, 0.1)" description="Your total revenue" />
          <StatCard label="Cash" value={fmt(kpis.cash)} icon={Banknote} accentColor="#16a34a" accentBg="rgba(22, 163, 74, 0.1)" description="Cash register balance" />
          <StatCard label="Card / UPI" value={fmt(kpis.card)} icon={CreditCard} accentColor="#8b5cf6" accentBg="rgba(139, 92, 246, 0.1)" description="Digital payments" />
        </div>
      )}

      {/* Main Layout Area */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 300px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* ── MAIN TABLE ── */}
        <div className="v2-card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.95rem', color: 'var(--v2-text-main)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--v2-primary)' }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              Recent Activity
            </div>
            <button onClick={() => navigate('/v2/appointments')} style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--v2-text-sub)', background: 'transparent', border: '1px solid var(--v2-border)', padding: '0.4rem 0.8rem', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              VIEW ALL <span style={{ fontSize: '0.9rem' }}>›</span>
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'750px' }}>
              <thead>
                <tr style={{ background:'white', position:'sticky', top:0, zIndex: 10 }}>
                  <th style={{ padding:'0.9rem 1.5rem' }}>Date / Invoice</th>
                  <th style={{ padding:'0.9rem 1rem' }}>Client</th>
                  {isAdmin && <th style={{ padding:'0.9rem 1rem' }}>Staff</th>}
                  <th style={{ padding:'0.9rem 1rem' }}>Services</th>
                  <th style={{ padding:'0.9rem 1rem', textAlign:'center' }}>Payment</th>
                  <th style={{ padding:'0.9rem 1rem', textAlign:'center' }}>Status</th>
                  <th style={{ padding:'0.9rem 1.5rem', textAlign:'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {fbLoading ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} style={{ padding:'4rem', textAlign:'center', color:'var(--v2-text-muted)' }}>Loading…</td></tr>
                ) : displayed.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} style={{ padding:'4rem', textAlign:'center', color:'var(--v2-text-muted)' }}>No records match your filters.</td></tr>
                ) : displayed.map(item => {
                  const status = (item.status || 'completed').toLowerCase();
                  const sc = STATUS_COLORS[status] || STATUS_COLORS.completed;
                  const svcs = (item.services || item.items || []).map(s => s.name).filter(Boolean).join(', ');
                  return (
                    <tr key={item.id}>
                      <td style={{ padding:'0.85rem 1.5rem' }}>
                        <div style={{ fontWeight:'600' }}>
                          {item.timestamp?.toDate?.()?.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) || '—'}
                          <span style={{ fontWeight:'400', color:'var(--v2-text-muted)', marginLeft:'0.4rem' }}>
                            {item.timestamp?.toDate?.()?.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) || ''}
                          </span>
                        </div>
                        <div style={{ fontSize:'0.68rem', color:'var(--v2-text-muted)', marginTop:'2px' }}>#{(item.id||'').substring(0,8).toUpperCase()}</div>
                      </td>
                      <td style={{ padding:'0.85rem 1rem' }}>
                        <div style={{ fontWeight:'600' }}>{item.clientName || 'Walk-in'}</div>
                        <div style={{ fontSize:'0.72rem', color:'var(--v2-text-muted)' }}>{item.clientPhone ? String(item.clientPhone) : ''}</div>
                      </td>
                      {isAdmin && (
                        <td style={{ padding:'0.85rem 1rem', fontWeight:'500', color: 'var(--v2-text-sub)' }}>{item.stylistName || '—'}</td>
                      )}
                      <td style={{ padding:'0.85rem 1rem', color:'var(--v2-text-sub)', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{svcs || '—'}</td>
                      <td style={{ padding:'0.85rem 1rem', textAlign:'center' }}>
                        <span style={{ fontSize:'0.65rem', fontWeight:'600', textTransform:'uppercase', padding:'0.2rem 0.5rem', borderRadius:'4px', background:'#e0f2fe', color:'#0369a1' }}>{item.paymentType || 'cash'}</span>
                      </td>
                      <td style={{ padding:'0.85rem 1rem', textAlign:'center' }}>
                        <span style={{ fontSize:'0.65rem', fontWeight:'600', textTransform:'uppercase', padding:'0.2rem 0.5rem', borderRadius:'4px', background: sc.bg, color: sc.color }}>{status}</span>
                      </td>
                      <td style={{ padding:'0.85rem 1.5rem', textAlign:'right', fontWeight:'700', color:'var(--v2-text-main)' }}>{fmt(item.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {displayed.length > 0 && (
                <tfoot>
                  <tr style={{ background:'var(--v2-bg-main)', fontWeight:'700', fontSize:'0.85rem' }}>
                    <td colSpan={isAdmin ? 6 : 5} style={{ padding:'1rem 1.5rem', textAlign:'right' }}>Showing {displayed.length} of {filtered.length} records</td>
                    <td style={{ padding:'1rem 1.5rem', textAlign:'right', color:'var(--v2-text-main)' }}>{fmt(filtered.filter(r => (r.status||'completed').toLowerCase()==='completed').reduce((s,r) => s+((r.totalAmount||0) - [...(r.services || []), ...(r.products || []), ...(r.items || []), ...(r.memberships || []), ...(r.packages || []), ...(r.walletTopups || [])].filter(i => i.type === 'product').reduce((ps, p) => ps + (Number(p.price) || 0) * (Number(p.qty) || 1), 0)), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR (ADMIN ONLY) ── */}
        {isAdmin && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {/* Revenue gauge */}
            <div className="v2-card" style={{ background:'var(--v2-sidebar-bg)', color:'white', padding:'1.25rem' }}>
              <div style={{ fontSize:'0.7rem', fontWeight:'700', color: 'var(--v2-sidebar-text)', textTransform:'uppercase', marginBottom:'0.5rem' }}>Today's Revenue</div>
              <div style={{ fontSize:'1.75rem', fontWeight:'800' }}>{fmt(kpis.totalRev)}</div>
              <div style={{ height:'6px', background:'rgba(255,255,255,0.1)', borderRadius:'3px', marginTop:'0.75rem', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.min((kpis.totalRev/50000)*100,100)}%`, background:'var(--v2-primary)', borderRadius:'3px', transition:'width 1s ease' }}></div>
              </div>
              <div style={{ fontSize:'0.7rem', marginTop:'0.4rem', color: 'var(--v2-sidebar-text)' }}>Target: ₹50,000</div>
            </div>

            {/* Staff */}
            <div className="v2-card" style={{ padding:'1.25rem' }}>
              <div style={{ fontWeight:'600', fontSize:'0.875rem', marginBottom:'1rem' }}>Team Sales</div>
              {(stylists||[]).map(s => (
                <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--v2-primary)', color:'white', fontSize:'0.7rem', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center' }}>{s.name?.charAt(0)}</div>
                    <span style={{ fontSize:'0.85rem', fontWeight:'500' }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize:'0.8rem', color:'var(--v2-text-sub)', fontWeight: '600' }}>
                    {fmt(completedInRange.reduce((sum, r) => {
                      const staffItems = [...(r.services || []), ...(r.items || [])].filter(i => i.staffId === s.id && i.type !== 'product' && !i.isRedemption);
                      const itemSum = staffItems.reduce((acc, item) => acc + (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1), 0);
                      return sum + itemSum;
                    }, 0))}
                  </span>
                </div>
              ))}
            </div>

            {/* Low stock */}
            {lowStock.length > 0 && (
              <div className="v2-card" style={{ padding:'1.25rem', borderLeft:'3px solid var(--v2-red)' }}>
                <div style={{ fontWeight:'600', fontSize:'0.875rem', color:'var(--v2-red)', marginBottom:'0.75rem' }}>⚠ Low Stock Alerts</div>
                {lowStock.slice(0,5).map(p => (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', padding:'0.5rem 0', borderBottom:'1px solid var(--v2-border-light)' }}>
                    <span style={{ color: 'var(--v2-text-main)' }}>{p.name}</span>
                    <span style={{ fontWeight:'600', color:'var(--v2-red)' }}>{p.stock} left</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
