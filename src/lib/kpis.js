import { monthKey } from './dates';

const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
const wavg = (rows, k, w) => { const W = sum(rows, w); return W ? rows.reduce((s, r) => s + (Number(r[k]) || 0) * (Number(r[w]) || 0), 0) / W : NaN; };

// Roll weekly line-level actuals into planning KPIs for one period.
export const kpiRollup = (rows) => {
  const actual = sum(rows, 'actual_volume');
  const fcst = sum(rows, 'forecast_volume');
  const absErr = rows.reduce((s, r) => s + Math.abs((Number(r.actual_volume) || 0) - (Number(r.forecast_volume) || 0)), 0);
  const plannedHc = sum(rows, 'planned_hc');
  const costPlanned = sum(rows, 'cost_planned');
  const costActual = sum(rows, 'cost_actual');
  return {
    lineWeeks: rows.length,
    actual,
    forecast: fcst,
    wape: actual ? (100 * absErr) / actual : NaN,
    bias: actual ? (100 * (fcst - actual)) / actual : NaN,
    sl: wavg(rows, 'sl_actual', 'actual_volume'),
    slTarget: wavg(rows, 'sl_target', 'actual_volume'),
    slAttainment: rows.length ? (100 * rows.filter(r => Number(r.sl_actual) >= Number(r.sl_target)).length) / rows.length : NaN,
    occupancy: wavg(rows, 'occupancy', 'actual_volume'),
    shrinkVar: rows.length ? rows.reduce((s, r) => s + (Number(r.actual_shrinkage) - Number(r.planned_shrinkage)), 0) / rows.length : NaN,
    ahtVar: (() => { const p = wavg(rows, 'planned_aht', 'actual_volume'); const a = wavg(rows, 'actual_aht', 'actual_volume'); return p ? (100 * (a - p)) / p : NaN; })(),
    hcAdherence: plannedHc ? (100 * sum(rows, 'actual_hc')) / plannedHc : NaN,
    costVar: costPlanned ? (100 * (costActual - costPlanned)) / costPlanned : NaN,
    costActual,
    cpc: actual ? costActual / actual : NaN,
  };
};

export const periodKey = (weekStart, period) => (period === 'monthly' ? monthKey(weekStart) : weekStart);

export const rollupByPeriod = (rows, period) => {
  const groups = {};
  rows.forEach(r => { const k = periodKey(r.week_start, period); (groups[k] = groups[k] || []).push(r); });
  return Object.keys(groups).sort().map(k => ({ period: k, ...kpiRollup(groups[k]) }));
};

export const pareto = (defects) => {
  const counts = {};
  defects.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
  const total = defects.length;
  let cum = 0;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([category, count]) => {
    cum += count;
    return { category, count, pct: total ? (100 * count) / total : 0, cumPct: total ? (100 * cum) / total : 0 };
  });
};
