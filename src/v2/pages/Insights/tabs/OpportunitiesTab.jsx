// Opportunities Tab — All ranked insights, actionable recommendations
import React, { useState } from 'react';
import { useInsights } from '../../../../context/InsightsContext';
import { SEVERITY_CONFIG } from '../constants.js';
import { Filter, ExternalLink, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../../../utils/exportToCSV';

const SECTIONS = ['all', 'revenue', 'customers', 'appointments', 'staff', 'services', 'inventory', 'financial'];
const SECTION_LABELS = { all: 'All', revenue: 'Revenue', customers: 'Customers', appointments: 'Appointments', staff: 'Staff', services: 'Services', inventory: 'Inventory', financial: 'Financial' };

const SEVERITIES = ['all', 'critical', 'warning', 'opportunity', 'celebration', 'info'];
const SEV_LABELS = { all: 'All', critical: '🚨 Critical', warning: '⚠️ Warning', opportunity: '💡 Opportunity', celebration: '🎉 Win', info: 'ℹ️ Info' };

export default function OpportunitiesTab() {
  const { insights } = useInsights();
  const [sectionFilter, setSectionFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dismissed, setDismissed] = useState({});
  const navigate = useNavigate();

  const filtered = insights.filter(i => {
    if (dismissed[i.id]) return false;
    if (sectionFilter !== 'all' && i.section !== sectionFilter) return false;
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    return true;
  });

  const critCount = insights.filter(i => i.severity === 'critical').length;
  const warnCount = insights.filter(i => i.severity === 'warning').length;
  const oppCount  = insights.filter(i => i.severity === 'opportunity').length;
  const celebCount = insights.filter(i => i.severity === 'celebration').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Score summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Critical Issues',    value: critCount,   color: '#dc2626', bg: '#fee2e2' },
          { label: 'Warnings',           value: warnCount,   color: '#d97706', bg: '#fef3c7' },
          { label: 'Opportunities',      value: oppCount,    color: '#2563eb', bg: '#dbeafe' },
          { label: 'Wins to Celebrate',  value: celebCount,  color: '#16a34a', bg: '#dcfce7' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: '0.875rem', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.73rem', fontWeight: '600', color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters & Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={14} color="#6B7280" strokeWidth={2} />
          {/* Section filter */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {SECTIONS.map(s => (
              <button
                key={s}
                onClick={() => setSectionFilter(s)}
                style={{
                  padding: '0.3rem 0.625rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: sectionFilter === s ? '#111827' : '#fff',
                  borderColor: sectionFilter === s ? '#111827' : '#E5E7EB',
                  color: sectionFilter === s ? '#fff' : '#6B7280',
                }}
              >{SECTION_LABELS[s]}</button>
            ))}
          </div>
          <div style={{ width: '1px', height: '20px', background: '#E5E7EB' }} />
          {/* Severity filter */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {SEVERITIES.map(sv => (
              <button
                key={sv}
                onClick={() => setSeverityFilter(sv)}
                style={{
                  padding: '0.3rem 0.625rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s ease',
                  background: severityFilter === sv ? (SEVERITY_CONFIG[sv]?.color || '#111827') : '#fff',
                  borderColor: severityFilter === sv ? (SEVERITY_CONFIG[sv]?.color || '#111827') : '#E5E7EB',
                  color: severityFilter === sv ? '#fff' : '#6B7280',
                }}
              >{SEV_LABELS[sv]}</button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => {
            exportToCSV(filtered, [
              { header: 'Severity', accessor: 'severity' },
              { header: 'Section', accessor: 'section' },
              { header: 'Title', accessor: 'title' },
              { header: 'Details', accessor: 'body' }
            ], 'opportunities.csv');
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.75rem', background: '#F9FAFB', border: '1px solid #E5E7EB',
            borderRadius: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151',
            cursor: 'pointer'
          }}
        >
          <Download size={14} strokeWidth={2} /> Export CSV
        </button>
      </div>

      {/* Insights list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉</div>
          <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>All clear for this filter!</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>No issues found matching your current filters.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map((ins, i) => {
            const { color, bg, Icon } = SEVERITY_CONFIG[ins.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                key={ins.id}
                className="insight-card"
                style={{ animationDelay: `${i * 30}ms`, padding: '1rem', background: bg, borderRadius: '10px', border: `1px solid ${color}22`, display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={color} strokeWidth={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#111827', marginBottom: '0.25rem' }}>{ins.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#374151', lineHeight: 1.5 }}>{ins.body}</div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '600', color, background: color + '18', padding: '0.1rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {ins.section}
                    </span>
                    {ins.action && (
                      <button
                        onClick={() => ins.actionRoute && navigate(ins.actionRoute)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: '600', color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {ins.action}
                        <ExternalLink size={11} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
                {ins.dismissible !== false && (
                  <button
                    onClick={() => setDismissed(prev => ({ ...prev, [ins.id]: true }))}
                    title="Dismiss"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '1rem', lineHeight: 1, padding: '0.25rem', flexShrink: 0 }}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
