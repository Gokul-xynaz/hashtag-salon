// Appointments Intelligence Tab
import React from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { InsightCard, SectionHeader, InsightText } from './SummaryTab';
import { inr } from '../../../utils/insightsEngine/helpers.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Calendar, XCircle, Clock, Navigation } from 'lucide-react';

// Booking Heatmap Grid (Day × Hour)
function BookingHeatmap({ heatmapGrid, maxVal }) {
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am to 10pm
  const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getColor = (count) => {
    if (!count) return '#F9FAFB';
    const intensity = count / maxVal;
    if (intensity > 0.75) return '#111827';
    if (intensity > 0.5)  return '#374151';
    if (intensity > 0.25) return '#9CA3AF';
    return '#E5E7EB';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `48px repeat(${HOURS.length}, 1fr)`, gap: '3px', minWidth: '520px' }}>
        {/* Header row */}
        <div />
        {HOURS.map(h => (
          <div key={h} style={{ fontSize: '0.6rem', color: '#9CA3AF', textAlign: 'center', fontWeight: '600' }}>
            {h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
          </div>
        ))}
        {/* Data rows */}
        {DAYS.map((day, dowIdx) => (
          <React.Fragment key={day}>
            <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: '600', display: 'flex', alignItems: 'center' }}>{day}</div>
            {HOURS.map(h => {
              const count = heatmapGrid[`${dowIdx}_${h}`] || 0;
              return (
                <div
                  key={h}
                  title={`${day} ${h < 12 ? `${h}am` : `${h - 12}pm`}: ${count} bookings`}
                  style={{
                    height: '22px', borderRadius: '3px',
                    background: getColor(count),
                    transition: 'transform 0.1s ease',
                    cursor: count > 0 ? 'pointer' : 'default',
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.7rem', color: '#6B7280' }}>
        <span>Less busy</span>
        {['#F9FAFB', '#E5E7EB', '#9CA3AF', '#374151', '#111827'].map((c, i) => (
          <div key={i} style={{ width: '14px', height: '14px', background: c, borderRadius: '2px', border: '1px solid #F3F4F6' }} />
        ))}
        <span>More busy</span>
      </div>
    </div>
  );
}

export default function AppointmentsTab() {
  const { analytics } = useInsights();
  if (!analytics) return null;
  const { appointments, revenue } = analytics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Appointments', value: appointments.completedCount,            color: '#111827' },
          { label: 'Cancellation Rate',  value: `${appointments.cancellationRate.toFixed(0)}%`, color: appointments.cancellationRate > 15 ? '#dc2626' : '#16a34a' },
          { label: 'No-Show Rate',       value: `${appointments.noShowRate.toFixed(0)}%`, color: appointments.noShowRate > 8 ? '#d97706' : '#16a34a' },
          { label: 'Walk-in Rate',       value: `${appointments.walkinPct.toFixed(0)}%`,  color: '#374151' },
          { label: 'Peak Hour',          value: appointments.peakHour,                   color: '#2563eb' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: '10px', padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.73rem', color: '#6B7280', fontWeight: '600', marginBottom: '0.4rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Booking Heatmap */}
      <InsightCard>
        <SectionHeader title="Booking Heatmap" subtitle="When are customers visiting — darker = more bookings" />
        <BookingHeatmap heatmapGrid={appointments.heatmapGrid} maxVal={appointments.maxHeatmapVal} />
        {appointments.idleSlotSummary && (
          <InsightText
            text={`${appointments.idleSlotSummary} has consistently low bookings. A flash promotion targeting this slot could fill it and add meaningful revenue.`}
            icon={Clock}
            color="#d97706"
          />
        )}
      </InsightCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Day of Week */}
        <InsightCard>
          <SectionHeader title="Bookings by Day" subtitle="Volume and cancellation rate per weekday" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={appointments.byDayOfWeek} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]}>
                {appointments.byDayOfWeek.map((e, i) => (
                  <Cell key={i} fill={e.day === appointments.peakDay ? '#111827' : '#E5E7EB'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <InsightText text={`Peak booking day: ${appointments.peakDay}. Lowest booking day: ${appointments.idleDay}. Consider special offers on ${appointments.idleDay} to balance the week.`} color="#374151" />
        </InsightCard>

        {/* Cancellation Trend */}
        <InsightCard>
          <SectionHeader title="Cancellation Rate Trend" subtitle="Weekly cancellation percentage" />
          {appointments.weeklyRates.length >= 2 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={appointments.weeklyRates} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} />
                  <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                  <Line type="monotone" dataKey="cancelRate" name="Cancel Rate" stroke={appointments.cancellationRate > 15 ? '#dc2626' : '#111827'} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <InsightText
                text={`${appointments.cancellationRate.toFixed(0)}% cancellation rate. ${appointments.cancellationRate > 15 ? 'This is above the healthy threshold of 15%. A small advance deposit policy can significantly reduce cancellations.' : 'This is within the healthy range. Keep monitoring for spikes.'}`}
                icon={XCircle}
                color={appointments.cancellationRate > 15 ? '#dc2626' : '#16a34a'}
              />
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>Not enough weekly data. Select a longer period.</div>
          )}
        </InsightCard>
      </div>

      {/* Idle Slot Estimator */}
      {revenue.leakageData?.estimatedMonthlyLeakage > 0 && (
        <InsightCard style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#92400e' }}>{Math.round(revenue.leakageData.emptySlots)}</div>
              <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: '600' }}>Unfilled Slots</div>
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#92400e' }}>{inr(revenue.avgBillValue)}</div>
              <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: '600' }}>Avg Bill Value</div>
            </div>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#92400e' }}>{inr(revenue.leakageData.estimatedMonthlyLeakage)}</div>
              <div style={{ fontSize: '0.75rem', color: '#78350f', fontWeight: '600' }}>Monthly Opportunity</div>
            </div>
          </div>
        </InsightCard>
      )}
    </div>
  );
}
