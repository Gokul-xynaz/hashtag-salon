import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { REPORTS, CATEGORIES } from './reportConfigs';

/* ─── SVG Icon Map ───────────────────────────────────────────────────── */
const SvgIcon = ({ name, size = 20, color = 'currentColor' }) => {
  const paths = {
    clipboard:    ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2','M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z'],
    'x-circle':   ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M15 9l-6 6M9 9l6 6'],
    'credit-card':['M1 4h22v16H1z','M1 10h22'],
    calendar:     ['M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
    tag:          ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z','M7 7h.01'],
    'shopping-bag':['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z','M3 6h18','M16 10a4 4 0 0 1-8 0'],
    package:      ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z','M3.27 6.96L12 12.01l8.73-5.05','M12 22.08V12'],
    user:         ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2','M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    users:        ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
    scissors:     ['M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M20 4L8.12 15.88','M14.47 14.48L20 20','M8.12 8.12L12 12'],
    star:         ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    list:         ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
    dollar:       ['M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
    pin:          ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    search:       ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.35-4.35'],
    grid:         ['M3 3h7v7H3z','M14 3h7v7h-7z','M14 14h7v7h-7z','M3 14h7v7H3z'],
    clock:        ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M12 6v6l4 2'],
  };
  const d = paths[name] || paths.grid;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
};

export default function ReportsHub() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState([]);
  
  useEffect(() => {
    const saved = localStorage.getItem('v2_pinned_reports');
    if (saved) setPinned(JSON.parse(saved));
  }, []);

  const togglePin = (e, reportId) => {
    e.stopPropagation();
    let newPinned;
    if (pinned.includes(reportId)) {
        newPinned = pinned.filter(id => id !== reportId);
    } else {
        newPinned = [...pinned, reportId];
    }
    setPinned(newPinned);
    localStorage.setItem('v2_pinned_reports', JSON.stringify(newPinned));
  };

  const displayed = REPORTS.filter(r => {
    let matchCat = false;
    if (activeCategory === 'all') matchCat = true;
    else if (activeCategory === 'pinned') matchCat = pinned.includes(r.id);
    else matchCat = r.category === activeCategory;
    const matchSearch = !search.trim() || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const catColor = (id) => CATEGORIES.find(c => c.id === id)?.color || '#64748b';
  const catLabel = (id) => CATEGORIES.find(c => c.id === id)?.label || id;

  return (
    <Layout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        .rpt-card {
          transition: all 0.22s ease;
          animation: fadeUp 0.3s ease both;
          cursor: pointer;
        }
        .rpt-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        }
        .rpt-cat-pill {
          transition: all 0.18s ease;
          cursor: pointer;
        }
        .rpt-cat-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        .rpt-pin-btn {
          transition: all 0.15s ease;
          cursor: pointer;
          border: none;
          background: transparent;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rpt-pin-btn:hover { background: rgba(0,0,0,0.05); }
        .rpt-search {
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .rpt-search:focus {
          border-color: var(--v2-primary) !important;
          box-shadow: 0 0 0 3px rgba(13,148,136,0.1) !important;
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--v2-text-main)', marginBottom: '0.35rem', letterSpacing: '-0.02em' }}>
          Reports & Analytics
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--v2-text-muted)', margin: 0 }}>
          {REPORTS.length} fully functional reports — all pulling live Firestore data with date filters and CSV export.
        </p>
      </div>

      {/* ── Category Pills ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem', marginBottom: '1.75rem' }}>
        {/* Pinned */}
        <div
          onClick={() => setActiveCategory('pinned')}
          className="v2-card rpt-cat-pill"
          style={{ padding: '1rem', textAlign: 'center', border: activeCategory === 'pinned' ? '2px solid #fbbf24' : '2px solid transparent' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: activeCategory === 'pinned' ? '#fef3c7' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
            <SvgIcon name="pin" size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', color: activeCategory === 'pinned' ? '#fbbf24' : 'var(--v2-text-muted)' }}>Pinned</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--v2-text-muted)', marginTop: '0.15rem' }}>{pinned.length} reports</div>
        </div>

        {/* All */}
        <div
          onClick={() => setActiveCategory('all')}
          className="v2-card rpt-cat-pill"
          style={{ padding: '1rem', textAlign: 'center', border: activeCategory === 'all' ? '2px solid var(--v2-primary)' : '2px solid transparent' }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: activeCategory === 'all' ? 'rgba(13,148,136,0.1)' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
            <SvgIcon name="grid" size={18} color={activeCategory === 'all' ? 'var(--v2-primary)' : '#6b7280'} />
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', color: activeCategory === 'all' ? 'var(--v2-primary)' : 'var(--v2-text-muted)' }}>All Reports</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--v2-text-muted)', marginTop: '0.15rem' }}>{REPORTS.length} total</div>
        </div>

        {CATEGORIES.map(cat => {
          const count = REPORTS.filter(r => r.category === cat.id).length;
          const isActive = activeCategory === cat.id;
          return (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="v2-card rpt-cat-pill"
              style={{ padding: '1rem', textAlign: 'center', border: isActive ? `2px solid ${cat.color}` : '2px solid transparent' }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isActive ? cat.color + '18' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
                <SvgIcon name={cat.icon} size={18} color={isActive ? cat.color : '#6b7280'} />
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: isActive ? cat.color : 'var(--v2-text-muted)', lineHeight: '1.3' }}>{cat.label}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--v2-text-muted)', marginTop: '0.15rem' }}>{count} reports</div>
            </div>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: '400px' }}>
        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
          <SvgIcon name="search" size={16} />
        </div>
        <input
          type="text"
          className="rpt-search"
          placeholder="Search reports by name or keyword…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', border: '1px solid var(--v2-border)', borderRadius: '10px', outline: 'none', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }}
        />
      </div>

      {/* ── Report Grid ── */}
      {displayed.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>
          No reports match your search.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {displayed.map((report, idx) => (
            <div
              key={report.id}
              className="v2-card rpt-card"
              onClick={() => navigate(`/v2/reports/${report.id}`)}
              style={{ padding: '1.5rem', borderLeft: `4px solid ${catColor(report.category)}`, animationDelay: `${idx * 0.04}s` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: catColor(report.category) + '14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SvgIcon name={report.icon} size={20} color={catColor(report.category)} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button 
                        className="rpt-pin-btn"
                        onClick={(e) => togglePin(e, report.id)}
                        title={pinned.includes(report.id) ? "Unpin Report" : "Pin to Dashboard"}
                    >
                        <SvgIcon name="pin" size={16} color={pinned.includes(report.id) ? '#fbbf24' : '#d1d5db'} />
                    </button>
                    <span style={{ fontSize: '0.58rem', fontWeight: '800', textTransform: 'uppercase', padding: '0.2rem 0.5rem', borderRadius: '6px', background: catColor(report.category) + '14', color: catColor(report.category), letterSpacing: '0.04em' }}>
                      {catLabel(report.category)}
                    </span>
                </div>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--v2-text-main)', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
                {report.title}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--v2-text-muted)', lineHeight: '1.55', marginBottom: '1rem' }}>
                {report.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--v2-border)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--v2-text-muted)' }}>
                  {report.columns.length} columns · CSV export
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: catColor(report.category), display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  View Report
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Coming Soon Banner ── */}
      <div className="v2-card" style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8fafc', borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(13,148,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <SvgIcon name="clock" size={20} color="var(--v2-primary)" />
        </div>
        <div>
          <div style={{ fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.25rem' }}>More Reports Coming Soon</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--v2-text-muted)' }}>
            Pending Payments · Package Sales · Payroll History · Membership Redemption · Staff Tips · Deleted Invoices · Attendance Summary · GST/Tax Reports
          </div>
        </div>
      </div>
    </Layout>
  );
}
