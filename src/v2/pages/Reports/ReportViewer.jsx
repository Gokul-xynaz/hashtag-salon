import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useData } from '../../../context/DataProvider';
import { getReport } from './reportConfigs';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const STATUS_BADGE_COLORS = {
  'COMPLETED':   { bg: '#dcfce7', color: '#166534' },
  'CANCELLED':   { bg: '#fee2e2', color: '#991b1b' },
  'NO SHOW':     { bg: '#f3f4f6', color: '#374151' },
  'PENDING':     { bg: '#fef9c3', color: '#854d0e' },
  'CONFIRMED':   { bg: '#dbeafe', color: '#1e40af' },
  'SCHEDULED':   { bg: '#dbeafe', color: '#1e40af' },
  'CHECKED IN':  { bg: '#f3e8ff', color: '#7e22ce' },
  'CASH':        { bg: '#dcfce7', color: '#166534' },
  'CARD':        { bg: '#dbeafe', color: '#1e40af' },
  'UPI':         { bg: '#e0f2fe', color: '#0369a1' },
  'ONLINE':      { bg: '#ede9fe', color: '#7c3aed' },
  'LOW STOCK':   { bg: '#fee2e2', color: '#991b1b' },
  'WARNING':     { bg: '#fef3c7', color: '#92400e' },
  'IN STOCK':    { bg: '#dcfce7', color: '#166534' },
};

function applyDateFilter(appointments, filter, customStart, customEnd) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return appointments.filter(a => {
    const ts = a.timestamp?.toDate?.() || (a._ts ? new Date(a._ts) : null);
    if (!ts) return filter === 'all';
    switch (filter) {
      case 'today':      return ts >= today;
      case 'yesterday': { const y = new Date(today); y.setDate(y.getDate()-1); return ts >= y && ts < today; }
      case 'this_week': { const w = new Date(today); w.setDate(today.getDate()-today.getDay()); return ts >= w; }
      case 'this_month':return ts >= new Date(now.getFullYear(), now.getMonth(), 1);
      case 'last_month':{
        const s = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59);
        return ts >= s && ts <= e;
      }
      case 'custom': {
        if (customStart) { const s = new Date(customStart); s.setHours(0,0,0,0); if (ts < s) return false; }
        if (customEnd)   { const e = new Date(customEnd);   e.setHours(23,59,59,999); if (ts > e) return false; }
        return true;
      }
      default: return true;
    }
  });
}

function exportToCSV(rows, columns, title) {
  const headers = columns.map(c => c.label).join(',');
  const lines = rows.map(row =>
    columns.map(c => {
      const val = row[c.key] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );
  const csv = [headers, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ReportViewer() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { stylists, products } = useData();

  const report = getReport(reportId);

  const [rawAppointments, setRawAppointments] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [dateFilter, setDateFilter] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Fetch raw data once
  useEffect(() => {
    if (!report) return;
    setLoadingData(true);
    const fetchAll = async () => {
      try {
        const [apptSnap, expSnap] = await Promise.all([
          getDocs(query(collection(db, 'appointments'), orderBy('timestamp', 'desc'), limit(2000))),
          getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(500))),
        ]);
        setRawAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setRawExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Report data fetch error:', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAll();
  }, [report?.id]);

  // Date-filtered appointments
  const dateFiltered = useMemo(() => {
    // Product inventory doesn't need date filtering
    if (report?.id === 'product-inventory') return rawAppointments;
    return applyDateFilter(rawAppointments, dateFilter, customStart, customEnd);
  }, [rawAppointments, dateFilter, customStart, customEnd, report?.id]);

  // Transform data via report config
  const allRows = useMemo(() => {
    if (!report || loadingData) return [];
    return report.transform(dateFiltered, rawExpenses, stylists, products);
  }, [report, dateFiltered, rawExpenses, stylists, products, loadingData]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.toLowerCase();
    return allRows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
  }, [allRows, search]);

  // Paginated
  const pagedRows = useMemo(() =>
    filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  [filteredRows, page]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);

  // Summary
  const summary = useMemo(() => {
    if (!report?.summarize) return {};
    return report.summarize(filteredRows);
  }, [report, filteredRows]);

  if (!report) {
    return (
      <Layout>
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>Report not found</div>
          <button onClick={() => navigate('/v2/reports')} style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>
            ← Back to Reports
          </button>
        </div>
      </Layout>
    );
  }

  const showDateFilters = report.id !== 'product-inventory';

  return (
    <Layout>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={() => navigate('/v2/reports')} style={{ border: 'none', background: 'transparent', color: 'var(--v2-text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            ← All Reports
          </button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--v2-text-main)', margin: 0 }}>
            {report.icon} {report.title}
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--v2-text-muted)', marginTop: '0.25rem' }}>{report.description}</p>
        </div>
        <button
          onClick={() => exportToCSV(filteredRows, report.columns, report.title)}
          style={{ padding: '0.65rem 1.4rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* ── Date Filters ── */}
      {showDateFilters && (
        <div className="v2-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {['today','yesterday','this_week','this_month','last_month','all','custom'].map(f => (
            <button key={f} onClick={() => { setDateFilter(f); setPage(1); }}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem', borderRadius: 'var(--v2-radius-full)', border: dateFilter === f ? 'none' : '1px solid var(--v2-border)', background: dateFilter === f ? 'var(--v2-primary)' : 'transparent', color: dateFilter === f ? 'white' : 'var(--v2-text-muted)', cursor: 'pointer', fontWeight: '700', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
              {f.replace(/_/g, ' ')}
            </button>
          ))}
          {dateFilter === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPage(1); }}
                style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px', fontSize: '0.78rem', outline: 'none' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)' }}>to</span>
              <input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPage(1); }}
                style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--v2-border)', borderRadius: '6px', fontSize: '0.78rem', outline: 'none' }} />
            </>
          )}
        </div>
      )}

      {/* ── Summary KPI Cards ── */}
      {report.summaryCards && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${report.summaryCards.length}, 1fr)`, gap: '1rem', marginBottom: '1.25rem' }}>
          {report.summaryCards.map(card => (
            <div key={card.key} className="v2-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '0.4rem' }}>{card.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '900', color: card.color || 'var(--v2-text-main)' }}>
                {loadingData ? '…' : card.format === 'currency' ? fmtCurrency(summary[card.key]) : card.format === 'number' ? (summary[card.key] || 0).toLocaleString('en-IN') : (summary[card.key] || '—')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + Count ── */}
      <div className="v2-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--v2-border)', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--v2-bg-main)', flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="🔍  Search within results…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: '180px', padding: '0.45rem 0.75rem', border: '1px solid var(--v2-border)', borderRadius: '6px', outline: 'none', fontSize: '0.82rem' }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--v2-text-muted)', whiteSpace: 'nowrap' }}>
            {loadingData ? 'Loading…' : `${filteredRows.length.toLocaleString('en-IN')} rows`}
          </span>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ fontSize: '0.67rem', color: 'var(--v2-text-muted)', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--v2-border)', background: 'white', position: 'sticky', top: 0 }}>
                {report.columns.map(col => (
                  <th key={col.key} style={{ padding: '0.85rem 1.25rem', fontWeight: '800', whiteSpace: 'nowrap', textAlign: ['currency','number'].includes(col.format) ? 'right' : 'left' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr><td colSpan={report.columns.length} style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                  Loading report data…
                </td></tr>
              ) : pagedRows.length === 0 ? (
                <tr><td colSpan={report.columns.length} style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                  No records found for the selected period.
                </td></tr>
              ) : pagedRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--v2-border)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {report.columns.map(col => {
                    const val = row[col.key];
                    const align = ['currency','number'].includes(col.format) ? 'right' : 'left';
                    const badgeStyle = col.badge ? (STATUS_BADGE_COLORS[val] || { bg: '#f1f5f9', color: '#64748b' }) : null;
                    return (
                      <td key={col.key} style={{ padding: '0.75rem 1.25rem', textAlign: align, fontWeight: col.highlight ? '800' : '400', color: col.highlight ? 'var(--v2-primary)' : 'inherit', whiteSpace: col.key === 'services' ? 'normal' : 'nowrap', maxWidth: col.key === 'services' ? '200px' : 'unset', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {col.badge ? (
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', padding: '0.2rem 0.55rem', borderRadius: '4px', background: badgeStyle.bg, color: badgeStyle.color }}>
                            {val}
                          </span>
                        ) : col.format === 'currency' ? fmtCurrency(val)
                          : col.format === 'number'   ? (val || 0).toLocaleString('en-IN')
                          : (val ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {/* Footer totals for currency columns */}
            {pagedRows.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--v2-bg-main)', fontWeight: '800', fontSize: '0.8rem', borderTop: '2px solid var(--v2-border)' }}>
                  {report.columns.map((col, ci) => {
                    if (ci === 0) return <td key={col.key} style={{ padding: '0.85rem 1.25rem', color: 'var(--v2-text-muted)' }}>Page {page} of {totalPages || 1} &nbsp;·&nbsp; {filteredRows.length} total rows</td>;
                    if (col.format === 'currency') {
                      const colTotal = filteredRows.reduce((s, r) => s + (r[col.key] || 0), 0);
                      return <td key={col.key} style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'var(--v2-primary)' }}>{fmtCurrency(colTotal)}</td>;
                    }
                    if (col.format === 'number') {
                      const colTotal = filteredRows.reduce((s, r) => s + (r[col.key] || 0), 0);
                      return <td key={col.key} style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>{colTotal.toLocaleString('en-IN')}</td>;
                    }
                    return <td key={col.key} />;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--v2-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              style={{ padding: '0.4rem 0.85rem', border: '1px solid var(--v2-border)', borderRadius: '6px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontWeight: '700', fontSize: '0.8rem' }}>
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i+1 : (page <= 4 ? i+1 : page - 3 + i);
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ padding: '0.4rem 0.75rem', border: 'none', borderRadius: '6px', background: page === p ? 'var(--v2-primary)' : 'white', color: page === p ? 'white' : 'var(--v2-text-main)', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', boxShadow: page === p ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              style={{ padding: '0.4rem 0.85rem', border: '1px solid var(--v2-border)', borderRadius: '6px', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1, fontWeight: '700', fontSize: '0.8rem' }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
