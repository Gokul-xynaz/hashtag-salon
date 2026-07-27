// ═══════════════════════════════════════════════════════════════════
// JX Billing — Insights Engine: Health Score Computation
// ═══════════════════════════════════════════════════════════════════


/**
 * Computes the Business Health Score (0–100) from all sub-analytics.
 * Must be called LAST — depends on all other computed sections.
 */
export function computeHealth(analytics) {
  const { revenue, customers, appointments, staff, financial, businessGoals } = analytics;

  // ── Sub-scores (each 0–100) ──────────────────────────────────────────

  // 1. Revenue Growth Score (25%)
  // For monthly/yearly, compare to target revenue if available
  let revenueScore = revenue?.revenueScore ?? 50;
  if (revenue && ['thisMonth', 'lastMonth'].includes(analytics.meta?.period) && businessGoals?.targetMonthlyRevenue > 0) {
    revenueScore = Math.min(100, Math.max(0, (revenue.totalRevenue / businessGoals.targetMonthlyRevenue) * 100));
  }

  // 2. Customer Retention Score (20%)
  let retentionScore = customers?.retentionScore ?? 50;
  if (customers && businessGoals?.targetRetention > 0) {
    // Map 0 to Target as 0 to 100
    retentionScore = Math.min(100, Math.max(0, (customers.retentionRate / businessGoals.targetRetention) * 100));
  }

  // 3. Appointment Conversion Score (15%)
  const conversionScore = appointments?.conversionScore ?? 50;

  // 4. Staff Utilisation Score (15%)
  let utilisationScore = staff?.utilisationScore ?? 50;
  if (staff && staff.staffCards && businessGoals?.targetUtilization > 0) {
    const avgUtil = staff.staffCards.reduce((s, a) => s + (a.utilisationPct || 0), 0) / (staff.staffCards.length || 1);
    utilisationScore = Math.min(100, Math.max(0, (avgUtil / businessGoals.targetUtilization) * 100));
  }

  // 5. Expense Control Score (15%)
  const expenseScore = financial?.expenseScore ?? 50;

  // 6. Customer Visit Frequency Score (10%)
  const frequencyScore = customers?.frequencyScore ?? 50;

  // ── Weighted sum ─────────────────────────────────────────────────────
  const finalScore = Math.round(
    revenueScore    * 0.25 +
    retentionScore  * 0.20 +
    conversionScore * 0.15 +
    utilisationScore * 0.15 +
    expenseScore    * 0.15 +
    frequencyScore  * 0.10
  );

  const clamped = Math.max(0, Math.min(100, finalScore));

  // ── Narrative ─────────────────────────────────────────────────────────
  let band, color, emoji, narrative;

  if (clamped >= 85) {
    band = 'Excellent'; color = '#16a34a'; emoji = '🚀';
    narrative = `Your business is performing excellently. Revenue is growing, customers are returning, and your team is productive. Keep this momentum going.`;
  } else if (clamped >= 66) {
    band = 'Good'; color = '#2563eb'; emoji = '📈';
    const weakest = getWeakestArea(revenueScore, retentionScore, conversionScore, utilisationScore, expenseScore, frequencyScore);
    narrative = `Overall performance is good. ${weakest.message} Focus there for the biggest impact.`;
  } else if (clamped >= 41) {
    band = 'Fair'; color = '#d97706'; emoji = '⚠️';
    const weakest = getWeakestArea(revenueScore, retentionScore, conversionScore, utilisationScore, expenseScore, frequencyScore);
    narrative = `The business has some areas that need attention. ${weakest.message}`;
  } else {
    band = 'Critical'; color = '#dc2626'; emoji = '🚨';
    narrative = `The business needs immediate attention. Multiple key metrics are underperforming. Review the recommendations below for priority actions.`;
  }

  const components = [
    { label: 'Revenue Growth',       score: revenueScore,     weight: '25%', icon: 'TrendingUp' },
    { label: 'Customer Retention',   score: retentionScore,   weight: '20%', icon: 'Users' },
    { label: 'Booking Conversion',   score: conversionScore,  weight: '15%', icon: 'Calendar' },
    { label: 'Staff Utilisation',    score: utilisationScore, weight: '15%', icon: 'Award' },
    { label: 'Expense Control',      score: expenseScore,     weight: '15%', icon: 'DollarSign' },
    { label: 'Customer Frequency',   score: frequencyScore,   weight: '10%', icon: 'RefreshCw' },
  ].sort((a, b) => b.score - a.score);

  return {
    score: clamped, band, color, emoji, narrative, components,
    revenueScore, retentionScore, conversionScore,
    utilisationScore, expenseScore, frequencyScore,
  };
}

function getWeakestArea(rev, ret, conv, util, exp, freq) {
  const areas = [
    { score: rev,  message: 'Revenue growth is slower than ideal.' },
    { score: ret,  message: 'Customer retention needs improvement — more clients are not returning.' },
    { score: conv, message: 'A significant number of appointments are being cancelled or not completing.' },
    { score: util, message: 'Staff utilisation has room to improve — there are idle hours available.' },
    { score: exp,  message: 'Expenses are high relative to revenue, squeezing your margins.' },
    { score: freq, message: 'Customers are not visiting frequently enough. Retention initiatives could help.' },
  ];
  return areas.sort((a, b) => a.score - b.score)[0];
}
