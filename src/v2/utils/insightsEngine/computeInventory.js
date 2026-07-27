// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Inventory Computation
// ═══════════════════════════════════════════════════════════════════
import { isCompleted, getAllItems, getActualDate } from './helpers.js';

/**
 * Computes inventory intelligence.
 * @param {Array} products - Products from DataProvider
 * @param {Array} appts    - Current period appointments (for sold units)
 * @returns {Object} inventory analytics object
 */
export function computeInventory(products, appts) {
  if (!products || products.length === 0) {
    return {
      totalProducts: 0, totalStockValue: 0, lowStockItems: [], deadStockItems: [],
      fastMovers: [], slowMovers: [], productSalesMap: {}, reorderAlerts: [],
    };
  }

  const done = appts.filter(isCompleted);

  // ── Units sold per product (in period) ──────────────────────────────
  const soldMap = {}; // productName → { units, revenue }
  done.forEach(a => {
    getAllItems(a)
      .filter(i => i.type === 'product' && i.name)
      .forEach(i => {
        const name = i.name.trim();
        if (!soldMap[name]) soldMap[name] = { name, units: 0, revenue: 0, lastSoldDate: null };
        soldMap[name].units   += Number(i.qty)   || 1;
        soldMap[name].revenue += (Number(i.price) || 0) * (Number(i.qty) || 1);
        const d = getActualDate(a);
        if (d && (!soldMap[name].lastSoldDate || d > soldMap[name].lastSoldDate)) {
          soldMap[name].lastSoldDate = d;
        }
      });
  });

  // ── Enrich products with sales data ─────────────────────────────────
  const enriched = products.map(p => {
    const name  = (p.name || '').trim();
    const sales = soldMap[name] || { units: 0, revenue: 0, lastSoldDate: null };
    const stock       = p.stock  || 0;
    const retailPrice = p.price  || 0;
    const costPrice   = p.costPrice || 0;

    // Days of stock remaining (based on daily sell rate in period)
    const periodDays = 30; // approximate — will be refined by actual period length
    const dailySellRate = sales.units / periodDays;
    const daysOfStockLeft = dailySellRate > 0 ? Math.round(stock / dailySellRate) : null;

    return {
      id:           p.id,
      name,
      stock,
      retailPrice,
      costPrice,
      category:     p.category || 'Uncategorised',
      unitsSold:    sales.units,
      revenue:      sales.revenue,
      lastSoldDate: sales.lastSoldDate,
      stockValue:   stock * retailPrice,
      profit:       sales.revenue - (sales.units * costPrice),
      daysOfStockLeft,
      dailySellRate,
    };
  });

  // ── Total stock value ────────────────────────────────────────────────
  const totalStockValue = enriched.reduce((s, p) => s + p.stockValue, 0);
  const totalProducts   = enriched.length;

  // ── Status buckets ───────────────────────────────────────────────────
  const lowStockItems  = enriched.filter(p => p.stock > 0 && p.stock < 5).sort((a, b) => a.stock - b.stock);
  const outOfStock     = enriched.filter(p => p.stock === 0);

  // Dead stock: not sold in 90 days (last sold date is old or never sold)
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const deadStockItems = enriched.filter(p => {
    if (p.stock === 0) return false; // already out of stock
    if (!p.lastSoldDate) return true; // never sold = dead
    return p.lastSoldDate < ninetyDaysAgo;
  }).sort((a, b) => b.stockValue - a.stockValue);

  // ── Fast vs slow movers ─────────────────────────────────────────────
  const withSales   = enriched.filter(p => p.unitsSold > 0);
  const medianUnits = withSales.length > 0
    ? withSales.sort((a, b) => a.unitsSold - b.unitsSold)[Math.floor(withSales.length / 2)]?.unitsSold || 0
    : 0;

  const fastMovers = enriched.filter(p => p.unitsSold > Math.max(medianUnits, 5))
    .sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10);

  const slowMovers = enriched.filter(p => p.unitsSold > 0 && p.unitsSold <= Math.max(Math.floor(medianUnits * 0.3), 1))
    .sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 10);

  // ── Restock recommendations ──────────────────────────────────────────
  // Products where daysOfStockLeft < 14 and they're selling
  const reorderAlerts = enriched
    .filter(p => p.daysOfStockLeft !== null && p.daysOfStockLeft < 14 && p.dailySellRate > 0)
    .sort((a, b) => (a.daysOfStockLeft || 999) - (b.daysOfStockLeft || 999))
    .map(p => ({
      ...p,
      urgency: p.daysOfStockLeft < 3 ? 'critical' : p.daysOfStockLeft < 7 ? 'warning' : 'info',
      suggestedReorderQty: Math.ceil(p.dailySellRate * 30), // 30-day supply
    }));

  // ── Product sales map (for external reference) ───────────────────────
  const productSalesMap = {};
  enriched.forEach(p => { productSalesMap[p.name] = p; });

  // ── Top by revenue ───────────────────────────────────────────────────
  const topByRevenue = enriched.filter(p => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  return {
    totalProducts, totalStockValue,
    enriched, productSalesMap,
    lowStockItems, outOfStock, deadStockItems,
    fastMovers, slowMovers,
    reorderAlerts, topByRevenue,
  };
}
