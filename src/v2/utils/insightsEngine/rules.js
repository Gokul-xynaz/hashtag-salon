// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Rule-Based Recommendation Engine
// ═══════════════════════════════════════════════════════════════════
// Each rule is a pure function: (analytics) => Insight | null
// Returning null means the rule's trigger condition is not met.
// ═══════════════════════════════════════════════════════════════════
import { inr } from './helpers.js';

// ── Insight factory ──────────────────────────────────────────────────
const insight = (id, severity, icon, section, title, body, action, actionRoute, priority, dismissible = true) => ({
  id, severity, icon, section, title, body,
  action: action || null,
  actionRoute: actionRoute || null,
  priority,
  dismissible,
});

// ════════════════════════════════════════════════════════════════════
// REVENUE RULES
// ════════════════════════════════════════════════════════════════════

const revCriticalDrop = (a) => {
  if (!a.revenue) return null;
  const pct = a.revenue.revenueGrowthPct;
  if (pct > -20) return null;
  return insight(
    'rev.critical_drop', 'critical', 'TrendingDown', 'revenue',
    'Revenue dropped sharply this period',
    `Revenue fell ${Math.abs(pct).toFixed(0)}% vs the previous period (${inr(a.revenue.priorRevenue)} → ${inr(a.revenue.totalRevenue)}). Review cancellations, staffing, and busy day patterns.`,
    'View Revenue Details', '/v2/insights', 1, false
  );
};

const revModerateDrop = (a) => {
  if (!a.revenue) return null;
  const pct = a.revenue.revenueGrowthPct;
  if (pct <= -20 || pct > -8) return null;
  return insight(
    'rev.moderate_drop', 'warning', 'TrendingDown', 'revenue',
    'Revenue is slightly lower this period',
    `Revenue is down ${Math.abs(pct).toFixed(0)}% compared to last period. Check if slow weekdays or increased cancellations are contributing.`,
    'Check Appointments', '/v2/insights', 5
  );
};

const revStrongGrowth = (a) => {
  if (!a.revenue) return null;
  const pct = a.revenue.revenueGrowthPct;
  if (pct < 20) return null;
  return insight(
    'rev.strong_growth', 'celebration', 'TrendingUp', 'revenue',
    'Outstanding revenue growth',
    `Revenue grew ${pct.toFixed(0)}% this period compared to last. Your retention and marketing efforts are paying off.`,
    null, null, 70
  );
};

const revMissedTarget = (a) => {
  if (!a.revenue || !a.businessGoals || !['thisMonth', 'lastMonth'].includes(a.meta?.period)) return null;
  const target = a.businessGoals.targetMonthlyRevenue;
  if (!target || a.revenue.totalRevenue >= target) return null;
  const gap = target - a.revenue.totalRevenue;
  return insight(
    'rev.missed_target', 'warning', 'Target', 'revenue',
    'Monthly revenue is below target',
    `Revenue is ${inr(gap)} short of your ${inr(target)} monthly goal. Focus on rebooking clients before they leave and increasing retail add-ons.`,
    'View Revenue', '/v2/insights', 2
  );
};

const revHitTarget = (a) => {
  if (!a.revenue || !a.businessGoals || !['thisMonth', 'lastMonth'].includes(a.meta?.period)) return null;
  const target = a.businessGoals.targetMonthlyRevenue;
  if (!target || a.revenue.totalRevenue < target) return null;
  return insight(
    'rev.hit_target', 'celebration', 'Target', 'revenue',
    'Monthly revenue goal achieved!',
    `Congratulations! You surpassed your monthly revenue target of ${inr(target)} with ${inr(a.revenue.totalRevenue)}. Keep up the excellent work.`,
    null, null, 75
  );
};

const revWeekendDependent = (a) => {
  if (!a.revenue) return null;
  const pct = a.revenue.weekendPct;
  if (pct < 65) return null;
  return insight(
    'rev.weekend_dependent', 'warning', 'Calendar', 'revenue',
    'Business is heavily weekend-dependent',
    `${pct.toFixed(0)}% of revenue comes from weekends. A weekday promotion could balance bookings and reduce risk from weekend-only dependence.`,
    'View Appointment Heatmap', '/v2/insights', 10
  );
};

const revIdleWeekday = (a) => {
  if (!a.revenue) return null;
  const { dayOfWeekRevenue, peakDay, idleDay, totalRevenue } = a.revenue;
  if (!idleDay || !dayOfWeekRevenue) return null;
  const idleDayData = dayOfWeekRevenue.find(d => d.day === idleDay);
  const idlePct = totalRevenue > 0 ? ((idleDayData?.revenue || 0) / totalRevenue) * 100 : 0;
  if (idlePct > 15 || idleDayData?.count === 0) return null;
  return insight(
    'rev.idle_weekday', 'opportunity', 'Zap', 'revenue',
    `${idleDay}s are consistently underutilised`,
    `${idleDay}s generate only ${idlePct.toFixed(0)}% of total revenue compared to ${peakDay}s. A targeted promotion on ${idleDay}s could significantly increase weekly revenue.`,
    'View Day-of-Week Chart', '/v2/insights', 12
  );
};

const revHighDiscount = (a) => {
  if (!a.revenue) return null;
  const pct = a.revenue.discountPct;
  if (pct < 12) return null;
  return insight(
    'rev.high_discount', 'warning', 'Tag', 'revenue',
    'Discounts are eating into revenue',
    `${inr(a.revenue.totalDiscount)} in discounts this period — ${pct.toFixed(0)}% of gross revenue. Consider reviewing your discount policy to protect margins.`,
    'Review Discount Report', '/v2/reports', 8
  );
};

const revLowAvgBill = (a) => {
  if (!a.revenue) return null;
  const growthPct = a.revenue.avgBillGrowthPct;
  if (growthPct > -12) return null;
  return insight(
    'rev.low_avg_bill', 'warning', 'BarChart2', 'revenue',
    'Average bill value is declining',
    `Average bill dropped from ${inr(a.revenue.priorAvgBill)} to ${inr(a.revenue.avgBillValue)}. Staff may not be suggesting add-on services or products.`,
    'View Staff Performance', '/v2/insights', 11
  );
};

const revCashHeavy = (a) => {
  if (!a.revenue) return null;
  if (a.revenue.cashPct < 82) return null;
  return insight(
    'rev.cash_heavy', 'info', 'Banknote', 'revenue',
    'High cash dependency',
    `${a.revenue.cashPct.toFixed(0)}% of payments are cash. Encouraging UPI payments reduces handling risk and improves reconciliation speed.`,
    null, null, 60
  );
};

// ════════════════════════════════════════════════════════════════════
// CUSTOMER RULES
// ════════════════════════════════════════════════════════════════════

const custAtRisk30High = (a) => {
  if (!a.customers) return null;
  const count = a.customers.atRisk30.length;
  if (count < 5) return null;
  return insight(
    'cust.at_risk_30', 'warning', 'Users', 'customers',
    `${count} regulars have gone quiet`,
    `${count} customers haven't visited in 30+ days. A personalised message or special offer could bring many of them back before they're lost.`,
    'View At-Risk Customers', '/v2/customers', 6
  );
};

const custAtRisk60Any = (a) => {
  if (!a.customers) return null;
  const count = a.customers.atRisk60.length;
  if (count < 3) return null;
  return insight(
    'cust.at_risk_60', 'critical', 'AlertCircle', 'customers',
    `${count} customers inactive for 60+ days`,
    `${count} customers haven't visited in over 2 months. These relationships need active recovery — a personal outreach often works better than a mass message.`,
    'View At-Risk List', '/v2/customers', 3
  );
};

const custVipLapsed = (a) => {
  if (!a.customers) return null;
  const count = a.customers.vipLapsed.length;
  if (count < 1) return null;
  const names = a.customers.vipLapsed.slice(0, 2).map(v => v.name).join(' and ');
  return insight(
    'cust.vip_lapsed', 'critical', 'Star', 'customers',
    'Premium customers have gone quiet',
    `${names}${count > 2 ? ` and ${count - 2} other top spenders` : ''} haven't visited in over 45 days. These are your highest-value relationships.`,
    'View VIP Customers', '/v2/customers', 2, false
  );
};

const custLowRetention = (a) => {
  if (!a.customers) return null;
  const rate = a.customers.retentionRate;
  const target = a.businessGoals?.targetRetention || 60;
  if (rate >= target) return null;
  return insight(
    'cust.low_retention', 'critical', 'UserMinus', 'customers',
    'Customer retention is below target',
    `Only ${rate.toFixed(0)}% of customers are returning this period (Target: ${target}%). Focus on the post-visit experience — a follow-up message or loyalty reward can significantly improve retention.`,
    'View Customer Insights', '/v2/insights', 4
  );
};

const custRetentionImproving = (a) => {
  if (!a.customers) return null;
  const rate = a.customers.retentionRate;
  const target = a.businessGoals?.targetRetention || 60;
  if (rate < target) return null;
  return insight(
    'cust.high_retention', 'celebration', 'Heart', 'customers',
    `${rate.toFixed(0)}% customer retention — goal achieved!`,
    `More than ${rate.toFixed(0)}% of your clients are returning regularly, hitting your target of ${target}%. This is a sign of strong service quality and relationship building.`,
    null, null, 65
  );
};

const custBirthdaysToday = (a) => {
  if (!a.customers) return null;
  const today = new Date().getDate();
  const todayBdays = (a.customers.birthdayCustomers || []).filter(c => parseInt(c.day) === today);
  if (todayBdays.length === 0) return null;
  const names = todayBdays.map(c => c.name).slice(0, 2).join(' & ');
  return insight(
    'cust.birthday_today', 'info', 'Gift', 'customers',
    `Birthday customers today`,
    `${names}${todayBdays.length > 2 ? ` and ${todayBdays.length - 2} others` : ''} celebrate their birthday today. A complimentary service or personal message creates lifelong loyalty.`,
    'View Customers', '/v2/customers', 20
  );
};

const custNewGrowth = (a) => {
  if (!a.customers) return null;
  const rate = a.revenue?.billGrowthPct;
  if (!rate || rate < 25) return null;
  return insight(
    'cust.new_growth', 'celebration', 'UserPlus', 'customers',
    'New customers surging',
    `Customer activity grew ${rate.toFixed(0)}% this period. Your marketing and word-of-mouth are working — convert these first-timers into regulars.`,
    null, null, 60
  );
};

const custHighWalkIn = (a) => {
  if (!a.customers) return null;
  const pct = a.customers.walkinPct;
  if (pct < 55) return null;
  return insight(
    'cust.high_walkin', 'opportunity', 'Navigation', 'customers',
    'Most visits are unplanned walk-ins',
    `${pct.toFixed(0)}% of clients walk in without a booking. Offering a small incentive for pre-booking (e.g. 5% off) improves your scheduling and reduces idle gaps.`,
    null, null, 25
  );
};

// ════════════════════════════════════════════════════════════════════
// APPOINTMENT RULES
// ════════════════════════════════════════════════════════════════════

const apptHighCancellation = (a) => {
  if (!a.appointments) return null;
  const rate = a.appointments.cancellationRate;
  if (rate < 15) return null;
  const lost = Math.round(a.appointments.cancelledCount * (a.revenue?.avgBillValue || 0));
  return insight(
    'appt.high_cancellation', 'critical', 'XCircle', 'appointments',
    'Cancellations above normal',
    `${rate.toFixed(0)}% of appointments were cancelled — representing approximately ${inr(lost)} in lost revenue. Consider a small deposit for advance bookings.`,
    'View Appointment Details', '/v2/appointments', 3, false
  );
};

const apptNoShowSpike = (a) => {
  if (!a.appointments) return null;
  const rate = a.appointments.noShowRate;
  if (rate < 8) return null;
  const lost = Math.round(a.appointments.noShowCount * (a.revenue?.avgBillValue || 0));
  return insight(
    'appt.no_show', 'warning', 'Clock', 'appointments',
    'No-shows are increasing',
    `No-show rate hit ${rate.toFixed(0)}% this period — costing approximately ${inr(lost)} in lost revenue. SMS reminders 24 hours before appointments can cut no-shows significantly.`,
    null, null, 7
  );
};

const apptIdleSlots = (a) => {
  if (!a.appointments) return null;
  const summary = a.appointments.idleSlotSummary;
  if (!summary) return null;
  const leakage = a.revenue?.leakageData?.estimatedMonthlyLeakage;
  const leakageText = leakage ? ` You could be missing out on ${inr(leakage)} monthly.` : '';
  return insight(
    'appt.idle_slots', 'opportunity', 'Zap', 'appointments',
    `${summary} is consistently empty`,
    `${summary} has very low booking density every week.${leakageText} A targeted flash promotion for this slot could fill the gap.`,
    'View Booking Heatmap', '/v2/insights', 15
  );
};

const apptWeekendFull = (a) => {
  if (!a.appointments || !a.revenue) return null;
  const weekendPct = a.revenue.weekendPct;
  if (weekendPct < 70) return null;
  return insight(
    'appt.weekend_full', 'opportunity', 'Calendar', 'appointments',
    'Weekend demand may exceed capacity',
    `Weekend bookings drive ${weekendPct.toFixed(0)}% of revenue. If Saturdays are consistently fully booked, extended hours or additional staff could capture more demand.`,
    null, null, 18
  );
};

const apptLowConversion = (a) => {
  if (!a.appointments) return null;
  const rate = a.appointments.conversionRate;
  if (rate >= 70) return null;
  return insight(
    'appt.low_conversion', 'warning', 'AlertTriangle', 'appointments',
    'Many scheduled appointments not completing',
    `Only ${rate.toFixed(0)}% of scheduled appointments convert to completed bills. Review the cancellation reasons — are clients rescheduling or not showing up?`,
    'View Appointments', '/v2/appointments', 9
  );
};

// ════════════════════════════════════════════════════════════════════
// STAFF RULES
// ════════════════════════════════════════════════════════════════════

const staffLowUtilisation = (a) => {
  if (!a.staff) return null;
  const target = a.businessGoals?.targetUtilization || 70;
  if (a.staff.avgUtilisation >= target) return null;
  const lowStaff = a.staff.lowUtilisationStaff;
  if (!lowStaff || lowStaff.length === 0) return null;
  const s = lowStaff[0];
  const potential = Math.round(((0.75 - (s.utilisationPct / 100)) * 8 * 60 / 45) * (a.revenue?.avgBillValue || 0) * 20);
  return insight(
    'staff.low_utilisation', 'warning', 'Award', 'staff',
    `Team utilization is below the ${target}% target`,
    `${s.name} is only ${s.utilisationPct?.toFixed(0)}% utilised this period. Filling their idle slots could add approximately ${inr(potential)} per month.`,
    'View Staff Performance', '/v2/insights', 11
  );
};

const staffHighDiscount = (a) => {
  if (!a.staff) return null;
  const highDiscStaff = a.staff.highDiscountStaff;
  if (!highDiscStaff || highDiscStaff.length === 0) return null;
  const s = highDiscStaff[0];
  return insight(
    'staff.high_discount', 'warning', 'Tag', 'staff',
    `${s.name} is discounting too frequently`,
    `${s.name} applied discounts on ${s.discountRate.toFixed(0)}% of bills — much higher than the team average. A conversation about discount guidelines may be worthwhile.`,
    'View Staff Details', '/v2/insights', 13
  );
};

const staffTopPerformer = (a) => {
  if (!a.staff?.topPerformer) return null;
  const s = a.staff.topPerformer;
  return insight(
    'staff.top_performer', 'celebration', 'Award', 'staff',
    `${s.name} is your star this period`,
    `${s.name} generated ${inr(s.revenue)} with a ${s.retentionRate.toFixed(0)}% customer return rate. Recognising top performers motivates the whole team.`,
    null, null, 65
  );
};

const staffAttendanceFalling = (a) => {
  if (!a.staff) return null;
  const poorAttendance = a.staff.staffCards.filter(s => s.daysPresent > 0 && s.daysPresent < (a.staff.staffCards[0]?.daysPresent * 0.75));
  if (poorAttendance.length === 0) return null;
  return insight(
    'staff.attendance_irregular', 'warning', 'Clock', 'staff',
    'Irregular attendance detected',
    `${poorAttendance.length} staff member${poorAttendance.length > 1 ? 's' : ''} had below-average attendance this period. Consistent scheduling is important for customer reliability.`,
    'View Attendance', '/v2/staff/attendance', 9
  );
};

const staffRevenueGap = (a) => {
  if (!a.staff) return null;
  if (a.staff.revenueGap < 3) return null;
  const top    = a.staff.topPerformer;
  const bottom = a.staff.bottomPerformer;
  if (!top || !bottom || top.id === bottom.id) return null;
  return insight(
    'staff.revenue_gap', 'info', 'BarChart2', 'staff',
    'Large revenue gap between staff',
    `Revenue ranges from ${inr(bottom.revenue)} to ${inr(top.revenue)} across your team. Coaching or skills training for lower performers could lift overall team revenue.`,
    'View Staff Leaderboard', '/v2/insights', 30
  );
};

// ════════════════════════════════════════════════════════════════════
// SERVICE RULES
// ════════════════════════════════════════════════════════════════════

const svcFastGrowth = (a) => {
  if (!a.services?.fastestGrowing) return null;
  const svc = a.services.fastestGrowing;
  if (svc.growthPct < 25 || svc.count < 3) return null;
  return insight(
    'svc.fast_growth', 'opportunity', 'TrendingUp', 'services',
    `${svc.name} is trending up`,
    `${svc.name} bookings grew ${svc.growthPct.toFixed(0)}% this period. This is the right time to promote it further or create a combo package around it.`,
    'View Service Insights', '/v2/insights', 22
  );
};

const svcDeadService = (a) => {
  if (!a.services?.deadServices?.length) return null;
  const svc = a.services.deadServices[0];
  return insight(
    'svc.dead_service', 'warning', 'AlertCircle', 'services',
    `${svc.name} hasn't been booked`,
    `"${svc.name}" was offered last period but has had zero bookings this period. Consider promoting it or reviewing whether it's still relevant to your clients.`,
    'View Service Performance', '/v2/insights', 17
  );
};

const svcRevConcentration = (a) => {
  if (!a.services) return null;
  const pct = a.services.topServiceRevenuePct;
  if (pct < 40) return null;
  const svc = a.services.highestRevenue;
  return insight(
    'svc.revenue_concentration', 'info', 'PieChart', 'services',
    `${svc?.name} drives most of your revenue`,
    `"${svc?.name}" contributes ${pct.toFixed(0)}% of service revenue. Protecting the quality of this service is critical — it's your biggest earner.`,
    null, null, 35
  );
};

const svcComboOpportunity = (a) => {
  if (!a.services?.bestCombo) return null;
  const combo = a.services.bestCombo;
  if (combo.pct < 30) return null;
  return insight(
    'svc.combo_opportunity', 'opportunity', 'Package', 'services',
    `Create a combo for ${combo.pair}`,
    `"${combo.pair}" appear together in ${combo.pct.toFixed(0)}% of bills. A bundled package at a slight discount could increase uptake and average bill value.`,
    null, null, 24
  );
};

const svcLowAvgPrice = (a) => {
  if (!a.services || !a.revenue) return null;
  const avgBillGrowth = a.revenue.avgBillGrowthPct;
  if (avgBillGrowth > -10) return null;
  return insight(
    'svc.low_avg_price', 'warning', 'DollarSign', 'services',
    'Service prices appear to be declining',
    `Average service pricing has dropped. Check if staff are applying unexpected discounts or if clients are choosing cheaper service options more often.`,
    'View Service Report', '/v2/reports', 19
  );
};

// ════════════════════════════════════════════════════════════════════
// INVENTORY RULES
// ════════════════════════════════════════════════════════════════════

const invCriticalLowStock = (a) => {
  if (!a.inventory?.lowStockItems?.length) return null;
  const critical = a.inventory.lowStockItems.filter(p => p.stock <= 2);
  if (critical.length === 0) return null;
  const names = critical.slice(0, 2).map(p => p.name).join(', ');
  return insight(
    'inv.critical_low_stock', 'critical', 'Package', 'inventory',
    'Critical stock shortage',
    `${names}${critical.length > 2 ? ` and ${critical.length - 2} other products` : ''} ${critical.length === 1 ? 'has' : 'have'} almost no stock left. Reorder immediately to avoid service disruption.`,
    'View Inventory', '/v2/inventory', 4, false
  );
};

const invLowStock = (a) => {
  if (!a.inventory?.lowStockItems?.length) return null;
  const warning = a.inventory.lowStockItems.filter(p => p.stock > 2 && p.stock < 5);
  if (warning.length === 0) return null;
  const names = warning.slice(0, 2).map(p => p.name).join(', ');
  return insight(
    'inv.low_stock', 'warning', 'Package', 'inventory',
    `${warning.length} product${warning.length > 1 ? 's' : ''} running low`,
    `${names}${warning.length > 2 ? ` and others are` : ` is`} running low. Consider reordering before the weekend rush.`,
    'View Inventory', '/v2/inventory', 8
  );
};

const invDeadStock = (a) => {
  if (!a.inventory?.deadStockItems?.length) return null;
  const dead = a.inventory.deadStockItems;
  const value = dead.reduce((s, p) => s + p.stockValue, 0);
  return insight(
    'inv.dead_stock', 'warning', 'Archive', 'inventory',
    `${inr(value)} tied up in unsold stock`,
    `${dead.length} product${dead.length > 1 ? 's haven\'t' : ' hasn\'t'} sold in over 90 days. A bundle promotion or staff incentive to recommend these products could free up this capital.`,
    'View Inventory', '/v2/inventory', 20
  );
};

const invFastMover = (a) => {
  if (!a.inventory?.fastMovers?.length) return null;
  const top = a.inventory.fastMovers[0];
  if (!top) return null;
  return insight(
    'inv.fast_mover', 'opportunity', 'Zap', 'inventory',
    `${top.name} is flying off the shelf`,
    `"${top.name}" is your fastest-moving product with ${top.unitsSold} units sold this period. Ensure you maintain adequate stock to avoid running out.`,
    null, null, 40
  );
};

// ════════════════════════════════════════════════════════════════════
// FINANCIAL RULES
// ════════════════════════════════════════════════════════════════════

const finExpenseSpike = (a) => {
  if (!a.financial) return null;
  const pct = a.financial.expenseGrowthPct;
  if (pct < 30) return null;
  const top = a.financial.topExpenseCategory;
  return insight(
    'fin.expense_spike', 'warning', 'TrendingUp', 'financial',
    'Expenses jumped significantly',
    `Expenses rose ${pct.toFixed(0)}% vs last period (${inr(a.financial.priorTotalExpenses)} → ${inr(a.financial.totalExpenses)}). ${top ? `"${top}" is the largest category.` : ''} Review unusual charges.`,
    'View Expenses', '/v2/expenses', 8
  );
};

const finLowMargin = (a) => {
  if (!a.financial) return null;
  const margin = a.financial.profitMarginPct;
  if (margin >= 20) return null;
  return insight(
    'fin.low_margin', 'critical', 'AlertCircle', 'financial',
    'Profit margins are under pressure',
    `Net margin is ${margin.toFixed(0)}% this period. Expenses may be growing faster than revenue. Focus on reducing costs or increasing average bill value.`,
    'View Financial Summary', '/v2/insights', 5, false
  );
};

const finMarginImproving = (a) => {
  if (!a.financial) return null;
  const delta = a.financial.marginDelta;
  if (delta < 5) return null;
  return insight(
    'fin.margin_improving', 'celebration', 'TrendingUp', 'financial',
    'Profit margins are widening',
    `Profit margin improved by ${delta.toFixed(1)} percentage points vs last period. Excellent cost discipline — your business is becoming more efficient.`,
    null, null, 62
  );
};

const finProfitMilestone = (a) => {
  if (!a.financial?.crossedMilestones?.length) return null;
  const milestone = Math.max(...a.financial.crossedMilestones);
  return insight(
    'fin.profit_milestone', 'celebration', 'Trophy', 'financial',
    `Profit milestone crossed: ${inr(milestone)}!`,
    `You crossed ${inr(milestone)} in net profit this period. This is a significant business achievement — congratulations!`,
    null, null, 50, false
  );
};

const finGstOverview = (a) => {
  if (!a.financial) return null;
  const gst = a.financial.gstCollected;
  if (gst < 5000) return null;
  return insight(
    'fin.gst_overview', 'info', 'FileText', 'financial',
    `GST collected: ${inr(gst)}`,
    `You collected ${inr(gst)} in GST this period. Ensure timely filing to avoid penalties — set a reminder if needed.`,
    null, null, 50
  );
};

// ════════════════════════════════════════════════════════════════════
// RULE REGISTRY + ENGINE RUNNER
// ════════════════════════════════════════════════════════════════════

const ALL_RULES = [
  // Revenue (11)
  revCriticalDrop, revModerateDrop, revStrongGrowth, revWeekendDependent,
  revIdleWeekday, revHighDiscount, revLowAvgBill, revCashHeavy,
  revMissedTarget, revHitTarget,
  // Customer (8)
  custAtRisk30High, custAtRisk60Any, custVipLapsed, custLowRetention,
  custRetentionImproving, custBirthdaysToday, custNewGrowth, custHighWalkIn,
  // Appointment (5)
  apptHighCancellation, apptNoShowSpike, apptIdleSlots, apptWeekendFull, apptLowConversion,
  // Staff (5)
  staffLowUtilisation, staffHighDiscount, staffTopPerformer, staffAttendanceFalling, staffRevenueGap,
  // Service (5)
  svcFastGrowth, svcDeadService, svcRevConcentration, svcComboOpportunity, svcLowAvgPrice,
  // Inventory (4)
  invCriticalLowStock, invLowStock, invDeadStock, invFastMover,
  // Financial (5)
  finExpenseSpike, finLowMargin, finMarginImproving, finProfitMilestone, finGstOverview,
];

/**
 * Runs all rules against the computed analytics object.
 * Returns insights sorted by priority (lowest number = most urgent).
 * @param {Object} analytics - Output of computeAnalytics()
 * @returns {Insight[]}
 */
export function runInsightEngine(analytics) {
  const results = [];
  ALL_RULES.forEach(rule => {
    try {
      const result = rule(analytics);
      if (result) results.push(result);
    } catch (err) {
      // Never crash the page due to a bad rule
      console.warn(`[InsightEngine] Rule error:`, err);
    }
  });
  return results.sort((a, b) => a.priority - b.priority);
}
