import React from 'react';
import { X, Download } from 'lucide-react';

export default function DataGridModal({ isOpen, onClose, title, subtitle, data, columns, onExport }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '2rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>{title}</h2>
            {subtitle && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6B7280' }}>{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {onExport && (
              <button 
                onClick={onExport}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem', background: '#F9FAFB', border: '1px solid #E5E7EB',
                  borderRadius: '6px', fontSize: '0.875rem', fontWeight: '600', color: '#374151',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} /> Export CSV
              </button>
            )}
            <button 
              onClick={onClose}
              style={{
                background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer',
                color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '0' }}>
          {data && data.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                <tr>
                  {columns.map((col, i) => (
                    <th key={i} style={{ padding: '0.75rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', fontWeight: '600', borderBottom: '1px solid #E5E7EB' }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {columns.map((col, j) => (
                      <td key={j} style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                        {col.render ? col.render(row) : row[col.accessor]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>
              No data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
