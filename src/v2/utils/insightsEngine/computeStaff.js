// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Staff Computation
// ═══════════════════════════════════════════════════════════════════
import { isCompleted, getAllItems, getSalonAmount, getSafeDate, linearMap } from './helpers.js';
import { resolveStylistId } from '../stylistMapping.js';

/**
 * Computes staff performance intelligence.
 * @param {Array} appts          - Current period appointments
 * @param {Array} priorAppts     - Prior period appointments
 * @param {Array} attendanceLogs - Current period attendance_logs docs
 * @param {Array} stylists       - Staff list from DataProvider
 * @returns {Object} staff analytics object
 */
export function computeStaff(appts, priorAppts, attendanceLogs, stylists) {
  const done      = appts.filter(isCompleted);
  const priorDone = priorAppts.filter(isCompleted);
  const activeStaff = (stylists || []).filter(s =>
    s.isActive !== false &&
    String(s.isActive) !== 'false' &&
    !s.isKiosk &&
    s.role !== 'admin' &&
    s.role !== 'attendance_only' &&
    s.role !== 'store_account' &&
    !s.name?.toLowerCase().includes('jx') &&
    s.email !== 'jxsaloon@store.com'
  );

  // ── Per-staff revenue (using existing logic mirror) ──────────────────
  const buildSalesMap = (appointments) => {
    const map = {};
    activeStaff.forEach(s => {
      map[s.id] = { stylistId: s.id, name: s.name, bills: 0, revenue: 0, cash: 0, card: 0, discount: 0, clients: new Set() };
    });

    appointments.forEach(a => {
      const serviceItems = getAllItems(a).filter(i => i.type === 'service' || !i.type);
      const totalSvcPrice = serviceItems.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
      const shares = {};

      serviceItems.forEach(i => {
        const rid = resolveStylistId(i.stylistId || i.staffId || a.stylistId, stylists) || 'unassigned';
        const p   = (Number(i.price) || 0) * (Number(i.qty) || 1);
        shares[rid] = (shares[rid] || 0) + p;
      });

      Object.entries(shares).forEach(([rid, svcShare]) => {
        if (!map[rid]) return;
        const ratio  = totalSvcPrice > 0 ? svcShare / totalSvcPrice : 1;
        const rev    = getSalonAmount(a) * ratio;
        const disc   = (a.discountAmount || a.discount || 0) * ratio;
        map[rid].bills++;
        map[rid].revenue  += rev;
        map[rid].discount += disc;
        if (a.clientPhone) map[rid].clients.add(String(a.clientPhone));
        if ((a.paymentType || 'cash').toLowerCase() === 'cash') map[rid].cash += rev;
        else map[rid].card += rev;
      });
    });
    return map;
  };

  const currentMap = buildSalesMap(done);
  const priorMap   = buildSalesMap(priorDone);

  // ── Attendance & utilisation ─────────────────────────────────────────
  // Group attendance_logs by stylistId, compute total shift minutes
  const attendanceByStaff = {};
  activeStaff.forEach(s => {
    attendanceByStaff[s.id] = { daysPresent: 0, totalShiftMinutes: 0, clockIns: [] };
  });

  // Build pairs: find each clock_in and its matching clock_out
  const logsById = {};
  attendanceLogs.forEach(log => {
    const sid = resolveStylistId(log.stylistId, stylists);
    if (!sid || !attendanceByStaff[sid]) return;
    if (!logsById[sid]) logsById[sid] = [];
    logsById[sid].push(log);
  });

  Object.entries(logsById).forEach(([sid, logs]) => {
    const sorted = [...logs].sort((a, b) => {
      const ta = getSafeDate(a.timestamp)?.getTime() || 0;
      const tb = getSafeDate(b.timestamp)?.getTime() || 0;
      return ta - tb;
    });

    const daysSeen = new Set();
    let pendingClockIn = null;

    sorted.forEach(log => {
      const ts = getSafeDate(log.timestamp);
      if (!ts) return;
      const dateKey = ts.toISOString().slice(0, 10);

      if (log.type === 'clock_in') {
        pendingClockIn = ts;
        daysSeen.add(dateKey);
      } else if (log.type === 'clock_out' && pendingClockIn) {
        const shiftMs = ts.getTime() - pendingClockIn.getTime();
        if (shiftMs > 0 && shiftMs < 16 * 60 * 60 * 1000) { // sanity: < 16h
          attendanceByStaff[sid].totalShiftMinutes += shiftMs / 60000;
        }
        pendingClockIn = null;
      }
    });
    attendanceByStaff[sid].daysPresent = daysSeen.size;
  });

  // ── Customer retention per staff ─────────────────────────────────────
  // For each staff, what % of their clients came back (had > 1 visit to that staff)?
  const staffClientMap = {};
  activeStaff.forEach(s => { staffClientMap[s.id] = {}; });

  done.filter(a => a.clientPhone).forEach(a => {
    const phone = String(a.clientPhone);
    // Attribute to all staff who served this appointment
    const serviceItems = getAllItems(a).filter(i => i.type === 'service' || !i.type);
    const staffIds = new Set(
      serviceItems.map(i => resolveStylistId(i.stylistId || i.staffId || a.stylistId, stylists)).filter(Boolean)
    );
    if (staffIds.size === 0) {
      const sid = resolveStylistId(a.stylistId, stylists);
      if (sid) staffIds.add(sid);
    }
    staffIds.forEach(sid => {
      if (!staffClientMap[sid]) return;
      staffClientMap[sid][phone] = (staffClientMap[sid][phone] || 0) + 1;
    });
  });

  // ── Build per-staff scorecard ─────────────────────────────────────────
  const maxRevenue = Math.max(...activeStaff.map(s => currentMap[s.id]?.revenue || 0), 1);

  const staffCards = activeStaff.map(s => {
    const cur  = currentMap[s.id] || { bills: 0, revenue: 0, cash: 0, card: 0, discount: 0, clients: new Set() };
    const prev = priorMap[s.id]   || { bills: 0, revenue: 0 };

    const revGrowthPct     = prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    const avgBill          = cur.bills > 0 ? cur.revenue / cur.bills : 0;
    const discountRate     = cur.revenue > 0 ? (cur.discount / (cur.revenue + cur.discount)) * 100 : 0;

    const att              = attendanceByStaff[s.id] || { daysPresent: 0, totalShiftMinutes: 0 };
    const shiftHours       = att.totalShiftMinutes / 60;

    // Estimated billable hours: bills × avg 45min service
    const billableMinutes  = cur.bills * 45;
    const utilisationPct   = att.totalShiftMinutes > 0
      ? Math.min(100, (billableMinutes / att.totalShiftMinutes) * 100)
      : null; // null = no attendance data

    // Retention: clients with > 1 visit to this staff / total unique clients for this staff
    const clientVisits     = Object.values(staffClientMap[s.id] || {});
    const totalUniqueClients = clientVisits.length;
    const returningClients   = clientVisits.filter(v => v > 1).length;
    const retentionRate      = totalUniqueClients > 0 ? (returningClients / totalUniqueClients) * 100 : 0;

    // Composite score
    const revenueScore     = linearMap(cur.revenue, 0, maxRevenue, 0, 100);
    const utilisationScore = utilisationPct !== null ? utilisationPct : 50; // default 50 if no attendance
    const retentionScore   = linearMap(retentionRate, 0, 80, 0, 100);
    const compositeScore   = Math.round(revenueScore * 0.4 + utilisationScore * 0.3 + retentionScore * 0.3);

    return {
      id: s.id, name: s.name,
      bills: cur.bills, revenue: cur.revenue, avgBill,
      priorRevenue: prev.revenue, revGrowthPct,
      cash: cur.cash, card: cur.card, discount: cur.discount, discountRate,
      daysPresent: att.daysPresent, shiftHours,
      utilisationPct, billableMinutes,
      totalUniqueClients, returningClients, retentionRate,
      revenueScore, utilisationScore, retentionScore, compositeScore,
      label: compositeScore >= 75 ? 'Top Performer' : compositeScore >= 50 ? 'Consistent' : 'Needs Attention',
    };
  }).sort((a, b) => b.compositeScore - a.compositeScore);

  // ── Team-level stats ─────────────────────────────────────────────────
  const staffCount        = activeStaff.length;
  const totalStaffRevenue = staffCards.reduce((s, c) => s + c.revenue, 0);
  const avgUtilisation    = staffCards.filter(c => c.utilisationPct !== null).reduce((s, c) => s + c.utilisationPct, 0) /
    Math.max(staffCards.filter(c => c.utilisationPct !== null).length, 1);
  const topPerformer      = staffCards[0] || null;
  const bottomPerformer   = staffCards[staffCards.length - 1] || null;

  // Staff with high discount rate
  const highDiscountStaff = staffCards.filter(c => c.discountRate > 15);

  // Staff with low utilisation
  const lowUtilisationStaff = staffCards.filter(c => c.utilisationPct !== null && c.utilisationPct < 50);

  // Revenue variance (max/min ratio)
  const revenueValues = staffCards.map(c => c.revenue).filter(v => v > 0);
  const revenueGap    = revenueValues.length > 1
    ? Math.max(...revenueValues) / Math.min(...revenueValues)
    : 1;

  // Utilistion score for health
  const utilisationScore = linearMap(avgUtilisation, 40, 90, 0, 100);

  return {
    staffCount, staffCards, totalStaffRevenue,
    avgUtilisation, utilisationScore,
    topPerformer, bottomPerformer,
    highDiscountStaff, lowUtilisationStaff,
    revenueGap,
  };
}
