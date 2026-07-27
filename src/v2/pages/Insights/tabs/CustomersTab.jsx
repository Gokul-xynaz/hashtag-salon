// Customer Intelligence Tab
import React, { useState } from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { inr } from '../../../utils/insightsEngine/helpers.js';
import { InsightCard, SectionHeader, InsightText, DeltaArrow } from './SummaryTab';
import { Users, UserMinus, Star, Gift, ChevronRight, AlertCircle, ShieldAlert, Phone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { exportToCSV } from '../../../utils/exportToCSV';
import DataGridModal from '../../../components/DataGridModal';

function AtRiskCohort({ title, customers, color, days }) {
  const [expanded, setExpanded] = React.useState(false);
  const preview = customers.slice(0, 3);
  const rest    = customers.slice(3);

  if (customers.length === 0) return (
    <div style={{ background: '#F9FAFB', borderRadius: '10px', border: '1px solid #F3F4F6', padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>No at-risk customers for {days}d</div>
    </div>
  );

  return (
    <div style={{ background: color + '08', borderRadius: '10px', border: `1px solid ${color}22`, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserMinus size={15} color={color} strokeWidth={2} />
          <span style={{ fontWeight: '700', fontSize: '0.8125rem', color: '#111827' }}>{title}</span>
        </div>
        <span style={{ background: color, color: '#fff', borderRadius: '99px', padding: '0.15rem 0.625rem', fontSize: '0.72rem', fontWeight: '700' }}>
          {customers.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {preview.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ color: '#111827', fontWeight: '500' }}>{c.name}</span>
            <span style={{ color: '#9CA3AF' }}>{c.daysInactive}d ago</span>
          </div>
        ))}
        {rest.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} style={{ fontSize: '0.75rem', color: color, background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', fontWeight: '600', textAlign: 'left' }}>
            {expanded ? 'Show less' : `+${rest.length} more`}
          </button>
        )}
        {expanded && rest.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ color: '#111827', fontWeight: '500' }}>{c.name}</span>
            <span style={{ color: '#9CA3AF' }}>{c.daysInactive}d ago</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// (Keep existing components like SectionHeader, InsightCard, InsightText, InsightBanner, RiskList)...

export default function CustomersTab() {
  const { analytics } = useInsights();
  const [modalOpen, setModalOpen] = useState(false);

  if (!analytics) return null;
  const { customers } = analytics;

  const handleExport = () => {
    const data = [
      ...customers.atRisk30.map(c => ({ ...c, riskLevel: '30+ Days' })),
      ...customers.atRisk60.map(c => ({ ...c, riskLevel: '60+ Days' })),
      ...customers.atRisk90.map(c => ({ ...c, riskLevel: '90+ Days' }))
    ];
    exportToCSV(data, [
      { header: 'Name', accessor: 'name' },
      { header: 'Phone', accessor: 'phone' },
      { header: 'Days Inactive', accessor: 'daysInactive' },
      { header: 'Total Spent', accessor: 'totalSpent' },
      { header: 'Risk Level', accessor: 'riskLevel' }
    ], 'at-risk-customers.csv');
  };

  const getAtRiskData = () => {
    return [
      ...customers.atRisk30.map(c => ({ ...c, riskLevel: '30+ Days' })),
      ...customers.atRisk60.map(c => ({ ...c, riskLevel: '60+ Days' })),
      ...customers.atRisk90.map(c => ({ ...c, riskLevel: '90+ Days' }))
    ];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Retention Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Customers', value: customers.totalCustomers, color: '#111827' },
          { label: 'Return Rate',     value: `${customers.retentionRate.toFixed(0)}%`, color: customers.retentionRate >= 50 ? '#16a34a' : '#d97706' },
          { label: 'At-Risk Total',   value: customers.totalAtRisk, color: customers.totalAtRisk > 10 ? '#dc2626' : '#374151', isClickable: true },
          { label: 'Avg LTV',         value: typeof customers.estimatedCLV === 'string' ? customers.estimatedCLV : inr(customers.estimatedCLV || 0), color: typeof customers.estimatedCLV === 'string' ? '#6B7280' : '#2563eb' },
        ].map(s => (
          <div 
            key={s.label} 
            onClick={() => s.isClickable ? setModalOpen(true) : null}
            style={{ 
              background: '#fff', border: '1px solid #F3F4F6', borderRadius: '10px', 
              padding: '0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              cursor: s.isClickable ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              ...(s.isClickable ? { '&:hover': { borderColor: '#E5E7EB', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' } } : {})
            }}
          >
            <div style={{ fontSize: '0.73rem', color: '#6B7280', fontWeight: '600', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
              {s.label}
              {s.isClickable && <span style={{ color: '#2563eb', fontSize: '0.65rem' }}>View List</span>}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <DataGridModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="At-Risk Customers"
        subtitle="Customers who haven't visited recently and are at risk of churning."
        data={getAtRiskData()}
        onExport={handleExport}
        columns={[
          { header: 'Name', accessor: 'name' },
          { header: 'Phone', accessor: 'phone' },
          { header: 'Days Inactive', accessor: 'daysInactive' },
          { header: 'Total Spent', accessor: 'totalSpent', render: (row) => inr(row.totalSpent) },
          { header: 'Risk Level', accessor: 'riskLevel', render: (row) => (
            <span style={{ 
              padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
              background: row.riskLevel.includes('90') ? '#fee2e2' : row.riskLevel.includes('60') ? '#fef3c7' : '#F3F4F6',
              color: row.riskLevel.includes('90') ? '#dc2626' : row.riskLevel.includes('60') ? '#d97706' : '#374151'
            }}>
              {row.riskLevel}
            </span>
          )}
        ]}
      />

      {/* New vs Returning Chart */}
      <InsightCard>
        <SectionHeader title="New vs Returning Customers" subtitle="Monthly breakdown of customer loyalty" />
        {customers.monthlyCustomerData.length >= 2 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={customers.monthlyCustomerData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
                <Bar dataKey="returning"    name="Returning" stackId="a" fill="#111827" radius={[0, 0, 0, 0]} />
                <Bar dataKey="newCustomers" name="New"       stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <InsightText
              text={`${customers.retentionRate.toFixed(0)}% of customers returned this period. ${customers.retentionRate >= 50 ? 'Strong loyalty — your regulars love you.' : 'Focus on follow-up messages after each visit to improve this.'}`}
              color={customers.retentionRate >= 50 ? '#16a34a' : '#d97706'}
            />
          </>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>Need more history for this chart. Try selecting a longer period.</div>
        )}
      </InsightCard>

      {/* At-Risk Cohorts */}
      <InsightCard>
        <SectionHeader title="At-Risk Customers" subtitle="Customers who haven't visited recently — sorted by lifetime value" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <AtRiskCohort title="30-Day Inactive" customers={customers.atRisk30} color="#d97706" days={30} />
          <AtRiskCohort title="60-Day Inactive" customers={customers.atRisk60} color="#dc2626" days={60} />
          <AtRiskCohort title="90+ Day Inactive" customers={customers.atRisk90} color="#7c3aed" days={90} />
        </div>
        {customers.totalAtRisk > 0 && (
          <InsightText
            text={`${customers.totalAtRisk} customers have gone quiet. A personalised message mentioning their favourite service has a much higher recall rate than generic promotions.`}
            icon={AlertCircle}
            color="#d97706"
          />
        )}
      </InsightCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* VIP Leaderboard */}
        <InsightCard>
          <SectionHeader title="VIP Customers" subtitle="Top spenders by lifetime value" />
          {customers.vipCustomers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {customers.vipCustomers.slice(0, 6).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < 5 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontWeight: '800', fontSize: '0.75rem', color: i < 3 ? '#d97706' : '#9CA3AF', width: '18px' }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.82rem', color: '#111827' }}>{c.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{c.totalVisits} visits</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.82rem', color: '#111827' }}>{inr(c.totalSpent)}</div>
                    {c.isAtRisk && <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: '600' }}>At risk</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>No customer spending data available yet.</div>
          )}
        </InsightCard>

        {/* Birthday Customers */}
        <InsightCard>
          <SectionHeader title="Birthdays This Month" subtitle="Customers who appreciate a personal touch" />
          {customers.birthdayCustomers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {customers.birthdayCustomers.slice(0, 8).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < customers.birthdayCustomers.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem' }}>🎂</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.82rem', color: '#111827' }}>{c.name}</div>
                    {c.phone && <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{c.phone}</div>}
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#d97706' }}>Day {c.day}</div>
                </div>
              ))}
              <InsightText
                text="A birthday greeting with a small complimentary service or discount converts casual visitors into loyal customers."
                icon={Gift}
                color="#d97706"
              />
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎂</div>
              No birthdays on record this month. Add customer DOB while billing to enable this.
            </div>
          )}
        </InsightCard>
      </div>
    </div>
  );
}
