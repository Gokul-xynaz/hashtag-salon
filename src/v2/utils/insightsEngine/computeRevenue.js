// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Revenue Computation
// ═══════════════════════════════════════════════════════════════════
import {
  isCompleted, getAllItems, getProductTotal,
  groupByDate, groupByDayOfWeek, groupByHour, groupByMonth,
  DAY_NAMES, growthToScore,
} from './helpers.js';

/**
 * Computes all revenue-related metrics for the current and prior period.
 * @param {Array} appts - Current period completed appointments
 * @param {Array} priorAppts - Prior period appointments (for comparison)
 * @param {string} period - The time period being analyzed
 * @returns {Object} revenue analytics object
 */
export function computeRevenue(appts, priorAppts, period = 'thisMonth') {
  const done      = appts.filter(isCompleted);
  const priorDone = priorAppts.filter(isCompleted);

  // ── Totals ──────────────────────────────────────────────────────────
  const totalRevenue      = done.reduce((s, a) => s + (a.totalAmount || 0), 0);
  const priorRevenue      = priorDone.reduce((s, a) => s + (a.totalAmount || 0), 0);
  const productRevenue    = done.reduce((s, a) => s + getProductTotal(a), 0);
  const serviceRevenue    = totalRevenue - productRevenue;
  const totalBills        = done.length;
  const priorBills        = priorDone.length;
  const avgBillValue      = totalBills > 0 ? totalRevenue / totalBills : 0;
  const priorAvgBill      = priorBills > 0 ? priorRevenue / priorBills : 0;

  // ── Growth ──────────────────────────────────────────────────────────
  const revenueGrowthPct  = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0;
  const avgBillGrowthPct  = priorAvgBill  > 0 ? ((avgBillValue - priorAvgBill) / priorAvgBill) * 100 : 0;
  const billGrowthPct     = priorBills    > 0 ? ((totalBills   - priorBills)   / priorBills)   * 100 : 0;
  const revenueScore      = growthToScore(revenueGrowthPct); // 0–100

  // ── Cross-Sell Velocity ─────────────────────────────────────────────
  // Percentage of bills with > 1 item (multi-service or service + product)
  const multiItemBills    = done.filter(a => getAllItems(a).length > 1).length;
  const crossSellVelocity = totalBills > 0 ? (multiItemBills / totalBills) * 100 : 0;

  // ── Payment modes ────────────────────────────────────────────────────
  const cashRevenue = done.filter(a => (a.paymentType || 'cash').toLowerCase() === 'cash')
    .reduce((s, a) => s + (a.totalAmount || 0), 0);
  const digitalRevenue = totalRevenue - cashRevenue;
  const cashPct    = totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0;
  const digitalPct = 100 - cashPct;

  // UPI vs Card breakdown (best effort)
  const upiRevenue  = done.filter(a => ['upi', 'online'].includes((a.paymentType || '').toLowerCase()))
    .reduce((s, a) => s + (a.totalAmount || 0), 0);
  const cardRevenue = done.filter(a => a.paymentType?.toLowerCase() === 'card')
    .reduce((s, a) => s + (a.totalAmount || 0), 0);

  // ── Discounts ────────────────────────────────────────────────────────
  const totalDiscount     = done.reduce((s, a) => s + (a.discountAmount || a.discount || 0), 0);
  const discountPct       = totalRevenue > 0 ? (totalDiscount / (totalRevenue + totalDiscount)) * 100 : 0;
  const priorDiscount     = priorDone.reduce((s, a) => s + (a.discountAmount || a.discount || 0), 0);

  // ── GST ─────────────────────────────────────────────────────────────
  const gstCollected      = done.reduce((s, a) => s + (a.gstAmount || 0), 0);

  // ── By day of week ───────────────────────────────────────────────────
  const byDayOfWeek = groupByDayOfWeek(done);
  const dayOfWeekRevenue = DAY_NAMES.map((name, idx) => ({
    day: name,
    dayIdx: idx,
    revenue: byDayOfWeek[idx].reduce((s, a) => s + (a.totalAmount || 0), 0),
    count:   byDayOfWeek[idx].length,
  }));
  const peakDay = [...dayOfWeekRevenue].sort((a, b) => b.revenue - a.revenue)[0]?.day || '—';
  const idleDay = [...dayOfWeekRevenue].filter(d => d.count > 0).sort((a, b) => a.revenue - b.revenue)[0]?.day || '—';

  const weekendRevenue  = (byDayOfWeek[0].concat(byDayOfWeek[6])).reduce((s, a) => s + (a.totalAmount || 0), 0);
  const weekdayRevenue  = totalRevenue - weekendRevenue;
  const weekendPct      = totalRevenue > 0 ? (weekendRevenue / totalRevenue) * 100 : 0;

  // ── By hour of day ───────────────────────────────────────────────────
  const byHour = groupByHour(done);
  const hourOfDayRevenue = Object.entries(byHour).map(([hour, appts]) => ({
    hour: Number(hour),
    label: Number(hour) === 0 ? '12am' : Number(hour) < 12 ? `${hour}am` : Number(hour) === 12 ? '12pm' : `${Number(hour) - 12}pm`,
    revenue: appts.reduce((s, a) => s + (a.totalAmount || 0), 0),
    count: appts.length,
  }));
  const peakHour = [...hourOfDayRevenue].sort((a, b) => b.revenue - a.revenue)[0]?.label || '—';

  // ── Daily trend (for area chart) ─────────────────────────────────────
  const byDate = groupByDate(done);
  const dailyRevenue = byDate.map(({ dateLabel, appointments: dAppts }) => ({
    date: dateLabel,
    revenue: dAppts.reduce((s, a) => s + (a.totalAmount || 0), 0),
    bills:   dAppts.length,
  }));

  // 7-day moving average on dailyRevenue
  const dailyRevenueWithMA = dailyRevenue.map((d, i) => {
    const window = dailyRevenue.slice(Math.max(0, i - 6), i + 1);
    const avg    = window.reduce((s, x) => s + x.revenue, 0) / window.length;
    return { ...d, movingAvg: Math.round(avg) };
  });

  // ── Monthly trend (for P&L chart) ────────────────────────────────────
  const byMonth = groupByMonth([...appts, ...priorAppts]);
  const monthlyRevenue = byMonth.map(({ monthLabel, appointments: mAppts }) => ({
    month:   monthLabel,
    revenue: mAppts.filter(isCompleted).reduce((s, a) => s + (a.totalAmount || 0), 0),
    bills:   mAppts.filter(isCompleted).length,
  }));

  // ── Revenue leakage estimator ─────────────────────────────────────────
  // Assumptions: 10h working day, 30min avg slot
  const completedAppts = done.length;
  const periodDays     = byDate.length || 1;
  const avgApptPerDay  = completedAppts / periodDays;
  // We don't know staff count exactly from appointments, but we know stylists
  // This will be properly merged in computeAnalytics using stylists count
  const leakageData = {
    avgApptPerDay,
    periodDays,
    avgBillValue,
    // Requires staffCount from outside — set placeholder; merged in index.js
    estimatedMonthlyLeakage: null,
  };

  // ── 7-day revenue forecast ────────────────────────────────────────────
  // For each of next 7 days: avg of last 4 occurrences of that weekday
  const today = new Date();
  let forecast = [];
  
  if (['thisWeek', 'thisMonth', 'thisYear'].includes(period)) {
    // Accuracy Guardrail: Do not generate speculative forecast for incomplete periods.
    forecast = 'More data needed';
  } else {
    for (let d = 1; d <= 7; d++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + d);
      const targetDow = futureDate.getDay();

      // Find last 4 occurrences of this weekday in historical data
      const sameWeekdays = dailyRevenue
        .filter((_, idx) => {
          const entry = byDate[idx];
          if (!entry) return false;
          const dt = new Date(entry.key);
          return dt.getDay() === targetDow;
        })
        .slice(-4);

      const avgRev = sameWeekdays.length > 0
        ? sameWeekdays.reduce((s, x) => s + x.revenue, 0) / sameWeekdays.length
        : avgBillValue * avgApptPerDay;

      // Apply growth factor
      const growthFactor = 1 + (revenueGrowthPct / 100) * (1 / 30); // per-day fraction of monthly growth
      forecast.push({
        date: futureDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        forecastRevenue: Math.round(avgRev * growthFactor),
        dayName: DAY_NAMES[targetDow],
      });
    }
  }

  return {
    // Totals
    totalRevenue, priorRevenue, productRevenue, serviceRevenue,
    totalBills, priorBills, avgBillValue, priorAvgBill,
    // Growth
    revenueGrowthPct, avgBillGrowthPct, billGrowthPct, revenueScore, crossSellVelocity,
    // Payments
    cashRevenue, digitalRevenue, upiRevenue, cardRevenue,
    cashPct, digitalPct,
    // Discounts & GST
    totalDiscount, discountPct, priorDiscount, gstCollected,
    // Temporal breakdowns
    dayOfWeekRevenue, peakDay, idleDay, weekendRevenue, weekdayRevenue, weekendPct,
    hourOfDayRevenue, peakHour,
    dailyRevenue: dailyRevenueWithMA,
    monthlyRevenue,
    // Leakage
    leakageData,
    // Forecast
    forecast,
  };
}
