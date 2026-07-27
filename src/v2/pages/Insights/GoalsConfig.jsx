import React, { useState, useEffect } from 'react';
import { X, Save, TrendingUp, Users, Award } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { useInsights } from '../../../context/InsightsContext';

export default function GoalsConfig({ isOpen, onClose }) {
  const { businessGoals, setBusinessGoals, refresh } = useInsights();
  const [goals, setGoals] = useState({
    targetMonthlyRevenue: 500000,
    targetRetention: 60,
    targetUtilization: 70
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (businessGoals) {
      setGoals(businessGoals);
    }
  }, [businessGoals, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'business_goals'), goals);
      setBusinessGoals(goals);
      refresh(); // Refresh insights with new goals
      onClose();
    } catch (err) {
      console.error('Error saving goals:', err);
      alert('Failed to save business goals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', width: '90%', maxWidth: '420px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>Business Goals</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#6B7280' }}>Set targets for Insights generation</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#9CA3AF' }}>
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <TrendingUp size={14} color="#2563eb" /> Monthly Revenue Target (₹)
            </label>
            <input 
              type="number"
              value={goals.targetMonthlyRevenue}
              onChange={e => setGoals(g => ({ ...g, targetMonthlyRevenue: parseInt(e.target.value) || 0 }))}
              style={{
                width: '100%', padding: '0.625rem', borderRadius: '6px',
                border: '1px solid #D1D5DB', fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Users size={14} color="#16a34a" /> Target Retention Rate (%)
            </label>
            <input 
              type="number" min="0" max="100"
              value={goals.targetRetention}
              onChange={e => setGoals(g => ({ ...g, targetRetention: parseInt(e.target.value) || 0 }))}
              style={{
                width: '100%', padding: '0.625rem', borderRadius: '6px',
                border: '1px solid #D1D5DB', fontSize: '0.875rem'
              }}
            />
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF' }}>Industry standard: 60-70%</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Award size={14} color="#d97706" /> Staff Utilization Target (%)
            </label>
            <input 
              type="number" min="0" max="100"
              value={goals.targetUtilization}
              onChange={e => setGoals(g => ({ ...g, targetUtilization: parseInt(e.target.value) || 0 }))}
              style={{
                width: '100%', padding: '0.625rem', borderRadius: '6px',
                border: '1px solid #D1D5DB', fontSize: '0.875rem'
              }}
            />
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF' }}>Optimal utilization is 70-80%</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button 
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: '600', color: '#374151', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            style={{ 
              padding: '0.5rem 1rem', background: '#111827', border: 'none', borderRadius: '6px', 
              fontSize: '0.8125rem', fontWeight: '600', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem'
            }}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </div>
    </div>
  );
}
