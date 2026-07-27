// Revenue Intelligence Tab
import React from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { inr, DAY_NAMES } from '../../../utils/insightsEngine/helpers.js';
import { InsightCard, SectionHeader, InsightText, DeltaArrow } from './SummaryTab';
import { TrendingUp, TrendingDown, DollarSign, Zap } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const INR_FORMATTER = (v) => inr(v);
const PAYMENT_COLORS = ['#111827', '#2563eb', '#16a34a', '#d97706'];

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '0.625rem 0.875rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: '700', fontSize: '0.8rem', color: '#111827', marginBottom: '0.25rem' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#6B7280' }}>{p.name}:</span>
          <span style={{ fontWeight: '700', color: '#111827' }}>{typeof p.value === 'number' ? inr(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueTab() {
  const { analytics, insights } = useInsights();
  if (!analytics) return null;
  const { revenue, financial } = analytics;
  const revInsights = insights.filter(i => i.section === 'revenue' || i.section === 'financial');

  // Payment mode data for donut
  const paymentData = [
    { name: 'Cash',   value: revenue.cashRevenue },
    { name: 'UPI',    value: revenue.upiRevenue },
    { name: 'Card',   value: revenue.cardRevenue },
    { name: 'Other',  value: Math.max(0, revenue.totalRevenue - revenue.cashRevenue - revenue.upiRevenue - revenue.cardRevenue) },
  ].filter(d => d.value > 0);

  const topInsight = revInsights[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top insight banner */}
      {topInsight && (
        <InsightCard style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ fontSize: '1.5rem' }}>{topInsight.severity === 'celebration' ? '🚀' : topInsight.severity === 'critical' ? '🚨' : '💡'}</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fff', marginBottom: '0.25rem' }}>{topInsight.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{topInsight.body}</div>
            </div>
            <DeltaArrow value={revenue.revenueGrowthPct} size="lg" />
          </div>
        </InsightCard>
      )}

      {/* Revenue Trend Area Chart */}
      <InsightCard>
        <SectionHeader title="Revenue Trend" subtitle="Daily revenue with 7-day moving average" />
        {revenue.dailyRevenue.length >= 3 ? (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenue.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#111827" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
                <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<RevenueTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#111827" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                <Area type="monotone" dataKey="movingAvg" name="7-day avg" stroke="#2563eb" strokeWidth={1.5} fill="none" strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            {revenue.revenueGrowthPct !== 0 && (
              <InsightText
                text={`Revenue ${revenue.revenueGrowthPct > 0 ? 'grew' : 'declined'} ${Math.abs(revenue.revenueGrowthPct).toFixed(0)}% vs the previous period. Peak earning day: ${revenue.peakDay}. Lowest earning day: ${revenue.idleDay}.`}
                icon={revenue.revenueGrowthPct > 0 ? TrendingUp : TrendingDown}
                color={revenue.revenueGrowthPct > 0 ? '#16a34a' : '#dc2626'}
              />
            )}
          </>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>Not enough data for this period yet.</div>
        )}
      </InsightCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Day of Week */}
        <InsightCard>
          <SectionHeader title="Revenue by Day" subtitle="Which days generate the most income" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenue.dayOfWeekRevenue} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                {revenue.dayOfWeekRevenue.map((entry, idx) => (
                  <Cell key={idx} fill={entry.day === revenue.peakDay ? '#111827' : '#E5E7EB'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <InsightText text={`${revenue.peakDay} is your busiest day. ${revenue.idleDay} is the slowest — consider a midweek promotion.`} color="#374151" />
        </InsightCard>

        {/* Payment Mode Donut */}
        <InsightCard>
          <SectionHeader title="Payment Methods" subtitle="How customers are paying" />
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {paymentData.map((_, idx) => <Cell key={idx} fill={PAYMENT_COLORS[idx % PAYMENT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => inr(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
                </PieChart>
              </ResponsiveContainer>
              <InsightText text={`${revenue.cashPct.toFixed(0)}% cash, ${revenue.digitalPct.toFixed(0)}% digital. ${revenue.cashPct > 80 ? 'Encouraging digital payments reduces handling risk.' : 'Good digital payment adoption.'}`} color="#374151" />
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>No payment data for this period.</div>
          )}
        </InsightCard>
      </div>

      {/* Revenue Leakage */}
      {revenue.leakageData.estimatedMonthlyLeakage === 'More data needed' ? (
        <InsightCard style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ fontSize: '2rem', opacity: 0.5 }}>⏳</div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#374151', marginBottom: '0.25rem' }}>
                Revenue Leakage: More data needed
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6B7280', lineHeight: 1.5 }}>
                Cannot calculate accurate slot leakage for active/incomplete time periods. Please select a completed period (e.g., Last Month).
              </div>
            </div>
          </div>
        </InsightCard>
      ) : revenue.leakageData.estimatedMonthlyLeakage > 0 && (
        <InsightCard style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ fontSize: '2rem' }}>💸</div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#92400e', marginBottom: '0.25rem' }}>
                Revenue Leakage: Approximately {inr(revenue.leakageData.estimatedMonthlyLeakage)} / month
              </div>
              <div style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5 }}>
                Based on {revenue.leakageData.staffCount} staff working ~10h/day, your salon has approximately {Math.round(revenue.leakageData.emptySlots)} unfilled appointment slots this period. At your average bill of {inr(revenue.avgBillValue)}, that's potential revenue going uncaptured.
              </div>
            </div>
          </div>
        </InsightCard>
      )}

      {/* Revenue Forecast */}
      {revenue.forecast === 'More data needed' ? (
        <InsightCard>
          <SectionHeader title="7-Day Revenue Forecast" subtitle="Projected revenue based on historical day-of-week patterns" />
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: '8px' }}>
            More data needed
          </div>
          <InsightText text={`Cannot generate reliable forecasts for active/incomplete time periods. Please select a completed period (e.g., Last Month).`} color="#6B7280" />
        </InsightCard>
      ) : revenue.forecast.length > 0 && (
        <InsightCard>
          <SectionHeader title="7-Day Revenue Forecast" subtitle="Projected revenue based on historical day-of-week patterns" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenue.forecast} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="dayName" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="forecastRevenue" name="Forecast" fill="#dbeafe" stroke="#2563eb" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <InsightText text={`Forecast based on the last 4 occurrences of each day of the week, adjusted for recent growth trends. Actual results may vary.`} color="#2563eb" />
        </InsightCard>
      )}

      {/* Financial Summary */}
      {financial && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Net Profit',    value: inr(financial.netProfit),       color: financial.netProfit >= 0 ? '#16a34a' : '#dc2626' },
            { label: 'Profit Margin', value: `${financial.profitMarginPct.toFixed(0)}%`, color: financial.profitMarginPct >= 20 ? '#16a34a' : '#dc2626' },
            { label: 'Total Discount', value: inr(financial.totalDiscount),   color: '#d97706' },
            { label: 'GST Collected', value: inr(financial.gstCollected),    color: '#374151' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #F3F4F6', borderRadius: '10px', padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '0.73rem', color: '#6B7280', fontWeight: '600', marginBottom: '0.4rem' }}>{s.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
