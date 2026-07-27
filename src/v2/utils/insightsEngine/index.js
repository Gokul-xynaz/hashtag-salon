// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Main Entry Point
// ═══════════════════════════════════════════════════════════════════
// Usage:
//   import { computeAnalytics } from './insightsEngine';
//   const analytics = computeAnalytics({ appointments, ... });
//   const insights  = runInsightEngine(analytics);
// ═══════════════════════════════════════════════════════════════════
export { getPeriodBounds, inr, fmtPct, DAY_NAMES, getSafeDate, getActualDate } from './helpers.js';
export { computeRevenue }    from './computeRevenue.js';
export { computeCustomers }  from './computeCustomers.js';
export { computeAppointments } from './computeAppointments.js';
export { computeStaff }      from './computeStaff.js';
export { computeServices }   from './computeServices.js';
export { computeInventory }  from './computeInventory.js';
export { computeFinancial }  from './computeFinancial.js';
export { computeHealth }     from './computeHealth.js';
export { runInsightEngine }  from './rules.js';

import { computeRevenue }      from './computeRevenue.js';
import { computeCustomers }    from './computeCustomers.js';
import { computeAppointments } from './computeAppointments.js';
import { computeStaff }        from './computeStaff.js';
import { computeServices }     from './computeServices.js';
import { computeInventory }    from './computeInventory.js';
import { computeFinancial }    from './computeFinancial.js';
import { computeHealth }       from './computeHealth.js';

/**
 * The master analytics computation function.
 * This is a pure function — same inputs always produce the same output.
 * Safe to call inside useMemo().
 *
 * @param {Object} params
 * @param {Array}  params.appointments      - Current period appointments
 * @param {Array}  params.priorAppointments - Prior period appointments (for MoM comparison)
 * @param {Array}  params.expenses          - Current period expenses
 * @param {Array}  params.priorExpenses     - Prior period expenses
 * @param {Array}  params.attendanceLogs    - Current period attendance_logs
 * @param {Array}  params.stylists          - Staff list from DataProvider
 * @param {Array}  params.products          - Products from DataProvider
 * @param {Array}  params.customers         - Customers from DataProvider
 * @param {Array}  params.services          - Services catalogue from DataProvider
 * @param {string} params.period            - Period key
 * @returns {Object} Full analytics object
 */
export function computeAnalytics({
  appointments      = [],
  priorAppointments = [],
  expenses          = [],
  priorExpenses     = [],
  attendanceLogs    = [],
  stylists          = [],
  products          = [],
  customers         = [],
  services          = [],
  period            = 'thisMonth',
  businessGoals     = { targetMonthlyRevenue: 500000, targetRetention: 60, targetUtilization: 70 },
}) {
  const revenue      = computeRevenue(appointments, priorAppointments, period);
  const custData     = computeCustomers(appointments, customers, period);
  const apptData     = computeAppointments(appointments);
  const staffData    = computeStaff(appointments, priorAppointments, attendanceLogs, stylists);
  const serviceData  = computeServices(appointments, priorAppointments, services);
  const inventoryData = computeInventory(products, appointments);
  const financialData = computeFinancial(appointments, expenses, priorAppointments, priorExpenses);

  // ── Revenue Leakage (requires staffCount from stylists) ──────────────
  const activeStaffCount = (stylists || []).filter(s =>
    s.isActive !== false && s.role !== 'admin' && s.role !== 'attendance_only' && s.role !== 'store_account'
  ).length || 1;
  const targetRevenuePerStaff = 2000; // Expected output per stylist per day
  const maxPossibleRevenue = activeStaffCount * targetRevenuePerStaff * 30; // ~monthly potential
  
  let revenueLeakage = 0;
  if (!['today', 'thisWeek', 'thisMonth', 'thisYear'].includes(period)) {
     revenueLeakage = maxPossibleRevenue - revenue.totalRevenue;
  } else {
     revenueLeakage = "More data needed";
  }


  const analytics = {
    revenue,
    customers:    custData,
    appointments: apptData,
    staff:        staffData,
    services:     serviceData,
    inventory:    inventoryData,
    financial:    financialData,
    revenueLeakage,
    health:       null, // computed last
    businessGoals,
    meta: { period, activeStaffCount, computedAt: new Date().toISOString() },
  };

  // Health score depends on all other sections
  analytics.health = computeHealth(analytics);

  return analytics;
}
