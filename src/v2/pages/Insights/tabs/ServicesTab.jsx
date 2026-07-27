// Services Intelligence Tab
import React, { useState } from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { inr } from '../../../utils/insightsEngine/helpers.js';
import { InsightCard, SectionHeader, InsightText } from './SummaryTab';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { exportToCSV } from '../../../utils/exportToCSV';
import DataGridModal from '../../../components/DataGridModal';

export default function ServicesTab() {
  const { analytics } = useInsights();
  const [quadrantModalOpen, setQuadrantModalOpen] = useState(false);
  const [deadServicesModalOpen, setDeadServicesModalOpen] = useState(false);

  if (!analytics) return null;
  const { services } = analytics;

  const handleExport = (data, filename) => {
    exportToCSV(data, [
      { header: 'Name', accessor: 'name' },
      { header: 'Revenue', accessor: 'revenue' },
      { header: 'Margin', accessor: 'margin' },
      { header: 'Growth %', accessor: 'growthPct' },
      { header: 'Quadrant', accessor: 'quadrant' },
    ], filename);
  };

  const QUADRANT_COLORS = { star: '#16a34a', cashcow: '#2563eb', question: '#d97706', dog: '#9CA3AF' };
  const QUADRANT_LABELS = { star: '⭐ Star', cashcow: '🐄 Cash Cow', question: '❓ Question Mark', dog: '🐕 Dog' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Services',    value: services.byCount.length,                                          color: '#111827' },
          { label: 'Top Service',       value: services.mostBooked?.name?.split(' ').slice(0, 2).join(' ') || '—', color: '#2563eb' },
          { label: 'Highest Revenue',   value: inr(services.highestRevenue?.revenue || 0),                       color: '#16a34a' },
          { label: 'Avg per Bill',      value: services.avgServicesPerBill.toFixed(1),                           color: '#374151' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: '10px', padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.73rem', color: '#6B7280', fontWeight: '600', marginBottom: '0.4rem' }}>{s.label}</div>
            <div style={{ fontSize: '1rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Top 10 by Bookings */}
        <InsightCard>
          <SectionHeader title="Most Booked Services" subtitle="Top 10 by number of bookings" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={services.top10ByCount.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} tickLine={false} axisLine={false} width={90}
                tickFormatter={v => v.length > 14 ? v.slice(0, 12) + '…' : v}
              />
              <Tooltip formatter={(v, n) => [v, n === 'count' ? 'Bookings' : n]} />
              <Bar dataKey="count" name="Bookings" radius={[0, 4, 4, 0]}>
                {services.top10ByCount.slice(0, 8).map((_, i) => <Cell key={i} fill={i === 0 ? '#111827' : i < 3 ? '#374151' : '#E5E7EB'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {services.bestCombo && (
            <InsightText text={`"${services.bestCombo.pair}" appear together in ${services.bestCombo.pct.toFixed(0)}% of bills — consider creating a bundled package.`} color="#2563eb" />
          )}
        </InsightCard>

        {/* Revenue by Service */}
        <InsightCard>
          <SectionHeader title="Revenue by Service" subtitle="Top 5 by earnings" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={services.top5ByRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} tickFormatter={v => v.length > 10 ? v.slice(0, 8) + '…' : v} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => inr(v)} />
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                {services.top5ByRevenue.map((_, i) => <Cell key={i} fill={i === 0 ? '#111827' : '#E5E7EB'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Growth vs Decline table */}
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>GROWTH vs LAST PERIOD</div>
            {services.top5ByRevenue.slice(0, 5).map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: '#374151' }}>{s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name}</span>
                <span style={{ fontWeight: '700', color: s.growthPct >= 0 ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {s.growthPct >= 0 ? <TrendingUp size={10} strokeWidth={2.5} /> : <TrendingDown size={10} strokeWidth={2.5} />}
                  {Math.abs(s.growthPct).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </InsightCard>
      </div>

      {/* 4-Quadrant Matrix */}
      {services.quadrantData.length > 0 && (
        <InsightCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <SectionHeader title="Service Portfolio Matrix" subtitle="Stars: high margin + growing. Cash Cows: high margin + stable. Question Marks: low margin + growing. Dogs: low margin + declining." />
            <button 
              onClick={() => setQuadrantModalOpen(true)}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }}
            >
              View Full Matrix
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {['star', 'cashcow', 'question', 'dog'].map(q => {
              const items = services.quadrantData.filter(s => s.quadrant === q);
              return (
                <div key={q} style={{ background: QUADRANT_COLORS[q] + '08', border: `1px solid ${QUADRANT_COLORS[q]}22`, borderRadius: '8px', padding: '0.875rem' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.78rem', color: QUADRANT_COLORS[q], marginBottom: '0.5rem' }}>{QUADRANT_LABELS[q]}</div>
                  {items.length === 0 ? (
                    <div style={{ fontSize: '0.73rem', color: '#9CA3AF' }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {items.slice(0, 3).map(s => (
                        <div key={s.name} style={{ fontSize: '0.73rem', color: '#374151', fontWeight: '500' }}>
                          {s.name.length > 16 ? s.name.slice(0, 14) + '…' : s.name}
                        </div>
                      ))}
                      {items.length > 3 && <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>+{items.length - 3} more</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </InsightCard>
      )}

      {/* Dead Services */}
      {services.deadServices.length > 0 && (
        <InsightCard style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <SectionHeader title="Services with Zero Bookings" subtitle="These services were offered but not booked this period" />
            <button 
              onClick={() => setDeadServicesModalOpen(true)}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#fff', border: '1px solid #FECACA', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontWeight: '600' }}
            >
              View All
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {services.deadServices.slice(0, 5).map(s => (
              <span key={s.name} style={{ background: '#fff', border: '1px solid #FECACA', color: '#dc2626', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.78rem', fontWeight: '600' }}>
                {s.name}
              </span>
            ))}
            {services.deadServices.length > 5 && (
              <span style={{ padding: '0.25rem 0.625rem', fontSize: '0.78rem', color: '#dc2626' }}>
                +{services.deadServices.length - 5} more
              </span>
            )}
          </div>
          <InsightText text="Consider promoting these services with a limited-time discount, or review if they're still relevant to your client base." color="#dc2626" />
        </InsightCard>
      )}

      {/* Modals */}
      <DataGridModal
        isOpen={quadrantModalOpen}
        onClose={() => setQuadrantModalOpen(false)}
        title="Service Portfolio Matrix"
        subtitle="Full list of services categorized by margin and growth."
        data={services.quadrantData}
        onExport={() => handleExport(services.quadrantData, 'service-matrix.csv')}
        columns={[
          { header: 'Service', accessor: 'name' },
          { header: 'Revenue', accessor: 'revenue', render: (row) => inr(row.revenue) },
          { header: 'Margin', accessor: 'margin', render: (row) => inr(row.margin) },
          { header: 'Growth', accessor: 'growthPct', render: (row) => (
            <span style={{ color: row.growth >= 0 ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
              {row.growth > 0 ? '+' : ''}{row.growth.toFixed(1)}%
            </span>
          )},
          { header: 'Quadrant', accessor: 'quadrant', render: (row) => (
            <span style={{ 
              padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
              background: QUADRANT_COLORS[row.quadrant] + '22',
              color: QUADRANT_COLORS[row.quadrant]
            }}>
              {QUADRANT_LABELS[row.quadrant]}
            </span>
          )}
        ]}
      />

      <DataGridModal
        isOpen={deadServicesModalOpen}
        onClose={() => setDeadServicesModalOpen(false)}
        title="Zero Bookings"
        subtitle="Services that received no bookings this period."
        data={services.deadServices}
        onExport={() => {
          exportToCSV(services.deadServices, [
            { header: 'Service', accessor: 'name' },
            { header: 'Avg Price', accessor: 'avgPrice' },
            { header: 'Prior Count', accessor: 'priorCount' },
          ], 'dead-services.csv');
        }}
        columns={[
          { header: 'Service', accessor: 'name' },
          { header: 'Avg Price', accessor: 'avgPrice', render: (row) => inr(row.avgPrice) },
          { header: 'Bookings Last Period', accessor: 'priorCount' }
        ]}
      />
    </div>
  );
}
