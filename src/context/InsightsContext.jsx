// ═══════════════════════════════════════════════════════════════════
// JX Billing — InsightsContext
// Provides all computed analytics and insights to child components.
// ═══════════════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useData } from './DataProvider';
import { computeAnalytics, runInsightEngine, getPeriodBounds } from '../v2/utils/insightsEngine/index.js';

const InsightsContext = createContext(null);

export function InsightsProvider({ children }) {
  const { stylists, products, customers, services } = useData();

  const [period, setPeriod] = useState('thisMonth');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const [appointments,      setAppointments]      = useState([]);
  const [priorAppointments, setPriorAppointments] = useState([]);
  const [expenses,          setExpenses]          = useState([]);
  const [priorExpenses,     setPriorExpenses]     = useState([]);
  const [attendanceLogs,    setAttendanceLogs]    = useState([]);
  const [customersData,     setCustomersData]     = useState([]);
  const [businessGoals,     setBusinessGoals]     = useState(null);

  // Fetch all 5 data sources when period changes
  const fetchData = useCallback(async () => {
    const { start, end, priorStart, priorEnd } = getPeriodBounds(period);
    setLoading(true);
    setError(null);

    // Session cache key
    const cacheKey = `jx_insights_${period}_${start.toDateString()}`;
    const cached   = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { appts, priorAppts, exps, priorExps, att, custs, goals } = JSON.parse(cached);
        if (!custs) throw new Error("Cache missing customers data");
        setAppointments(appts);
        setPriorAppointments(priorAppts);
        setExpenses(exps);
        setPriorExpenses(priorExps);
        setAttendanceLogs(att);
        setCustomersData(custs);
        setBusinessGoals(goals || { targetMonthlyRevenue: 500000, targetRetention: 60, targetUtilization: 70 });
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    try {
      const tsStart      = Timestamp.fromDate(start);
      const tsEnd        = Timestamp.fromDate(end);
      const tsPriorStart = Timestamp.fromDate(priorStart);
      const tsPriorEnd   = Timestamp.fromDate(priorEnd);

      const [apptSnap, priorApptSnap, expSnap, priorExpSnap, attSnap, custSnap, goalsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'appointments'),
          where('timestamp', '>=', tsStart),
          where('timestamp', '<=', tsEnd),
          orderBy('timestamp', 'desc')
        )),
        getDocs(query(
          collection(db, 'appointments'),
          where('timestamp', '>=', tsPriorStart),
          where('timestamp', '<=', tsPriorEnd),
          orderBy('timestamp', 'desc')
        )),
        getDocs(query(
          collection(db, 'expenses'),
          where('timestamp', '>=', tsStart),
          where('timestamp', '<=', tsEnd)
        )),
        getDocs(query(
          collection(db, 'expenses'),
          where('timestamp', '>=', tsPriorStart),
          where('timestamp', '<=', tsPriorEnd)
        )),
        getDocs(query(
          collection(db, 'attendance_logs'),
          where('timestamp', '>=', tsStart),
          where('timestamp', '<=', tsEnd)
        )),
        getDocs(query(collection(db, 'customers'))),
        getDoc(doc(db, 'settings', 'business_goals'))
      ]);

      const appts      = apptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const priorAppts = priorApptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const exps       = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const priorExps  = priorExpSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const att        = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const custs      = custSnap ? custSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
      const goals      = goalsSnap?.exists?.() ? goalsSnap.data() : { targetMonthlyRevenue: 500000, targetRetention: 60, targetUtilization: 70 };

      setAppointments(appts);
      setPriorAppointments(priorAppts);
      setExpenses(exps);
      setPriorExpenses(priorExps);
      setAttendanceLogs(att);
      setCustomersData(custs);
      setBusinessGoals(goals);

      // Cache for 5 minutes (session only)
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ appts, priorAppts, exps, priorExps, att, custs, goals }));
      } catch { /* storage quota exceeded — ignore */ }

    } catch (err) {
      console.error('[InsightsContext] Fetch error:', err);
      setError(err.message || 'Failed to load insights data.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pure computation — reruns only when data or catalogue changes
  const analytics = useMemo(() => {
    if (loading || error || !businessGoals) return null;
    return computeAnalytics({
      appointments, priorAppointments, expenses, priorExpenses, attendanceLogs,
      stylists, products, customers: customersData, services, period, businessGoals
    });
  }, [loading, error, appointments, priorAppointments, expenses, priorExpenses, attendanceLogs, stylists, products, customersData, services, period, businessGoals]);

  // Insight engine — only reruns when analytics changes
  const insights = useMemo(() => {
    if (!analytics || !businessGoals) return [];
    try {
      return runInsightEngine(analytics, businessGoals);
    } catch (err) {
      console.error('[InsightsContext] Engine error:', err);
      return [];
    }
  }, [analytics, businessGoals]);

  // Top 5 action items from insights (critical + warning, max 5)
  const actionItems = useMemo(() =>
    insights
      .filter(i => ['critical', 'warning', 'opportunity'].includes(i.severity))
      .slice(0, 5),
    [insights]
  );

  // Smart notification banner (top 1 non-celebration, non-dismissible)
  const bannerInsight = useMemo(() =>
    insights.find(i => !i.dismissible && i.severity !== 'celebration') ||
    insights.find(i => i.severity === 'critical') ||
    null,
    [insights]
  );

  const refresh = useCallback(() => {
    // Clear cache and refetch
    const { start } = getPeriodBounds(period);
    const cacheKey = `jx_insights_${period}_${start.toDateString()}`;
    sessionStorage.removeItem(cacheKey);
    fetchData();
  }, [fetchData, period]);

  return (
    <InsightsContext.Provider value={{
      analytics, insights, actionItems, bannerInsight,
      period, setPeriod,
      loading, error,
      refresh,
      businessGoals, setBusinessGoals,
    }}>
      {children}
    </InsightsContext.Provider>
  );
}

export function useInsights() {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error('useInsights must be used inside InsightsProvider');
  return ctx;
}
