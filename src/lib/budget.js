import { monthKey } from './dates';
import { withDefaults } from './capacity';

// Variable cost of one plan week. Vendor lines bill per unit handled.
export const weekCost = (params, row, volume) => {
  const p = withDefaults(params);
  if (p.costModel === 'perUnit') {
    const base = (Number(volume) || 0) * p.costPerUnit;
    return { base, overtime: 0, hiring: 0, total: base };
  }
  const base = row.totalHC * p.hoursPerWeek * p.costPerHour;
  const overtime = row.otHours * p.costPerHour * p.otMultiplier;
  const hiring = row.hires * p.hireCost;
  return { base, overtime, hiring, total: base + overtime + hiring };
};

export const costRows = (params, simRows, weeks, volumes) => simRows.map((row, i) => ({
  weekStart: weeks[i],
  month: monthKey(weeks[i]),
  volume: volumes[i] || 0,
  ...weekCost(params, row, volumes[i]),
}));

export const rollupByMonth = (rows) => {
  const acc = {};
  rows.forEach(r => {
    const m = acc[r.month] || (acc[r.month] = { month: r.month, base: 0, overtime: 0, hiring: 0, total: 0, volume: 0 });
    m.base += r.base; m.overtime += r.overtime; m.hiring += r.hiring; m.total += r.total; m.volume += r.volume;
  });
  return Object.values(acc).sort((a, b) => a.month.localeCompare(b.month));
};

export const costPerUnit = (cost, volume) => (volume > 0 ? cost / volume : 0);

// Variance vs an operating-plan target: positive = over budget.
export const variance = (actual, target) => ({
  abs: actual - target,
  pct: target ? ((actual - target) / target) * 100 : 0,
});
