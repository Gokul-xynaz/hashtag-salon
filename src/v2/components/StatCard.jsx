import React from 'react';

const StatCard = ({ 
  label, 
  value, 
  description, 
  icon: Icon, 
  accentColor = 'var(--v2-primary)', 
  accentBg = 'rgba(13, 148, 136, 0.1)' 
}) => {
  return (
    <div 
      className="v2-stat-card"
      style={{
        background: '#ffffff',
        border: '1px solid var(--v2-border)',
        borderRadius: '12px',
        padding: '1rem 1.1rem',
        position: 'relative',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Top Row: Label and Icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '0.6rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--v2-text-sub)'
        }}>
          {label}
        </span>
        {Icon && (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: accentBg,
            color: accentColor
          }}>
            <Icon size={14} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Middle Row: Primary Value */}
      <div style={{
        fontSize: '1.15rem',
        fontWeight: '800',
        color: 'var(--v2-text-main)',
        lineHeight: 1
      }}>
        {value}
      </div>

      {/* Bottom Row: Description */}
      {description && (
        <div style={{
          fontSize: '0.62rem',
          color: 'var(--v2-text-muted)'
        }}>
          {description}
        </div>
      )}

      {/* Bottom Accent Strip */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '1.1rem',
        height: '2px',
        width: '28px',
        background: accentColor,
        borderRadius: '2px 2px 0 0'
      }} />
    </div>
  );
};

export default StatCard;
