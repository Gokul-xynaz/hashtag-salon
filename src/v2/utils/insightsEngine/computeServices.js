// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Service Computation
// ═══════════════════════════════════════════════════════════════════
import { isCompleted, getAllItems, groupByMonth } from './helpers.js';

/**
 * Computes service intelligence metrics.
 * @param {Array} appts      - Current period appointments
 * @param {Array} priorAppts - Prior period appointments
 * @param {Array} allServices - Service catalogue from DataProvider
 * @returns {Object} service analytics object
 */
export function computeServices(appts, priorAppts, allServices = []) {
  const done      = appts.filter(isCompleted);
  const priorDone = priorAppts.filter(isCompleted);

  // Build a lookup for costPrice
  const serviceCostMap = {};
  allServices.forEach(s => {
    serviceCostMap[s.name?.trim()] = Number(s.costPrice) || 0;
  });

  // ── Service aggregation helper ───────────────────────────────────────
  const buildServiceMap = (appointments) => {
    const map = {};
    appointments.forEach(a => {
      getAllItems(a)
        .filter(i => i.type !== 'product' && i.name)
        .forEach(i => {
          const name  = i.name.trim();
          const price = (Number(i.price) || 0) * (Number(i.qty) || 1);
          const count = Number(i.qty) || 1;
          const cost  = (serviceCostMap[name] || 0) * count;
          
          if (!map[name]) map[name] = { name, count: 0, revenue: 0, cost: 0, bills: new Set() };
          map[name].count   += count;
          map[name].revenue += price;
          map[name].cost    += cost;
          map[name].bills.add(a.id);
        });
    });
    // Convert Set to count and calculate margin
    return Object.values(map).map(s => ({
      ...s,
      billCount: s.bills.size,
      avgPrice: s.count > 0 ? s.revenue / s.count : 0,
      margin: s.revenue - s.cost
    }));
  };

  const currentServices = buildServiceMap(done);
  const priorServices   = buildServiceMap(priorDone);

  // ── Growth rate per service ──────────────────────────────────────────
  const priorServiceMap = {};
  priorServices.forEach(s => { priorServiceMap[s.name] = s; });

  const servicesWithGrowth = currentServices.map(s => {
    const prior = priorServiceMap[s.name];
    const growthPct = prior && prior.count > 0
      ? ((s.count - prior.count) / prior.count) * 100
      : s.count > 0 ? 100 : 0;
    return { ...s, growthPct, priorCount: prior?.count || 0, priorRevenue: prior?.revenue || 0 };
  });

  // Also include services that existed in prior but not current (declining)
  const currentNames = new Set(currentServices.map(s => s.name));
  priorServices.forEach(ps => {
    if (!currentNames.has(ps.name)) {
      servicesWithGrowth.push({
        name: ps.name, count: 0, revenue: 0, billCount: 0, avgPrice: ps.avgPrice,
        growthPct: -100, priorCount: ps.count, priorRevenue: ps.revenue,
      });
    }
  });

  // ── Rankings ─────────────────────────────────────────────────────────
  const byCount   = [...servicesWithGrowth].sort((a, b) => b.count - a.count);
  const byRevenue = [...servicesWithGrowth].sort((a, b) => b.revenue - a.revenue);
  const byGrowth  = [...servicesWithGrowth].filter(s => s.count > 0).sort((a, b) => b.growthPct - a.growthPct);
  const byDecline = [...servicesWithGrowth].filter(s => s.growthPct < -10).sort((a, b) => a.growthPct - b.growthPct);

  const mostBooked      = byCount[0]     || null;
  const highestRevenue  = byRevenue[0]   || null;
  const fastestGrowing  = byGrowth[0]    || null;
  const leastBooked     = [...byCount].filter(s => s.count > 0).slice(-1)[0] || null;
  const deadServices    = servicesWithGrowth.filter(s => s.count === 0 && s.priorCount > 0);

  // Top 5 for charts
  const top5ByRevenue = byRevenue.slice(0, 5);
  const top10ByCount  = byCount.slice(0, 10);

  // Total service revenue in period
  const totalServiceRevenue = done.reduce((s, a) => {
    return s + getAllItems(a).filter(i => i.type !== 'product').reduce((ss, i) => ss + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  }, 0);

  // Revenue concentration: does one service dominate?
  const topServiceRevenuePct = totalServiceRevenue > 0 && highestRevenue
    ? (highestRevenue.revenue / totalServiceRevenue) * 100 : 0;

  // Average services per bill
  const avgServicesPerBill = done.length > 0
    ? getAllItems(done.flatMap(a => a.services || a.items || []).filter(i => i.type !== 'product')).length / done.length
    : 0;

  // ── Combo affinity ───────────────────────────────────────────────────
  // Which pairs of services appear most often in the same bill?
  const comboCounts = {};
  done.forEach(a => {
    const svcNames = getAllItems(a)
      .filter(i => i.type !== 'product' && i.name)
      .map(i => i.name.trim());
    const uniqueNames = [...new Set(svcNames)];
    for (let x = 0; x < uniqueNames.length; x++) {
      for (let y = x + 1; y < uniqueNames.length; y++) {
        const pair = [uniqueNames[x], uniqueNames[y]].sort().join(' + ');
        comboCounts[pair] = (comboCounts[pair] || 0) + 1;
      }
    }
  });
  const topCombos = Object.entries(comboCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair, count]) => {
      const total = done.length;
      return { pair, count, pct: total > 0 ? (count / total) * 100 : 0 };
    });
  const bestCombo = topCombos[0] || null;

  // ── Monthly trend per service (top 5) ─────────────────────────────────
  const monthlyTrend = groupByMonth([...appts, ...priorAppts]).map(({ monthLabel, appointments: mAppts }) => {
    const mDone = mAppts.filter(isCompleted);
    const row   = { month: monthLabel };
    top5ByRevenue.forEach(svc => {
      row[svc.name] = mDone.reduce((s, a) =>
        s + getAllItems(a).filter(i => i.name?.trim() === svc.name && i.type !== 'product')
          .reduce((ss, i) => ss + (Number(i.price) || 0) * (Number(i.qty) || 1), 0), 0);
    });
    return row;
  });

  // ── 4-Quadrant matrix ─────────────────────────────────────────────────
  // Stars (high margin + high growth), Cash Cows (high margin + low growth),
  // Question Marks (low margin + high growth), Dogs (low margin + low growth)
  const sortedByMargin = [...servicesWithGrowth].filter(s => s.count > 0).sort((a, b) => b.margin - a.margin);
  const medianMargin = sortedByMargin[Math.floor(sortedByMargin.length / 2)]?.margin || 0;
  
  const quadrantData  = servicesWithGrowth.filter(s => s.count > 0).map(s => ({
    name:     s.name,
    revenue:  s.revenue,
    margin:   s.margin,
    growth:   s.growthPct,
    quadrant: s.margin >= medianMargin && s.growthPct >= 0  ? 'star'
            : s.margin >= medianMargin && s.growthPct < 0   ? 'cashcow'
            : s.margin <  medianMargin && s.growthPct >= 0  ? 'question'
            : 'dog',
  }));

  return {
    // Rankings
    byCount, byRevenue, byGrowth, byDecline,
    mostBooked, highestRevenue, fastestGrowing, leastBooked, deadServices,
    top5ByRevenue, top10ByCount,
    // Totals
    totalServiceRevenue, topServiceRevenuePct, avgServicesPerBill,
    // Combos
    topCombos, bestCombo,
    // Charts
    monthlyTrend, quadrantData,
  };
}
