// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Customer Computation
// ═══════════════════════════════════════════════════════════════════
import { isCompleted, getActualDate, getSafeDate, daysBetween, groupByMonth, linearMap } from './helpers.js';

/**
 * Computes all customer-related metrics.
 * @param {Array} appts          - Current period appointments
 * @param {Array} allCustomers   - Full customers collection (from DataProvider, top 500)
 * @param {string} period        - Period key (for context)
 * @returns {Object} customer analytics object
 */
export function computeCustomers(appts, allCustomers, period) {
  const today  = new Date();
  const done   = appts.filter(isCompleted);

  // ── New vs Returning ────────────────────────────────────────────────
  const totalAppts      = done.length;
  // Augment customers with latest visit date from current period appts
  const phoneLatestVisit = {};
  done.forEach(a => {
    if (a.clientPhone) {
      const ts = getSafeDate(a.timestamp);
      if (ts && (!phoneLatestVisit[a.clientPhone] || ts > phoneLatestVisit[a.clientPhone])) {
        phoneLatestVisit[a.clientPhone] = ts;
      }
    }
  });

  const returningAppts  = done.filter(a => {
    if (!a.clientPhone) return false;
    const c = allCustomers.find(cust => cust.phone === a.clientPhone);
    return c ? (c.globalStats?.totalVisits > 1) : a.isReturningClient;
  }).length;
  
  const newAppts        = totalAppts - returningAppts;
  const retentionRate   = totalAppts > 0 ? (returningAppts / totalAppts) * 100 : 0;
  const retentionScore  = linearMap(retentionRate, 20, 80, 0, 100);

  // ── Acquisition Cohort Matrix ─────────────────────────────────────────
  const cohorts = {};
  allCustomers.forEach(c => {
    const createdAt = getSafeDate(c.createdAt) || getSafeDate(c.timestamp) || getSafeDate(c.createdOn);
    if (!createdAt) return;
    const cohortKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!cohorts[cohortKey]) cohorts[cohortKey] = { acquired: 0, retained: 0 };
    cohorts[cohortKey].acquired++;
    
    // Defined as retained if they visited > 1 time
    if ((c.globalStats?.totalVisits || 0) > 1) {
      cohorts[cohortKey].retained++;
    }
  });

  const cohortMatrix = Object.entries(cohorts)
    .map(([key, data]) => ({
      cohort: key, // e.g. "2024-01"
      acquired: data.acquired,
      retained: data.retained,
      retentionPct: data.acquired > 0 ? (data.retained / data.acquired) * 100 : 0
    }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort)) // oldest first
    .slice(-12); // Last 12 months only

  // ── Unique customers in period ──────────────────────────────────────
  const phoneSet = new Set(done.filter(a => a.clientPhone).map(a => String(a.clientPhone)));
  const uniqueCustomersInPeriod = phoneSet.size;

  // ── Walk-ins ────────────────────────────────────────────────────────
  const walkins      = done.filter(a => !a.clientPhone || a.clientName === 'Walk-in').length;
  const walkinPct    = totalAppts > 0 ? (walkins / totalAppts) * 100 : 0;
  const bookedPct    = 100 - walkinPct;

  // ── Visit frequency ─────────────────────────────────────────────────
  // Group completed appointments by phone → compute avg visits per unique customer
  const phoneMap = {};
  done.filter(a => a.clientPhone).forEach(a => {
    const p = String(a.clientPhone);
    phoneMap[p] = (phoneMap[p] || 0) + 1;
  });
  const phoneVisits       = Object.values(phoneMap);
  const avgVisitFrequency = phoneVisits.length > 0
    ? phoneVisits.reduce((s, v) => s + v, 0) / phoneVisits.length
    : 0;
  const frequencyScore    = linearMap(avgVisitFrequency, 1, 3, 0, 100);

  // ── At-risk cohorts ─────────────────────────────────────────────────
  // From the in-memory customers (top 500 by lastUpdated)
  // Filter to customers with globalStats data
  const atRisk30 = [];
  const atRisk60 = [];
  const atRisk90 = [];

  allCustomers.forEach(c => {
    // Determine last visit date, favoring recent appts if available
    const apptLastVisit = phoneLatestVisit[c.phone];
    let lastVisit = getSafeDate(c.globalStats?.lastVisit || c.lastUpdated);
    if (apptLastVisit && (!lastVisit || apptLastVisit > lastVisit)) {
        lastVisit = apptLastVisit;
    }

    if (!lastVisit) return;
    const days = daysBetween(today, lastVisit);
    // Must have visited at least once and been active
    if ((c.globalStats?.totalVisits || 0) < 1) return;

    if (days > 90) {
      atRisk90.push({ id: c.id, name: c.name, phone: c.phone, daysInactive: days, totalSpent: c.globalStats?.totalSpent || 0 });
    } else if (days > 60) {
      atRisk60.push({ id: c.id, name: c.name, phone: c.phone, daysInactive: days, totalSpent: c.globalStats?.totalSpent || 0 });
    } else if (days > 30) {
      atRisk30.push({ id: c.id, name: c.name, phone: c.phone, daysInactive: days, totalSpent: c.globalStats?.totalSpent || 0 });
    }
  });

  // Sort by totalSpent desc (highest value customers first)
  [atRisk30, atRisk60, atRisk90].forEach(arr => arr.sort((a, b) => b.totalSpent - a.totalSpent));
  const totalAtRisk = atRisk30.length + atRisk60.length + atRisk90.length;

  // ── VIP customers ────────────────────────────────────────────────────
  // Top decile by totalSpent
  const sortedBySpend = [...allCustomers]
    .filter(c => (c.globalStats?.totalSpent || 0) > 0)
    .sort((a, b) => (b.globalStats?.totalSpent || 0) - (a.globalStats?.totalSpent || 0));

  const vipThreshold = sortedBySpend.length > 0
    ? sortedBySpend[Math.floor(sortedBySpend.length * 0.1)]?.globalStats?.totalSpent || 0
    : 0;

  const vipCustomers = sortedBySpend.slice(0, 10).map(c => ({
    id: c.id, name: c.name, phone: c.phone,
    totalSpent: c.globalStats?.totalSpent || 0,
    totalVisits: c.globalStats?.totalVisits || 0,
    lastVisit: getSafeDate(c.globalStats?.lastVisit || c.lastUpdated),
    isAtRisk: (() => {
      const lv = getSafeDate(c.globalStats?.lastVisit || c.lastUpdated);
      return lv ? daysBetween(today, lv) > 45 : false;
    })(),
  }));

  // ── VIP lapsed (at-risk VIPs) ────────────────────────────────────────
  const vipLapsed = vipCustomers.filter(v => v.isAtRisk);

  // ── Birthday customers this month ────────────────────────────────────
  const thisMonth = today.getMonth() + 1; // 1-indexed
  const birthdayCustomers = allCustomers
    .filter(c => {
      if (!c.dob) return false;
      const parts = c.dob.split('-'); // YYYY-MM-DD
      return parts.length >= 2 && parseInt(parts[1], 10) === thisMonth;
    })
    .map(c => ({
      id: c.id, name: c.name, phone: c.phone,
      dob: c.dob,
      day: c.dob.split('-')[2],
    }))
    .sort((a, b) => parseInt(a.day) - parseInt(b.day));

  // ── Customer Lifetime Value ───────────────────────────────────────────
  const allCLVs    = allCustomers.map(c => c.globalStats?.totalSpent || 0).filter(v => v > 0);
  const avgCLV     = allCLVs.length > 0 ? allCLVs.reduce((s, v) => s + v, 0) / allCLVs.length : 0;
  const maxCLV     = allCLVs.length > 0 ? Math.max(...allCLVs) : 0;
  const totalCustomers = allCustomers.length;

  // CLV distribution buckets for chart
  const clvBuckets = [
    { label: '< ₹1k',      min: 0,     max: 1000,  count: 0 },
    { label: '₹1k–5k',     min: 1000,  max: 5000,  count: 0 },
    { label: '₹5k–15k',    min: 5000,  max: 15000, count: 0 },
    { label: '₹15k–50k',   min: 15000, max: 50000, count: 0 },
    { label: '> ₹50k',     min: 50000, max: Infinity, count: 0 },
  ];
  allCLVs.forEach(v => {
    const bucket = clvBuckets.find(b => v >= b.min && v < b.max);
    if (bucket) bucket.count++;
  });

  // ── New vs Returning by month (for stacked bar) ───────────────────────
  const monthlyCustomerData = groupByMonth(appts).map(({ monthLabel, appointments: mAppts }) => {
    const mDone     = mAppts.filter(isCompleted);
    const mReturn   = mDone.filter(a => a.isReturningClient).length;
    const mNew      = mDone.length - mReturn;
    return { month: monthLabel, newCustomers: mNew, returning: mReturn, total: mDone.length };
  });

  // ── Churn rate (customers active last month not active this month) ────
  const lastMonthPhones = new Set(
    appts
      .filter(a => {
        const d = getActualDate(a);
        if (!d) return false;
        const now = new Date();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return isCompleted(a) && d >= lastMonthStart && d <= lastMonthEnd;
      })
      .filter(a => a.clientPhone)
      .map(a => String(a.clientPhone))
  );
  const thisMonthPhones = new Set(
    appts
      .filter(a => {
        const d = getActualDate(a);
        if (!d) return false;
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return isCompleted(a) && d >= thisMonthStart;
      })
      .filter(a => a.clientPhone)
      .map(a => String(a.clientPhone))
  );
  const churnedCount = [...lastMonthPhones].filter(p => !thisMonthPhones.has(p)).length;
  const churnRate    = lastMonthPhones.size > 0 ? (churnedCount / lastMonthPhones.size) * 100 : 0;

  // ── Customer Lifetime Value (CLV) estimation ──────────────────────────
  const avgBillValueCust = allCustomers.reduce((acc, c) => {
      const visits = c.globalStats?.totalVisits || 0;
      const spent = c.globalStats?.totalSpent || 0;
      if (visits > 0) {
          acc.spent += spent;
          acc.visits += visits;
      }
      return acc;
  }, { spent: 0, visits: 0 });
  const avgTicket = avgBillValueCust.visits > 0 ? avgBillValueCust.spent / avgBillValueCust.visits : 0;
  const estVisitsPerYear = avgVisitFrequency * (365 / (period === 'thisMonth' ? 30 : period === 'thisWeek' ? 7 : period === 'last3Months' ? 90 : period === 'thisYear' ? 365 : 30));
  
  let estimatedCLV = avgTicket * estVisitsPerYear * 2;
  if (!isFinite(estimatedCLV) || estimatedCLV === 0) {
    estimatedCLV = 'More data needed';
  }

  return {
    // Core metrics
    totalAppts, returningAppts, newAppts, retentionRate, retentionScore,
    uniqueCustomersInPeriod, totalCustomers,
    walkins, walkinPct, bookedPct,
    avgVisitFrequency, frequencyScore,
    // Cohorts
    cohortMatrix,
    // At-risk
    atRisk30, atRisk60, atRisk90, totalAtRisk,
    // VIP
    vipCustomers, vipLapsed, vipThreshold,
    // Birthdays
    birthdayCustomers,
    // CLV
    avgCLV, maxCLV, clvBuckets, estimatedCLV,
    // Monthly chart
    monthlyCustomerData,
    // Churn
    churnedCount, churnRate,
  };
}
