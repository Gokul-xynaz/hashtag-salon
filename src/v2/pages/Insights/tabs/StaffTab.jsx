// Staff Intelligence Tab
import React from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { inr } from '../../../utils/insightsEngine/helpers.js';
import { InsightCard, SectionHeader, InsightText } from './SummaryTab';
import { Award, TrendingUp, Users, AlertTriangle, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function StaffRing({ pct, color }) {
  if (pct === null || pct === undefined) return <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>No data</span>;
  const r = 18; const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 22 22)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#111827">{Math.round(pct)}%</text>
    </svg>
  );
}

const LABEL_COLORS = { 'Top Performer': '#16a34a', 'Consistent': '#2563eb', 'Needs Attention': '#d97706' };

export default function StaffTab() {
  const { analytics, insights } = useInsights();
  if (!analytics) return null;
  const { staff } = analytics;
  const staffInsights = insights.filter(i => i.section === 'staff');

  if (!staff.staffCards.length) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>No staff data available for this period.</div>;
  }

  const chartData = staff.staffCards.map(s => ({
    name: s.name.split(' ')[0], // first name only for chart
    revenue: Math.round(s.revenue),
    bills: s.bills,
    score: s.compositeScore,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Team KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Team Members',       value: staff.staffCount,                         color: '#111827' },
          { label: 'Total Revenue',      value: inr(staff.totalStaffRevenue),             color: '#16a34a' },
          { label: 'Avg Utilisation',    value: `${Math.round(staff.avgUtilisation || 0)}%`, color: staff.avgUtilisation > 60 ? '#16a34a' : '#d97706' },
          { label: 'Top Performer',      value: staff.topPerformer?.name?.split(' ')[0] || '—', color: '#111827' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: '10px', padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.73rem', color: '#6B7280', fontWeight: '600', marginBottom: '0.4rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Staff Revenue Chart */}
      <InsightCard>
        <SectionHeader title="Revenue by Staff" subtitle="Sorted by highest earner" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} tickLine={false} axisLine={false} width={60} />
            <Tooltip formatter={(v) => inr(v)} />
            <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={i === 0 ? '#111827' : '#E5E7EB'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {staff.topPerformer && (
          <InsightText
            text={`${staff.topPerformer.name} is the top performer with ${inr(staff.topPerformer.revenue)} revenue and ${staff.topPerformer.retentionRate.toFixed(0)}% customer return rate.`}
            icon={Trophy}
            color="#16a34a"
          />
        )}
      </InsightCard>

      {/* Staff Scorecards */}
      <InsightCard>
        <SectionHeader title="Staff Performance Scorecards" subtitle="Composite score: Revenue (40%) + Utilisation (30%) + Retention (30%)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {staff.staffCards.map((s, i) => {
            const labelColor = LABEL_COLORS[s.label] || '#374151';
            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '40px 160px 1fr 80px 80px 80px 80px', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: i < staff.staffCards.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <span style={{ fontWeight: '800', fontSize: '0.85rem', color: i < 3 ? '#d97706' : '#9CA3AF' }}>#{i + 1}</span>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#111827' }}>{s.name}</div>
                  <span style={{ fontSize: '0.65rem', fontWeight: '700', color: labelColor, background: labelColor + '18', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{s.label}</span>
                </div>
                {/* Score bar */}
                <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${s.compositeScore}%`, height: '100%', background: s.compositeScore >= 75 ? '#16a34a' : s.compositeScore >= 50 ? '#2563eb' : '#d97706', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#111827' }}>{inr(s.revenue)}</div>
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Revenue</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <StaffRing pct={s.utilisationPct} color={s.utilisationPct >= 60 ? '#16a34a' : '#d97706'} />
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Utilisation</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#111827' }}>{s.retentionRate.toFixed(0)}%</div>
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Retention</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '700', color: s.discountRate > 15 ? '#dc2626' : '#374151' }}>{s.discountRate.toFixed(0)}%</div>
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Discount</div>
                </div>
              </div>
            );
          })}
        </div>
      </InsightCard>

      {/* Staff Insights */}
      {staffInsights.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {staffInsights.slice(0, 4).map(ins => {
            const colors = { critical: '#dc2626', warning: '#d97706', celebration: '#16a34a', opportunity: '#2563eb', info: '#64748b' };
            const c = colors[ins.severity] || '#374151';
            return (
              <div key={ins.id} style={{ padding: '1rem', background: c + '08', borderRadius: '10px', border: `1px solid ${c}22` }}>
                <div style={{ fontWeight: '700', fontSize: '0.82rem', color: c, marginBottom: '0.25rem' }}>{ins.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#374151', lineHeight: 1.5 }}>{ins.body}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
