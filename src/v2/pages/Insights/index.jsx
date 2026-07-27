// ═══════════════════════════════════════════════════════════════════
// JX Billing — Business Insights Page
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import { InsightsProvider, useInsights } from '../../../context/InsightsContext';
import Layout from '../../components/Layout';
import {
  LayoutDashboard, TrendingUp, Users, Calendar, Award,
  Scissors, Package, Lightbulb, RefreshCw, ChevronDown,
  AlertCircle, AlertTriangle, CheckCircle, Info, Trophy,
  Zap, TrendingDown, Settings
} from 'lucide-react';
import GoalsConfig from './GoalsConfig';

// ── Tab Definitions ────────────────────────────────────────────────
const TABS = [
  { id: 'summary',      label: 'Summary',      icon: LayoutDashboard },
  { id: 'revenue',      label: 'Revenue',       icon: TrendingUp },
  { id: 'customers',    label: 'Customers',     icon: Users },
  { id: 'appointments', label: 'Appointments',  icon: Calendar },
  { id: 'staff',        label: 'Staff',         icon: Award },
  { id: 'services',     label: 'Services',      icon: Scissors },
  { id: 'inventory',    label: 'Inventory',     icon: Package },
  { id: 'opportunities',label: 'Opportunities', icon: Lightbulb },
];

const PERIODS = [
  { value: 'thisMonth',   label: 'This Month' },
  { value: 'lastMonth',   label: 'Last Month' },
  { value: 'last3Months', label: 'Last 3 Months' },
  { value: 'thisYear',    label: 'This Year' },
];

// Lazy-loaded tab components
const SummaryTab      = React.lazy(() => import('./tabs/SummaryTab'));
const RevenueTab      = React.lazy(() => import('./tabs/RevenueTab'));
const CustomersTab    = React.lazy(() => import('./tabs/CustomersTab'));
const AppointmentsTab = React.lazy(() => import('./tabs/AppointmentsTab'));
const StaffTab        = React.lazy(() => import('./tabs/StaffTab'));
const ServicesTab     = React.lazy(() => import('./tabs/ServicesTab'));
const InventoryTab    = React.lazy(() => import('./tabs/InventoryTab'));
const OpportunitiesTab = React.lazy(() => import('./tabs/OpportunitiesTab'));

const TAB_COMPONENTS = {
  summary:       SummaryTab,
  revenue:       RevenueTab,
  customers:     CustomersTab,
  appointments:  AppointmentsTab,
  staff:         StaffTab,
  services:      ServicesTab,
  inventory:     InventoryTab,
  opportunities: OpportunitiesTab,
};

// ── Severity icon map ─────────────────────────────────────────────
import { SEVERITY_CONFIG } from './constants';

// ── Smart Notification Banner ─────────────────────────────────────
function SmartBanner() {
  const { bannerInsight, analytics } = useInsights();
  const [dismissed, setDismissed] = useState(false);

  if (!bannerInsight || dismissed || !analytics) return null;
  const { color, bg, Icon } = SEVERITY_CONFIG[bannerInsight.severity] || SEVERITY_CONFIG.info;

  return (
    <div style={{
      background: bg, borderLeft: `4px solid ${color}`,
      padding: '0.75rem 1rem', borderRadius: '0 8px 8px 0',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      marginBottom: '1rem', position: 'relative',
    }}>
      <Icon size={18} color={color} strokeWidth={2} />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: '600', fontSize: '0.85rem', color }}>{bannerInsight.title}. </span>
        <span style={{ fontSize: '0.82rem', color: '#374151' }}>{bannerInsight.body}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: '0.25rem', fontSize: '1rem', lineHeight: 1 }}
      >×</button>
    </div>
  );
}

// ── Period Selector ───────────────────────────────────────────────
function PeriodSelector() {
  const { period, setPeriod, loading, refresh } = useInsights();
  const [open, setOpen] = useState(false);
  const current = PERIODS.find(p => p.value === period) || PERIODS[2];

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.875rem', borderRadius: '8px',
            border: '1px solid #E5E7EB', background: '#fff',
            fontWeight: '600', fontSize: '0.8125rem', cursor: 'pointer',
            color: '#111827', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          {current.label}
          <ChevronDown size={14} strokeWidth={2.5} />
        </button>
        {open && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: '140px', overflow: 'hidden',
          }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.625rem 1rem', border: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', fontWeight: p.value === period ? '700' : '500',
                  color: p.value === period ? '#2563eb' : '#111827',
                  background: p.value === period ? '#eff6ff' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => { if (p.value !== period) e.target.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (p.value !== period) e.target.style.background = 'transparent'; }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={refresh}
        disabled={loading}
        title="Refresh data"
        style={{
          width: '34px', height: '34px', borderRadius: '8px',
          border: '1px solid #E5E7EB', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: loading ? 'not-allowed' : 'pointer', color: '#6B7280',
          transition: 'all 0.15s ease',
        }}
      >
        <RefreshCw size={14} strokeWidth={2} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
      </button>
    </div>
  );
}

// ── Tab Strip ─────────────────────────────────────────────────────
function TabStrip({ activeTab, onTabChange }) {
  const { insights } = useInsights();
  const tabRef = useRef(null);

  // Count critical insights per section for dot badge
  const sectionCounts = {};
  insights.filter(i => i.severity === 'critical').forEach(i => {
    sectionCounts[i.section] = (sectionCounts[i.section] || 0) + 1;
  });

  // Map section names to tab IDs
  const sectionToTab = {
    revenue: 'revenue', customers: 'customers', appointments: 'appointments',
    staff: 'staff', services: 'services', inventory: 'inventory',
    financial: 'opportunities',
  };

  return (
    <div
      ref={tabRef}
      style={{
        display: 'flex', gap: '0', borderBottom: '1px solid #E5E7EB',
        overflowX: 'auto', scrollbarWidth: 'none',
        marginBottom: '1.5rem', position: 'sticky', top: 0,
        background: '#F8F9FA', zIndex: 20, padding: '0 0',
      }}
    >
      <style>{`.insights-tab-strip::-webkit-scrollbar { display: none; }`}</style>
      {TABS.map(tab => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        const critCount = Object.entries(sectionToTab)
          .filter(([, tid]) => tid === tab.id)
          .reduce((s, [section]) => s + (sectionCounts[section] || 0), 0);

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.75rem 0.875rem', border: 'none', cursor: 'pointer',
              background: 'transparent', whiteSpace: 'nowrap',
              fontSize: '0.8125rem', fontWeight: isActive ? '700' : '500',
              color: isActive ? '#111827' : '#6B7280',
              borderBottom: isActive ? '2px solid #111827' : '2px solid transparent',
              transition: 'all 0.15s ease', position: 'relative',
              marginBottom: '-1px',
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderBottomColor = '#D1D5DB'; }}}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderBottomColor = 'transparent'; }}}
          >
            <TabIcon size={15} strokeWidth={isActive ? 2.5 : 2} />
            {tab.label}
            {critCount > 0 && (
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#dc2626', position: 'absolute', top: '8px', right: '4px',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────
function InsightsSkeleton() {
  const shimmer = {
    background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '8px',
  };
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ ...shimmer, height: '160px' }} />
        <div style={{ ...shimmer, height: '160px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        {[...Array(4)].map((_, i) => <div key={i} style={{ ...shimmer, height: '90px' }} />)}
      </div>
      <div style={{ ...shimmer, height: '240px' }} />
    </>
  );
}

// ── Error State ────────────────────────────────────────────────────
function InsightsError({ error }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', gap: '1rem',
    }}>
      <AlertCircle size={40} color="#dc2626" strokeWidth={1.5} />
      <div>
        <div style={{ fontWeight: '700', fontSize: '1rem', color: '#111827', marginBottom: '0.5rem' }}>
          Could not load insights
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6B7280', maxWidth: '400px' }}>{error}</div>
      </div>
    </div>
  );
}

// ── Tab Content Manager ─────────────────────────────────────────────
function TabContent({ activeTab }) {
  const { loading, error } = useInsights();
  const [mounted, setMounted] = useState({ summary: true, [activeTab]: true });

  if (!mounted[activeTab]) {
    setMounted(prev => ({ ...prev, [activeTab]: true }));
  }

  if (loading) return <InsightsSkeleton />;
  if (error)   return <InsightsError error={error} />;

  return (
    <>
      {TABS.map(tab => {
        const TabComponent = TAB_COMPONENTS[tab.id];
        if (!mounted[tab.id]) return null;
        return (
          <div key={tab.id} style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
            <React.Suspense fallback={<InsightsSkeleton />}>
              <TabComponent />
            </React.Suspense>
          </div>
        );
      })}
    </>
  );
}

// ── Inner Page (has access to context) ───────────────────────────
function InsightsInner() {
  const [activeTab, setActiveTab] = useState('summary');
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <Layout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .insight-card { animation: fadeUp 0.3s ease both; }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: '800', color: '#111827', margin: 0 }}>
              Business Insights
            </h1>
            <span style={{
              fontSize: '0.55rem', fontWeight: '700', letterSpacing: '0.05em',
              background: '#2563eb', color: '#fff', borderRadius: '4px',
              padding: '0.15rem 0.45rem', alignSelf: 'center',
            }}>NEW</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#6B7280', margin: 0 }}>
            Your intelligent business advisor
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PeriodSelector />
          <button
            onClick={() => setConfigOpen(true)}
            title="Configure Business Goals"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '8px',
              border: '1px solid #E5E7EB', background: '#fff',
              cursor: 'pointer', color: '#6B7280', transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Settings size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Smart Banner */}
      <SmartBanner />

      {/* Tab Strip */}
      <TabStrip activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <TabContent activeTab={activeTab} />

      {/* Config Modal */}
      <GoalsConfig isOpen={configOpen} onClose={() => setConfigOpen(false)} />
    </Layout>
  );
}

// ── Page Entry Point ──────────────────────────────────────────────
export default function BusinessInsights() {
  return (
    <InsightsProvider>
      <InsightsInner />
    </InsightsProvider>
  );
}
