// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Appointment Computation
// ═══════════════════════════════════════════════════════════════════
import { isCompleted, isCancelled, getActualDate, groupByDate, DAY_NAMES, linearMap } from './helpers.js';

/**
 * Computes appointment intelligence metrics.
 * @param {Array} appts - Current period appointments
 * @returns {Object} appointment analytics object
 */
export function computeAppointments(appts) {
  const done      = appts.filter(isCompleted);
  const cancelled = appts.filter(isCancelled);
  const noShows   = appts.filter(a => (a.status || '').toLowerCase() === 'no_show');
  const scheduled = appts.filter(a => ['scheduled', 'confirmed', 'pending'].includes((a.status || '').toLowerCase()));

  const total         = appts.length;
  const completedCount = done.length;
  const cancelledCount = cancelled.length;
  const noShowCount    = noShows.length;
  const scheduledCount = scheduled.length;

  // ── Rates ────────────────────────────────────────────────────────────
  const activeTotal       = completedCount + cancelledCount;
  const cancellationRate  = activeTotal > 0 ? (cancelledCount / activeTotal) * 100 : 0;
  const noShowRate        = activeTotal > 0 ? (noShowCount / activeTotal) * 100 : 0;
  const conversionRate    = total > 0 ? (completedCount / total) * 100 : 0;
  const conversionScore   = linearMap(conversionRate, 50, 95, 0, 100);
  const cancellationScore = linearMap(100 - cancellationRate, 70, 100, 0, 100);

  // Walk-in ratio
  const walkins    = done.filter(a => !a.clientPhone || a.clientName === 'Walk-in').length;
  const walkinPct  = completedCount > 0 ? (walkins / completedCount) * 100 : 0;

  // ── By day of week ───────────────────────────────────────────────────
  const dowMap = { 0: { done: 0, cancelled: 0 }, 1: { done: 0, cancelled: 0 }, 2: { done: 0, cancelled: 0 },
                   3: { done: 0, cancelled: 0 }, 4: { done: 0, cancelled: 0 }, 5: { done: 0, cancelled: 0 }, 6: { done: 0, cancelled: 0 } };
  appts.forEach(a => {
    const d = getActualDate(a);
    if (!d) return;
    const dow = d.getDay();
    if (isCompleted(a))  dowMap[dow].done++;
    if (isCancelled(a))  dowMap[dow].cancelled++;
  });

  const byDayOfWeek = DAY_NAMES.map((name, idx) => ({
    day: name, dayIdx: idx,
    completed:  dowMap[idx].done,
    cancelled:  dowMap[idx].cancelled,
    total:      dowMap[idx].done + dowMap[idx].cancelled,
    cancelRate: (dowMap[idx].done + dowMap[idx].cancelled) > 0
      ? (dowMap[idx].cancelled / (dowMap[idx].done + dowMap[idx].cancelled)) * 100 : 0,
  }));

  const peakDay = [...byDayOfWeek].sort((a, b) => b.completed - a.completed)[0]?.day || '—';
  const idleDayEntry = [...byDayOfWeek].filter(d => d.completed > 0).sort((a, b) => a.completed - b.completed)[0];
  const idleDay = idleDayEntry?.day || '—';

  // ── By hour of day ───────────────────────────────────────────────────
  const hourMap = {};
  for (let h = 7; h <= 22; h++) hourMap[h] = { completed: 0, cancelled: 0 };

  appts.forEach(a => {
    const d = getActualDate(a);
    if (!d) return;
    const h = d.getHours();
    if (h < 7 || h > 22) return;
    if (!hourMap[h]) hourMap[h] = { completed: 0, cancelled: 0 };
    if (isCompleted(a))  hourMap[h].completed++;
    if (isCancelled(a))  hourMap[h].cancelled++;
  });

  const byHour = Object.entries(hourMap).map(([hour, data]) => {
    const h = Number(hour);
    return {
      hour: h,
      label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
      completed:  data.completed,
      cancelled:  data.cancelled,
      total:      data.completed + data.cancelled,
    };
  });

  const peakHourEntry = [...byHour].sort((a, b) => b.completed - a.completed)[0];
  const peakHour      = peakHourEntry?.label || '—';
  const peakHourNum   = peakHourEntry?.hour  || null;

  // ── Heatmap data (day × hour) ─────────────────────────────────────────
  // Returns {dow, hour, count} for the booking density grid
  const heatmapData = [];
  appts.filter(isCompleted).forEach(a => {
    const d = getActualDate(a);
    if (!d) return;
    heatmapData.push({ dow: d.getDay(), hour: d.getHours() });
  });

  // Aggregate into a map for the grid
  const heatmapGrid = {};
  heatmapData.forEach(({ dow, hour }) => {
    const key = `${dow}_${hour}`;
    heatmapGrid[key] = (heatmapGrid[key] || 0) + 1;
  });
  const maxHeatmapVal = Math.max(...Object.values(heatmapGrid), 1);

  // ── Idle slot identification ─────────────────────────────────────────
  // An idle slot = a day+hour combination that consistently has < 25% of the peak count
  const idleThreshold = maxHeatmapVal * 0.25;
  const idleSlots = Object.entries(heatmapGrid)
    .filter(([, count]) => count < idleThreshold)
    .map(([key]) => {
      const [dow, hour] = key.split('_').map(Number);
      return { dow, hour, day: DAY_NAMES[dow], hourLabel: hour < 12 ? `${hour}am` : `${hour - 12}pm` };
    });

  // Find the most consistently idle day+hour pair
  const idleSlotSummary = idleSlots.length > 0
    ? `${idleSlots[0].day} ${idleSlots[0].hourLabel}`
    : null;

  // ── Weekly cancellation trend ─────────────────────────────────────────
  const byDate = groupByDate(appts);
  // Build weekly aggregates
  const weeklyRates = [];
  const CHUNK = 7;
  for (let i = 0; i < byDate.length; i += CHUNK) {
    const chunk   = byDate.slice(i, i + CHUNK);
    const label   = chunk[0]?.dateLabel || '';
    const total   = chunk.reduce((s, { appointments: da }) => s + da.length, 0);
    const canc    = chunk.reduce((s, { appointments: da }) => s + da.filter(isCancelled).length, 0);
    weeklyRates.push({ week: label, cancelRate: total > 0 ? (canc / total) * 100 : 0, total, cancelled: canc });
  }

  return {
    // Totals
    total, completedCount, cancelledCount, noShowCount, scheduledCount,
    // Rates
    cancellationRate, noShowRate, conversionRate,
    conversionScore, cancellationScore,
    walkins, walkinPct,
    // Day of week
    byDayOfWeek, peakDay, idleDay,
    // Hour of day
    byHour, peakHour, peakHourNum,
    // Heatmap
    heatmapGrid, maxHeatmapVal, heatmapData,
    // Idle slots
    idleSlots, idleSlotSummary,
    // Weekly trend
    weeklyRates,
  };
}
