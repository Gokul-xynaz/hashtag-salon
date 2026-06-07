import Layout from '../../components/Layout';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../../context/DataProvider';
import { collection, query, orderBy, onSnapshot, Timestamp, limit } from 'firebase/firestore';
import { db } from '../../../services/firebase';

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
  const { stylists, products } = useData();

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

  // Fetch ALL appointments once (live) — client-side filtering is instant and fixes search
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
    const { start, end } = getDateBounds(dateRange);
    const startTs = start.getTime();
    const endTs   = end.getTime();
    const q = searchQuery.toLowerCase().trim();

    return allRecords.filter(item => {
      const ts = item.timestamp?.toDate?.()?.getTime?.();

      // Date range
      if (ts && (ts < startTs || ts > endTs)) return false;

      // Status
      const status = (item.status || 'completed').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Stylist
      if (stylistFilter !== 'all') {
        const sid = item.stylistId || item.items?.[0]?.stylistId;
        if (sid !== stylistFilter) return false;
      }

      // Tab
      if (activeTab === 'appointments' && item.v2 === true) return false;
      if (activeTab === 'sales' && item.v2 !== true) return false;

      // Search — check name, phone, id, services
      if (q) {
        const name    = (item.clientName  || '').toLowerCase();
        const phone   = String(item.clientPhone || '');
        const id      = (item.id           || '').toLowerCase();
        const svcs    = (item.services || item.items || []).map(s => (s.name||'').toLowerCase()).join(' ');
        const stylist = (item.stylistName || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !id.includes(q) && !svcs.includes(q) && !stylist.includes(q)) return false;
      }

      return true;
    });
  }, [allRecords, dateRange, statusFilter, stylistFilter, searchQuery, activeTab]);

  const displayed = useMemo(() => filtered.slice(0, entries), [filtered, entries]);

  // Completed records within the selected date range
  const completedInRange = useMemo(() => {
    const { start, end } = getDateBounds(dateRange);
    const startTs = start.getTime(); const endTs = end.getTime();
    return allRecords.filter(r => {
      const ts = r.timestamp?.toDate?.()?.getTime?.();
      return ts && ts >= startTs && ts <= endTs && (r.status || 'completed').toLowerCase() === 'completed';
    });
  }, [allRecords, dateRange]);

  // KPIs from date-filtered data (ignore tab/search/status for KPIs)
  const kpis = useMemo(() => {
    const { start, end } = getDateBounds(dateRange);
    const startTs = start.getTime(); const endTs = end.getTime();
    const inRange = allRecords.filter(r => { const ts = r.timestamp?.toDate?.()?.getTime?.(); return ts && ts >= startTs && ts <= endTs; });
    const activeInRange = inRange.filter(r => (r.status || 'completed').toLowerCase() !== 'cancelled');
    const getProdTot = (r) => [...(r.services || []), ...(r.products || []), ...(r.items || []), ...(r.memberships || []), ...(r.packages || []), ...(r.walletTopups || [])].filter(i => i.type === 'product').reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
    const getNetRev = (r) => Math.max(0, (r.totalAmount || 0) - getProdTot(r));
    const revenue = completedInRange.reduce((s, r) => s + getNetRev(r), 0);
    const cash    = completedInRange.filter(r => (r.paymentType||'cash') === 'cash').reduce((s, r) => s + getNetRev(r), 0);
    const card    = completedInRange.filter(r => (r.paymentType||'cash') !== 'cash').reduce((s, r) => s + getNetRev(r), 0);
    const appts   = activeInRange.filter(r => r.status === 'scheduled' || r.status === 'confirmed' || r.status === 'pending').length;
    const unpaid  = activeInRange.filter(r => (r.status||'').toLowerCase() === 'unpaid').length;
    const returning = inRange.filter(r => r.isReturningClient).length;
    return { count: activeInRange.length, revenue, cash, card, appts, unpaid, returning, newC: activeInRange.length - returning };
  }, [allRecords, dateRange, completedInRange]);

  const fmt = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
  const lowStock = (products || []).filter(p => (p.stock || 0) < 5);

  return (
    <Layout>
      {/* ── KPI STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { l: 'Records',    v: kpis.count,     c: '' },
          { l: 'Revenue',    v: fmt(kpis.revenue), c: 'var(--v2-primary)' },
          { l: 'Cash',       v: fmt(kpis.cash),   c: '#16a34a' },
          { l: 'Card / UPI', v: fmt(kpis.card),   c: '#2563eb' },
          { l: 'Scheduled',  v: kpis.appts,       c: '#7c3aed' },
          { l: 'Returning',  v: kpis.returning,   c: '#0891b2' },
          { l: 'New Clients',v: kpis.newC,        c: '#f59e0b' },
        ].map((k,i) => (
          <div key={i} className="v2-card" style={{ padding: '1rem', textAlign:'center' }}>
            <div style={{ fontSize:'0.6rem', color:'var(--v2-text-muted)', textTransform:'uppercase', fontWeight:'800' }}>{k.l}</div>
            <div style={{ fontSize:'1.25rem', fontWeight:'900', color: k.c || 'var(--v2-text-main)', marginTop:'0.25rem' }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── MAIN TABLE ── */}
        <div className="v2-card" style={{ padding: 0 }}>
          {/* Tab bar */}
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {['all','appointments','sales'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ padding:'0.4rem 1rem', borderRadius:'var(--v2-radius-full)', border:'none', fontWeight:'700', fontSize:'0.75rem', cursor:'pointer', textTransform:'capitalize', background: activeTab===t ? 'var(--v2-primary)' : 'var(--v2-bg-main)', color: activeTab===t ? 'white' : 'var(--v2-text-muted)' }}>{t === 'all' ? 'All Activity' : t === 'appointments' ? 'Appointments' : 'Quick Sales'}</button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'var(--v2-text-muted)' }}>{filtered.length} records</span>
          </div>

          {/* Filter bar */}
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--v2-border)', background: 'var(--v2-bg-main)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Date range */}
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ padding:'0.45rem 0.75rem', border:'1px solid var(--v2-border)', borderRadius:'var(--v2-radius-sm)', outline:'none', fontSize:'0.8rem', fontWeight:'600', background:'white' }}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="all">All Time</option>
            </select>

            {/* Status */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding:'0.45rem 0.75rem', border:'1px solid var(--v2-border)', borderRadius:'var(--v2-radius-sm)', outline:'none', fontSize:'0.8rem', background:'white' }}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
              <option value="scheduled">Scheduled</option>
            </select>

            {/* Stylist */}
            <select value={stylistFilter} onChange={e => setStylistFilter(e.target.value)} style={{ padding:'0.45rem 0.75rem', border:'1px solid var(--v2-border)', borderRadius:'var(--v2-radius-sm)', outline:'none', fontSize:'0.8rem', background:'white' }}>
              <option value="all">All Staff</option>
              {(stylists || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* Search */}
            <input
              type="text"
              placeholder="🔍  Search name, phone, service…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex:1, minWidth:'180px', padding:'0.45rem 0.75rem', border:'1px solid var(--v2-border)', borderRadius:'var(--v2-radius-sm)', outline:'none', fontSize:'0.8rem' }}
            />

            {/* Entries */}
            <select value={entries} onChange={e => setEntries(Number(e.target.value))} style={{ padding:'0.45rem 0.75rem', border:'1px solid var(--v2-border)', borderRadius:'var(--v2-radius-sm)', outline:'none', fontSize:'0.8rem', background:'white' }}>
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'750px' }}>
              <thead>
                <tr style={{ fontSize:'0.68rem', color:'var(--v2-text-muted)', textTransform:'uppercase', textAlign:'left', borderBottom:'1px solid var(--v2-border)', background:'white', position:'sticky', top:0 }}>
                  <th style={{ padding:'0.9rem 1.5rem' }}>Date / Invoice</th>
                  <th style={{ padding:'0.9rem 1rem' }}>Client</th>
                  <th style={{ padding:'0.9rem 1rem' }}>Staff</th>
                  <th style={{ padding:'0.9rem 1rem' }}>Services</th>
                  <th style={{ padding:'0.9rem 1rem', textAlign:'center' }}>Payment</th>
                  <th style={{ padding:'0.9rem 1rem', textAlign:'center' }}>Status</th>
                  <th style={{ padding:'0.9rem 1.5rem', textAlign:'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {fbLoading ? (
                  <tr><td colSpan={7} style={{ padding:'4rem', textAlign:'center', color:'var(--v2-text-muted)' }}>Loading…</td></tr>
                ) : displayed.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding:'4rem', textAlign:'center', color:'var(--v2-text-muted)' }}>No records match your filters.</td></tr>
                ) : displayed.map(item => {
                  const status = (item.status || 'completed').toLowerCase();
                  const sc = STATUS_COLORS[status] || STATUS_COLORS.completed;
                  const svcs = (item.services || item.items || []).map(s => s.name).filter(Boolean).join(', ');
                  return (
                    <tr key={item.id} style={{ borderBottom:'1px solid var(--v2-border)', fontSize:'0.84rem', transition:'background 0.1s' }}>
                      <td style={{ padding:'0.85rem 1.5rem' }}>
                        <div style={{ fontWeight:'700' }}>
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
                      <td style={{ padding:'0.85rem 1rem', fontWeight:'600' }}>{item.stylistName || '—'}</td>
                      <td style={{ padding:'0.85rem 1rem', color:'var(--v2-text-muted)', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{svcs || '—'}</td>
                      <td style={{ padding:'0.85rem 1rem', textAlign:'center' }}>
                        <span style={{ fontSize:'0.65rem', fontWeight:'700', textTransform:'uppercase', padding:'0.2rem 0.5rem', borderRadius:'4px', background:'#e0f2fe', color:'#0369a1' }}>{item.paymentType || 'cash'}</span>
                      </td>
                      <td style={{ padding:'0.85rem 1rem', textAlign:'center' }}>
                        <span style={{ fontSize:'0.65rem', fontWeight:'700', textTransform:'uppercase', padding:'0.2rem 0.5rem', borderRadius:'4px', background: sc.bg, color: sc.color }}>{status}</span>
                      </td>
                      <td style={{ padding:'0.85rem 1.5rem', textAlign:'right', fontWeight:'800', color:'var(--v2-primary)' }}>{fmt(item.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {displayed.length > 0 && (
                <tfoot>
                  <tr style={{ background:'var(--v2-bg-main)', fontWeight:'800', fontSize:'0.85rem' }}>
                    <td colSpan={6} style={{ padding:'1rem 1.5rem', textAlign:'right' }}>Showing {displayed.length} of {filtered.length} records</td>
                    <td style={{ padding:'1rem 1.5rem', textAlign:'right', color:'var(--v2-primary)' }}>{fmt(filtered.filter(r => (r.status||'completed').toLowerCase()==='completed').reduce((s,r) => s+((r.totalAmount||0) - [...(r.services || []), ...(r.products || []), ...(r.items || []), ...(r.memberships || []), ...(r.packages || []), ...(r.walletTopups || [])].filter(i => i.type === 'product').reduce((ps, p) => ps + (Number(p.price) || 0) * (Number(p.qty) || 1), 0)), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {/* Revenue gauge */}
          <div className="v2-card" style={{ background:'var(--v2-sidebar-bg)', color:'white', padding:'1.25rem' }}>
            <div style={{ fontSize:'0.7rem', fontWeight:'800', opacity:0.6, textTransform:'uppercase', marginBottom:'0.5rem' }}>Today's Revenue</div>
            <div style={{ fontSize:'1.75rem', fontWeight:'900' }}>{fmt(kpis.revenue)}</div>
            <div style={{ height:'6px', background:'rgba(255,255,255,0.15)', borderRadius:'3px', marginTop:'0.75rem', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${Math.min((kpis.revenue/50000)*100,100)}%`, background:'#10b981', borderRadius:'3px', transition:'width 1s ease' }}></div>
            </div>
            <div style={{ fontSize:'0.7rem', marginTop:'0.4rem', opacity:0.5 }}>Target: ₹50,000</div>
          </div>

          {/* Staff */}
          <div className="v2-card" style={{ padding:'1.25rem' }}>
            <div style={{ fontWeight:'700', fontSize:'0.875rem', marginBottom:'1rem' }}>Team</div>
            {(stylists||[]).map(s => (
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--v2-primary)', color:'white', fontSize:'0.7rem', fontWeight:'800', display:'flex', alignItems:'center', justifyContent:'center' }}>{s.name?.charAt(0)}</div>
                  <span style={{ fontSize:'0.85rem', fontWeight:'600' }}>{s.name}</span>
                </div>
                <span style={{ fontSize:'0.7rem', color:'var(--v2-text-muted)' }}>
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
            <div className="v2-card" style={{ padding:'1.25rem', borderLeft:'4px solid #ef4444' }}>
              <div style={{ fontWeight:'700', fontSize:'0.875rem', color:'#b91c1c', marginBottom:'0.75rem' }}>⚠ Low Stock</div>
              {lowStock.slice(0,5).map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', padding:'0.4rem 0', borderBottom:'1px solid var(--v2-border)' }}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight:'700', color:'#dc2626' }}>{p.stock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
