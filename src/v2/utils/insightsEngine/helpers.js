// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Shared Helpers
// Pure functions. No React. No Firestore. Fully testable.
// ═══════════════════════════════════════════════════════════════════

/**
 * Safely converts a Firestore Timestamp, Date, number, or string to a JS Date.
 * Returns null if the value cannot be parsed.
 */
export function getSafeDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts.getTime === 'function') return ts;
  if (typeof ts === 'number') return new Date(ts);
  if (ts.seconds) return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1_000_000);
  const parsed = new Date(ts);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Returns the most accurate timestamp for an appointment document.
 * Falls back through createdAt → updatedAt → ID-encoded ms → timestamp.
 */
export function getActualDate(appt) {
  if (appt.createdAt) return getSafeDate(appt.createdAt);
  if (appt.updatedAt) return getSafeDate(appt.updatedAt);
  if (appt.id && typeof appt.id === 'string' && appt.id.startsWith('B')) {
    const ms = parseInt(appt.id.substring(1).toLowerCase(), 36);
    if (!isNaN(ms) && ms > 1_577_836_800_000 && ms < 2_208_988_800_000) {
      return new Date(ms);
    }
  }
  return getSafeDate(appt.timestamp);
}

/**
 * Formats a number as Indian Rupees with no decimals.
 */
export const inr = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);

/**
 * Returns {start, end, priorStart, priorEnd} Date objects for a given period key.
 */
export function getPeriodBounds(period) {
  const now = new Date();
  let start, end, priorStart, priorEnd;

  if (period === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    priorStart = new Date(start); priorStart.setDate(priorStart.getDate() - 1);
    priorEnd   = new Date(end);   priorEnd.setDate(priorEnd.getDate() - 1);

  } else if (period === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    priorStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    priorEnd   = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);

  } else if (period === 'thisWeek') {
    const day = now.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    start = new Date(now); start.setDate(now.getDate() + diff); start.setHours(0, 0, 0, 0);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    priorStart = new Date(start); priorStart.setDate(priorStart.getDate() - 7);
    priorEnd   = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1); priorEnd.setHours(23, 59, 59, 999);

  } else if (period === 'thisMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    priorEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  } else if (period === 'last3Months') {
    start = new Date(now); start.setMonth(start.getMonth() - 3); start.setDate(1); start.setHours(0, 0, 0, 0);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    priorStart = new Date(start); priorStart.setMonth(priorStart.getMonth() - 3);
    priorEnd   = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1); priorEnd.setHours(23, 59, 59, 999);

  } else if (period === 'thisYear') {
    start = new Date(now.getFullYear(), 0, 1);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    priorStart = new Date(now.getFullYear() - 1, 0, 1);
    priorEnd   = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else {
    // default: thisMonth
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now); end.setHours(23, 59, 59, 999);
    priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    priorEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  return { start, end, priorStart, priorEnd };
}

/**
 * Returns the short day name for a Date object.
 */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Groups an array of appointments by day-of-week (0=Sun…6=Sat).
 * Returns a map: dayIndex → array of appointments.
 */
export function groupByDayOfWeek(appointments) {
  const map = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  appointments.forEach(a => {
    const d = getActualDate(a);
    if (d) map[d.getDay()].push(a);
  });
  return map;
}

/**
 * Groups appointments by hour of day (0–23).
 */
export function groupByHour(appointments) {
  const map = {};
  for (let h = 0; h < 24; h++) map[h] = [];
  appointments.forEach(a => {
    const d = getActualDate(a);
    if (d) map[d.getHours()].push(a);
  });
  return map;
}

/**
 * Groups appointments into calendar weeks.
 * Returns [{weekLabel, appointments}] sorted oldest first.
 */
export function groupByWeek(appointments) {
  const map = {};
  appointments.forEach(a => {
    const d = getActualDate(a);
    if (!d) return;
    const mon = new Date(d);
    const dayOfWeek = mon.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    mon.setDate(mon.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    const key = mon.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { weekLabel: key, appointments: [], _ts: mon.getTime() };
    map[key].appointments.push(a);
  });
  return Object.values(map).sort((a, b) => a._ts - b._ts);
}

/**
 * Groups appointments by calendar month.
 * Returns [{monthLabel, appointments}] sorted oldest first.
 */
export function groupByMonth(appointments) {
  const map = {};
  appointments.forEach(a => {
    const d = getActualDate(a);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!map[key]) map[key] = { key, monthLabel: label, appointments: [], _ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
    map[key].appointments.push(a);
  });
  return Object.values(map).sort((a, b) => a._ts - b._ts);
}

/**
 * Groups appointments by calendar date (YYYY-MM-DD).
 * Returns [{dateLabel, appointments}] sorted oldest first.
 */
export function groupByDate(appointments) {
  const map = {};
  appointments.forEach(a => {
    const d = getActualDate(a);
    if (!d) return;
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (!map[key]) map[key] = { key, dateLabel: label, appointments: [], _ts: d.setHours(0, 0, 0, 0) };
    map[key].appointments.push(a);
  });
  return Object.values(map).sort((a, b) => a._ts - b._ts);
}

/** Filters to completed appointments only */
export const isCompleted = (a) =>
  (a.status || 'completed').toLowerCase() === 'completed';

/** Filters to cancelled/no-show appointments */
export const isCancelled = (a) =>
  ['cancelled', 'no_show', 'void'].includes((a.status || '').toLowerCase());

/** Returns all line items from an appointment (services, products, memberships, packages) */
export function getAllItems(a) {
  if (a.services || a.products || a.memberships || a.packages || a.walletTopups || a.walletRecharges) {
    return [
      ...(a.services       || []),
      ...(a.products       || []),
      ...(a.memberships    || []),
      ...(a.packages       || []),
      ...(a.walletTopups   || []),
      ...(a.walletRecharges || []),
    ];
  }
  return a.items || [];
}

/** Returns total revenue of product items on an appointment */
export function getProductTotal(a) {
  return getAllItems(a)
    .filter(i => i.type === 'product')
    .reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
}

/** Returns salon revenue (totalAmount minus product portion) */
export function getSalonAmount(a) {
  return Math.max(0, (a.totalAmount || 0) - getProductTotal(a));
}

/**
 * Linearly maps a value in [inMin, inMax] to [outMin, outMax], clamped.
 */
export function linearMap(value, inMin, inMax, outMin = 0, outMax = 100) {
  if (inMax === inMin) return outMin;
  const mapped = ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
  return Math.max(outMin, Math.min(outMax, mapped));
}

/**
 * Maps a growth percentage (-100% to +100%) to a 0–100 score.
 * Growth >= +20% → 100.  No growth → 50.  Drop -20%+ → 0.
 */
export function growthToScore(pct) {
  return linearMap(pct, -20, 20, 0, 100);
}

/**
 * Calculates the mode (most frequent) element in an array.
 */
export function mode(arr) {
  if (!arr || arr.length === 0) return null;
  const freq = {};
  arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Formats a percentage with one decimal place and a sign.
 */
export function fmtPct(value, decimals = 1) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}%`;
}

/**
 * Returns the number of days between two Date objects.
 */
export function daysBetween(d1, d2) {
  return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}
