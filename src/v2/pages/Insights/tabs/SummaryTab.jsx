// ═══════════════════════════════════════════════════════════════════
// JX Billing — Business Insights: Summary Tab
// The first thing a salon owner sees every morning.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { inr } from '../../../utils/insightsEngine/helpers.js';
import { SEVERITY_CONFIG } from '../constants.js';
import {
  TrendingUp, TrendingDown, Minus, Users, Calendar, Wallet,
  AlertCircle, CheckCircle2, Trophy, ArrowRight, Zap, DollarSign,
  Target, RefreshCw, Clock, Star,
} from 'lucide-react';

// ── Shared component: Delta Arrow ─────────────────────────────────
export function DeltaArrow({ value, suffix = '%', size = 'sm' }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const isUp   = value > 0.5;
  const isDown = value < -0.5;
  const color  = isUp ? '#16a34a' : isDown ? '#dc2626' : '#6B7280';
  const Icon   = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const fs     = size === 'lg' ? '0.85rem' : '0.72rem';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color, fontSize: fs, fontWeight: '600' }}>
      <Icon size={size === 'lg' ? 13 : 11} strokeWidth={2.5} />
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ── Shared component: Section Header ─────────────────────────────
export function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#111827', margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0.2rem 0 0' }}>{subtitle}</p>}
    </div>
  );
}

// ── Shared component: InsightText ─────────────────────────────────
export function InsightText({ text, icon: Icon, color = '#374151' }) {
  if (!text) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
      marginTop: '0.75rem', padding: '0.625rem 0.75rem',
      background: '#F8F9FA', borderRadius: '6px',
      borderLeft: `3px solid ${color || '#E5E7EB'}`,
    }}>
      {Icon && <Icon size={14} color={color} strokeWidth={2} style={{ flexShrink: 0, marginTop: '1px' }} />}
      <p style={{ margin: 0, fontSize: '0.80rem', color: '#374151', lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

// ── Shared component: Card ────────────────────────────────────────
export function InsightCard({ children, style }) {
  return (
    <div className="insight-card v2-card" style={{ padding: '1.25rem', ...style }}>
      {children}
    </div>
  );
}

// ── Business Health Ring ──────────────────────────────────────────
function HealthRing({ score, band, color, components }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      {/* SVG Ring */}
      <div style={{ position: 'relative', width: '140px', height: '140px' }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Track */}
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="12" />
          {/* Progress */}
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '2rem', fontWeight: '800', color: '#111827', lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#6B7280', letterSpacing: '0.05em' }}>/ 100</span>
        </div>
      </div>

      {/* Band label */}
      <span style={{
        fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.06em',
        color, background: color + '1a', padding: '0.2rem 0.75rem',
        borderRadius: '99px', textTransform: 'uppercase',
      }}>
        {band}
      </span>

      {/* Sub-score bars */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {(components || []).slice(0, 4).map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#6B7280', width: '90px', flexShrink: 0 }}>{c.label}</span>
            <div style={{ flex: 1, height: '5px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${c.score}%`, height: '100%', background: c.score >= 66 ? '#16a34a' : c.score >= 41 ? '#d97706' : '#dc2626', borderRadius: '99px', transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: '600', color: '#374151', width: '28px', textAlign: 'right' }}>{Math.round(c.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Today's Snapshot Card ─────────────────────────────────────────
function SnapshotCard({ label, value, delta, deltaLabel, icon: Icon, iconBg, iconColor }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #F3F4F6', borderRadius: '10px',
      padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.73rem', fontWeight: '600', color: '#6B7280' }}>{label}</span>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: iconBg || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {Icon && <Icon size={14} color={iconColor || '#374151'} strokeWidth={2} />}
        </div>
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>{value}</div>
      {delta !== undefined && delta !== null && (
        <DeltaArrow value={delta} suffix={deltaLabel || '%'} />
      )}
    </div>
  );
}

// ── Action Checklist ──────────────────────────────────────────────
function ActionChecklist({ items }) {
  const [checked, setChecked] = React.useState({});

  if (!items || items.length === 0) return null;

  return (
    <InsightCard>
      <SectionHeader title="Today's Action List" subtitle="Priority tasks based on your business data" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map((item) => {
          const { Icon, color, bg } = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.info;
          const done = checked[item.id];
          return (
            <div
              key={item.id}
              onClick={() => setChecked(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                padding: '0.625rem 0.75rem', borderRadius: '8px',
                background: done ? '#F9FAFB' : bg,
                cursor: 'pointer', transition: 'all 0.15s ease',
                opacity: done ? 0.6 : 1,
                border: `1px solid ${done ? '#E5E7EB' : color + '33'}`,
              }}
            >
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                border: `2px solid ${done ? '#16a34a' : color}`,
                background: done ? '#16a34a' : 'transparent',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '1px',
              }}>
                {done && <CheckCircle2 size={10} color="#fff" strokeWidth={3} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.82rem', fontWeight: '600', color: done ? '#9CA3AF' : '#111827',
                  textDecoration: done ? 'line-through' : 'none',
                }}>{item.title}</div>
                <div style={{ fontSize: '0.76rem', color: '#6B7280', marginTop: '0.15rem' }}>{item.body}</div>
              </div>
              <Icon size={14} color={done ? '#9CA3AF' : color} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ── Monthly Summary Strip ─────────────────────────────────────────
function MonthlySummary({ analytics }) {
  if (!analytics?.revenue || !analytics?.financial) return null;
  const { totalRevenue, revenueGrowthPct, avgBillValue } = analytics.revenue;
  const { totalExpenses, netProfit } = analytics.financial;

  const stats = [
    { label: 'Revenue',      value: inr(totalRevenue),  delta: revenueGrowthPct,  icon: TrendingUp,    iconBg: '#dcfce7', iconColor: '#16a34a' },
    { label: 'Expenses',     value: inr(totalExpenses), delta: null,               icon: DollarSign,    iconBg: '#fef3c7', iconColor: '#d97706' },
    { label: 'Net Profit',   value: inr(netProfit),     delta: null,               icon: Target,        iconBg: '#dbeafe', iconColor: '#2563eb' },
    { label: 'Avg Bill',     value: inr(avgBillValue),  delta: null,               icon: Star,          iconBg: '#F3F4F6', iconColor: '#374151' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
      {stats.map(s => (
        <SnapshotCard key={s.label} {...s} />
      ))}
    </div>
  );
}

// ── Growth Opportunities Strip ────────────────────────────────────
function GrowthStrip({ insights }) {
  const opportunities = insights.filter(i => i.severity === 'opportunity').slice(0, 3);
  if (opportunities.length === 0) return null;

  return (
    <InsightCard style={{ marginBottom: 0, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <Zap size={16} color="#fbbf24" strokeWidth={2.5} />
        <span style={{ fontWeight: '700', fontSize: '0.875rem', color: '#fff' }}>Growth Opportunities</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${opportunities.length}, 1fr)`, gap: '0.75rem' }}>
        {opportunities.map(opp => {
          const LIcon = ({ size }) => {
            const icons = { TrendingUp, Zap, Users, Calendar, Trophy, Star, DollarSign, Target, RefreshCw, Clock };
            const I = icons[opp.icon] || Zap;
            return <I size={size} strokeWidth={2} />;
          };
          return (
            <div key={opp.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.07)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <LIcon size={13} />
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fbbf24' }}>{opp.title}</span>
              </div>
              <p style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.4 }}>{opp.body.slice(0, 80)}...</p>
            </div>
          );
        })}
      </div>
    </InsightCard>
  );
}

// ── Main Summary Tab ──────────────────────────────────────────────
export default function SummaryTab() {
  const { analytics, insights, actionItems } = useInsights();

  if (!analytics) return null;
  const { health, revenue, customers, appointments } = analytics;

  // Today's live snapshot KPIs
  const todayCards = [
    { label: 'Revenue',          value: inr(revenue.totalRevenue),           delta: revenue.revenueGrowthPct,         icon: TrendingUp,    iconBg: '#dcfce7', iconColor: '#16a34a' },
    { label: 'Appointments',     value: appointments.completedCount,          delta: null,                             icon: Calendar,      iconBg: '#dbeafe', iconColor: '#2563eb' },
    { label: 'New Customers',    value: customers.newAppts,                   delta: null,                             icon: Users,         iconBg: '#fef3c7', iconColor: '#d97706' },
    { label: 'Returning',        value: `${customers.retentionRate.toFixed(0)}%`, delta: null,                        icon: RefreshCw,     iconBg: '#F3F4F6', iconColor: '#374151' },
    { label: 'Cash Collected',   value: inr(revenue.cashRevenue),             delta: null,                             icon: Wallet,        iconBg: '#dcfce7', iconColor: '#16a34a' },
    { label: 'Digital Payments', value: inr(revenue.digitalRevenue),          delta: null,                             icon: DollarSign,    iconBg: '#dbeafe', iconColor: '#2563eb' },
    { label: 'Cancellations',    value: appointments.cancelledCount,          delta: appointments.cancellationRate > 0 ? -appointments.cancellationRate : null, icon: AlertCircle, iconBg: '#fee2e2', iconColor: '#dc2626' },
    { label: 'Avg Bill',         value: inr(revenue.avgBillValue),            delta: revenue.avgBillGrowthPct,         icon: Target,        iconBg: '#F3F4F6', iconColor: '#374151' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Row 1: Health Score + Snapshot Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', alignItems: 'start' }}>
        {/* Health Score */}
        <InsightCard>
          <SectionHeader title="Business Health" subtitle={health.narrative.slice(0, 60) + '...'} />
          {health && (
            <HealthRing
              score={health.score}
              band={health.band}
              color={health.color}
              components={health.components}
            />
          )}
          <InsightText text={health.narrative} color={health.color} />
        </InsightCard>

        {/* Today's Snapshot */}
        <InsightCard>
          <SectionHeader title="Performance Snapshot" subtitle={`${PERIODS_LABEL_MAP[analytics.meta?.period] || 'This Month'}'s key metrics`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
            {todayCards.map(card => <SnapshotCard key={card.label} {...card} />)}
          </div>
        </InsightCard>
      </div>

      {/* Row 2: Monthly Summary */}
      <MonthlySummary analytics={analytics} />

      {/* Row 3: Action Checklist + Growth Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
        <ActionChecklist items={actionItems} />
        <GrowthStrip insights={insights} />
      </div>
    </div>
  );
}

const PERIODS_LABEL_MAP = {
  today: "Today", thisWeek: "This Week", thisMonth: "This Month",
  last3Months: "Last 3 Months", thisYear: "This Year",
};
