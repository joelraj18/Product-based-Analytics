// Monthly acquisition cohorts. A customer's cohort is the month of their
// first order; month k retention is the share of the cohort that ordered
// again k months later. Cancelled orders do not count as activity.
import { monthDiff } from './orders';

export const buildCohorts = (orders, { countCancelled = false } = {}) => {
  const active = orders.filter(o => o.customer && (countCancelled || o.bucket !== 'cancelled'));
  if (!active.length) return { cohorts: [], maxOffset: 0, curve: [] };
  const lastMonth = active[active.length - 1].month;
  const first = {};
  active.forEach(o => { if (!first[o.customer] || o.month < first[o.customer]) first[o.customer] = o.month; });
  const cells = {}; // cohort → offset → { customers:Set, revenue }
  active.forEach(o => {
    const c = first[o.customer];
    const k = monthDiff(c, o.month);
    const row = cells[c] || (cells[c] = {});
    const cell = row[k] || (row[k] = { customers: new Set(), revenue: 0 });
    cell.customers.add(o.customer);
    cell.revenue += o.amount;
  });
  const cohorts = Object.keys(cells).sort().map(c => {
    const size = cells[c][0].customers.size;
    const span = monthDiff(c, lastMonth);
    const values = [];
    for (let k = 0; k <= span; k++) {
      const cell = cells[c][k];
      const n = cell ? cell.customers.size : 0;
      values.push({ offset: k, active: n, rate: n / size, revenue: cell ? cell.revenue : 0, revenuePerCustomer: (cell ? cell.revenue : 0) / size });
    }
    return { cohort: c, size, values };
  });
  const maxOffset = Math.max(...cohorts.map(c => c.values.length - 1));
  // Size weighted average retention, using only cohorts old enough to have
  // reached that month.
  const curve = [];
  for (let k = 0; k <= maxOffset; k++) {
    const reached = cohorts.filter(c => c.values.length > k);
    const size = reached.reduce((s, c) => s + c.size, 0);
    const act = reached.reduce((s, c) => s + c.values[k].active, 0);
    curve.push({ offset: k, rate: size ? act / size : null, cohorts: reached.length });
  }
  return { cohorts, maxOffset, curve };
};

export const repeatStats = (orders) => {
  const counts = {};
  orders.filter(o => o.customer && o.bucket !== 'cancelled').forEach(o => { counts[o.customer] = (counts[o.customer] || 0) + 1; });
  const n = Object.keys(counts).length;
  const repeaters = Object.values(counts).filter(c => c > 1).length;
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  return { customers: n, repeaters, repeatRate: n ? repeaters / n : null, ordersPerCustomer: n ? total / n : null };
};
