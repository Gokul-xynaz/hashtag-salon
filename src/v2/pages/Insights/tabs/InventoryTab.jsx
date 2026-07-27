// Inventory Intelligence Tab
import React, { useState } from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { inr } from '../../../utils/insightsEngine/helpers.js';
import { InsightCard, SectionHeader, InsightText } from './SummaryTab';
import { Package, AlertCircle, Archive, Zap, PackageOpen, Tag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { exportToCSV } from '../../../utils/exportToCSV';
import DataGridModal from '../../../components/DataGridModal';

const URGENCY_COLORS = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' };

export default function InventoryTab() {
  const { analytics } = useInsights();
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [deadStockModalOpen, setDeadStockModalOpen] = useState(false);

  if (!analytics) return null;
  const { inventory } = analytics;

  const handleExport = (data, type, filename) => {
    exportToCSV(data, [
      { header: 'Name', accessor: 'name' },
      { header: 'Current Stock', accessor: 'stock' },
      ...(type === 'restock' ? [
        { header: 'Days Left', accessor: 'daysOfStockLeft' },
        { header: 'Suggested Reorder', accessor: 'suggestedReorderQty' },
        { header: 'Urgency', accessor: 'urgency' }
      ] : [
        { header: 'Retail Price', accessor: 'retailPrice' },
        { header: 'Total Value', accessor: 'stockValue' },
        { header: 'Days Inactive', accessor: 'daysInactive' }
      ])
    ], filename);
  };

  if (!inventory.totalProducts) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
        <Package size={32} strokeWidth={1.5} style={{ marginBottom: '0.75rem' }} />
        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>No inventory data</div>
        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Add products to your inventory to see intelligence here.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Products',   value: inventory.totalProducts,          color: '#111827' },
          { label: 'Stock Value',      value: inr(inventory.totalStockValue),   color: '#16a34a' },
          { label: 'Low Stock Items',  value: inventory.lowStockItems.length,   color: inventory.lowStockItems.length > 0 ? '#dc2626' : '#16a34a' },
          { label: 'Reorder Alerts',   value: inventory.reorderAlerts.length,   color: inventory.reorderAlerts.length > 0 ? '#d97706' : '#16a34a', isClickable: true, onClick: () => setReorderModalOpen(true) },
        ].map(s => (
          <div 
            key={s.label} 
            onClick={s.onClick ? s.onClick : null}
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

      {/* Reorder Alerts */}
      {inventory.reorderAlerts.length > 0 && (
        <InsightCard style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <SectionHeader title="🔔 Restock Alerts" subtitle="Products that need reordering soon based on current sell rate" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {inventory.reorderAlerts.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', background: URGENCY_COLORS[p.urgency] + '12', borderRadius: '8px', border: `1px solid ${URGENCY_COLORS[p.urgency]}22` }}>
                <AlertCircle size={14} color={URGENCY_COLORS[p.urgency]} strokeWidth={2} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.82rem', color: '#111827' }}>{p.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                    {p.stock} units left — {p.daysOfStockLeft} days remaining at current rate
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.82rem', color: URGENCY_COLORS[p.urgency] }}>
                    {p.urgency === 'critical' ? 'Order Now' : 'Reorder Soon'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>Suggest: {p.suggestedReorderQty} units</div>
                </div>
              </div>
            ))}
          </div>
        </InsightCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Fast Movers */}
        <InsightCard>
          <SectionHeader title="Fast Movers" subtitle="Best-selling products by units sold" />
          {inventory.fastMovers.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={inventory.fastMovers.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} tickLine={false} axisLine={false} width={80}
                    tickFormatter={v => v.length > 12 ? v.slice(0, 10) + '…' : v}
                  />
                  <Tooltip formatter={(v) => `${v} units`} />
                  <Bar dataKey="unitsSold" name="Units Sold" radius={[0, 4, 4, 0]}>
                    {inventory.fastMovers.slice(0, 8).map((_, i) => <Cell key={i} fill={i === 0 ? '#16a34a' : '#E5E7EB'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <InsightText text={`"${inventory.fastMovers[0]?.name}" is your fastest-moving product. Ensure adequate stock to avoid running out.`} icon={Zap} color="#16a34a" />
            </>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>No product sales recorded this period.</div>
          )}
        </InsightCard>

        {/* Dead Stock */}
        <InsightCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <SectionHeader title="Dead Stock" subtitle="Products not sold in 90+ days with stock remaining" />
            <button 
              onClick={() => setDeadStockModalOpen(true)}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', cursor: 'pointer' }}
            >
              View All
            </button>
          </div>
          {inventory.deadStockItems.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {inventory.deadStockItems.slice(0, 6).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.82rem', color: '#111827' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{p.stock} units • {inr(p.retailPrice)} each</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.82rem', color: '#d97706' }}>{inr(p.stockValue)}</div>
                      <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>Tied up capital</div>
                    </div>
                  </div>
                ))}
              </div>
              <InsightText
                text={`${inr(inventory.deadStockItems.reduce((s, p) => s + p.stockValue, 0))} worth of capital is sitting in unsold stock. A bundle promotion or staff incentive could convert these.`}
                icon={Archive}
                color="#d97706"
              />
            </>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#16a34a', fontSize: '0.82rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
              No dead stock. All products are selling regularly.
            </div>
          )}
        </InsightCard>
      </div>

      {/* Top Revenue Products */}
      {inventory.topByRevenue.length > 0 && (
        <InsightCard>
          <SectionHeader title="Top Products by Revenue" subtitle="Highest-earning retail products this period" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {inventory.topByRevenue.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: i < 4 ? '1px solid #F9FAFB' : 'none' }}>
                <span style={{ fontWeight: '800', fontSize: '0.75rem', color: i < 3 ? '#d97706' : '#9CA3AF', width: '20px' }}>#{i+1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.82rem', color: '#111827' }}>{p.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{p.unitsSold} units sold</div>
                </div>
                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#16a34a' }}>{inr(p.revenue)}</div>
              </div>
            ))}
          </div>
        </InsightCard>
      )}

      {/* Modals */}
      <DataGridModal
        isOpen={reorderModalOpen}
        onClose={() => setReorderModalOpen(false)}
        title="Restock Required"
        subtitle="Products below minimum safe stock levels"
        data={inventory.restockItems}
        onExport={() => handleExport(inventory.restockItems, 'restock', 'restock-report.csv')}
        columns={[
          { header: 'Product', accessor: 'name' },
          { header: 'Current Stock', accessor: 'stock' },
          { header: 'Days Left', accessor: 'daysOfStockLeft' },
          { header: 'Suggested Reorder', accessor: 'suggestedReorderQty' },
          { header: 'Status', accessor: 'urgency', render: (row) => (
            <span style={{ color: URGENCY_COLORS[row.urgency], fontWeight: '600' }}>
              {row.urgency === 'critical' ? 'Critical' : 'Warning'}
            </span>
          )}
        ]}
      />

      <DataGridModal
        isOpen={deadStockModalOpen}
        onClose={() => setDeadStockModalOpen(false)}
        title="Dead Stock"
        subtitle="Products not sold in 90+ days"
        data={inventory.deadStockItems}
        onExport={() => handleExport(inventory.deadStockItems, 'dead', 'dead-stock-report.csv')}
        columns={[
          { header: 'Product', accessor: 'name' },
          { header: 'Current Stock', accessor: 'stock' },
          { header: 'Retail Price', accessor: 'retailPrice', render: (row) => inr(row.retailPrice) },
          { header: 'Total Value', accessor: 'stockValue', render: (row) => inr(row.stockValue) },
          { header: 'Days Inactive', accessor: 'daysInactive' }
        ]}
      />
    </div>
  );
}
