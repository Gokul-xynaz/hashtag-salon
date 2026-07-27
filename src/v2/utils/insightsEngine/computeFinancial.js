// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Financial Computation
// ═══════════════════════════════════════════════════════════════════
import { isCompleted, getSafeDate, groupByMonth, linearMap } from './helpers.js';

/**
 * Computes financial intelligence (P&L, margins, expense breakdown).
 * @param {Array} appts         - Current period appointments
 * @param {Array} expenses      - Current period expenses
 * @param {Array} priorAppts    - Prior period appointments
 * @param {Array} priorExpenses - Prior period expenses
 * @returns {Object} financial analytics object
 */
export function computeFinancial(appts, expenses, priorAppts, priorExpenses) {
  const done      = appts.filter(isCompleted);
  const priorDone = priorAppts.filter(isCompleted);

  // ── Revenue ──────────────────────────────────────────────────────────
  const revenue      = done.reduce((s, a) => s + (a.totalAmount || 0), 0);
  const priorRevenue = priorDone.reduce((s, a) => s + (a.totalAmount || 0), 0);
  const revenueGrowthPct = priorRevenue > 0 ? ((revenue - priorRevenue) / priorRevenue) * 100 : 0;

  // ── Expenses ─────────────────────────────────────────────────────────
  const totalExpenses      = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const priorTotalExpenses = priorExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const expenseGrowthPct   = priorTotalExpenses > 0 ? ((totalExpenses - priorTotalExpenses) / priorTotalExpenses) * 100 : 0;

  // Expense by category
  const categoryMap = {};
  expenses.forEach(e => {
    const cat = e.category || 'Miscellaneous';
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
  });
  const expenseByCategory = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount, pct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const topExpenseCategory = expenseByCategory[0]?.category || '—';

  // ── Profit ───────────────────────────────────────────────────────────
  const netProfit      = revenue - totalExpenses;
  const priorNetProfit = priorRevenue - priorTotalExpenses;
  const profitMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const priorMarginPct  = priorRevenue > 0 ? (priorNetProfit / priorRevenue) * 100 : 0;
  const marginDelta     = profitMarginPct - priorMarginPct;
  const profitGrowthPct = priorNetProfit > 0 ? ((netProfit - priorNetProfit) / priorNetProfit) * 100 : 0;

  // Expense ratio (for health score)
  const expenseRatio     = revenue > 0 ? totalExpenses / revenue : 0;
  const expenseScore     = linearMap(1 - expenseRatio, 0.2, 0.7, 0, 100); // 0–100

  // ── Discounts & GST ──────────────────────────────────────────────────
  const totalDiscount  = done.reduce((s, a) => s + (a.discountAmount || a.discount || 0), 0);
  const discountPct    = revenue > 0 ? (totalDiscount / (revenue + totalDiscount)) * 100 : 0;
  const gstCollected   = done.reduce((s, a) => s + (a.gstAmount || 0), 0);

  // ── Monthly P&L (for 12-month bar chart) ─────────────────────────────
  // Group appointments and expenses by month
  const monthlyApptGroups = groupByMonth([...appts, ...priorAppts]);
  const monthlyExpMap = {};
  [...expenses, ...priorExpenses].forEach(e => {
    const d = getSafeDate(e.timestamp);
    if (!d) return;
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthlyExpMap[key]) monthlyExpMap[key] = { key, label, amount: 0 };
    monthlyExpMap[key].amount += Number(e.amount) || 0;
  });

  const monthlyPL = monthlyApptGroups.map(({ key, monthLabel, appointments: mAppts }) => {
    const mRevenue  = mAppts.filter(isCompleted).reduce((s, a) => s + (a.totalAmount || 0), 0);
    const mExpenses = monthlyExpMap[key]?.amount || 0;
    const mProfit   = mRevenue - mExpenses;
    return {
      month:    monthLabel,
      revenue:  mRevenue,
      expenses: mExpenses,
      profit:   mProfit,
      margin:   mRevenue > 0 ? (mProfit / mRevenue) * 100 : 0,
    };
  });

  // ── Profit milestones ─────────────────────────────────────────────────
  const MILESTONES = [10000, 25000, 50000, 75000, 100000, 150000, 200000, 500000];
  const crossedMilestones = MILESTONES.filter(m => netProfit >= m && priorNetProfit < m);

  return {
    // Totals
    revenue, priorRevenue, revenueGrowthPct,
    totalExpenses, priorTotalExpenses, expenseGrowthPct,
    netProfit, priorNetProfit, profitGrowthPct,
    profitMarginPct, priorMarginPct, marginDelta,
    expenseRatio, expenseScore,
    // Discounts & GST
    totalDiscount, discountPct, gstCollected,
    // Expense breakdown
    expenseByCategory, topExpenseCategory,
    // Monthly chart
    monthlyPL,
    // Milestones
    crossedMilestones,
  };
}
