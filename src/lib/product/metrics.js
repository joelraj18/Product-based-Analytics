// Metric tree: net revenue (the North Star) decomposed into drivers that
// multiply back to it exactly, so a change can be attributed to each driver.
//
//   net revenue = active customers × orders per customer × AOV × keep rate
//   keep rate   = net revenue ÷ gross revenue (share not lost to cancels and returns)
import { isNet, addMonths } from './orders';

// Orders grouped by month and each customer's first month, built once per
// orders array: monthStats runs a dozen times per screen, and rescanning
// 100,000 orders each time adds up.
const indexes = new WeakMap();
const indexOf = (orders) => {
  let ix = indexes.get(orders);
  if (!ix) {
    const byMonth = new Map();
    const firstMonth = new Map();
    orders.forEach(o => {
      if (!byMonth.has(o.month)) byMonth.set(o.month, []);
      byMonth.get(o.month).push(o);
      if (o.customer) {
        const f = firstMonth.get(o.customer);
        if (f === undefined || o.month < f) firstMonth.set(o.customer, o.month);
      }
    });
    ix = { byMonth, firstMonth };
    indexes.set(orders, ix);
  }
  return ix;
};

export const monthStats = (orders, month) => {
  const { byMonth, firstMonth } = indexOf(orders);
  const rows = byMonth.get(month) || [];
  const customers = new Set(rows.filter(o => o.customer).map(o => o.customer));
  const seenBefore = { has: (c) => firstMonth.get(c) < month };
  const gross = rows.reduce((s, o) => s + o.amount, 0);
  const net = rows.filter(isNet).reduce((s, o) => s + o.amount, 0);
  const count = (b) => rows.filter(o => o.bucket === b).length;
  const returning = [...customers].filter(c => seenBefore.has(c)).length;
  const closed = count('delivered') + count('returned');
  return {
    month,
    orders: rows.length,
    gross,
    net,
    customers: customers.size,
    newCustomers: customers.size - returning,
    returning,
    ordersPerCustomer: customers.size ? rows.filter(o => o.customer).length / customers.size : null,
    aov: rows.length ? gross / rows.length : null,
    keepRate: gross ? net / gross : null,
    cancelRate: rows.length ? count('cancelled') / rows.length : null,
    returnRate: closed ? count('returned') / closed : null,
    returningShare: customers.size ? returning / customers.size : null,
  };
};

// Splits the change in net revenue between drivers with a log decomposition:
// each driver gets ln(ratio) ÷ ln(total ratio) of the change, and the parts
// add up exactly to the total change.
export const attributeChange = (cur, prev) => {
  const drivers = [
    ['customers', 'Active customers'],
    ['ordersPerCustomer', 'Orders per customer'],
    ['aov', 'Average order value'],
    ['keepRate', 'Keep rate'],
  ];
  const total = cur.net - prev.net;
  const lnTotal = Math.log(cur.net / prev.net);
  if (!Number.isFinite(lnTotal) || Math.abs(lnTotal) < 1e-12) {
    return drivers.map(([key, label]) => ({ key, label, ratio: cur[key] / prev[key], contribution: 0 }));
  }
  return drivers.map(([key, label]) => {
    const r = cur[key] / prev[key];
    return { key, label, ratio: r, contribution: (Math.log(r) / lnTotal) * total };
  });
};

export const monthlySeries = (orders, lastMonth, n = 12) => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthStats(orders, addMonths(lastMonth, -i)));
  return out.filter(m => m.orders > 0);
};

// KPI dictionary: one agreed definition per metric.
export const KPI_DICTIONARY = [
  { key: 'net', name: 'Net revenue', role: 'North Star', definition: 'Revenue from orders that were not cancelled or returned', formula: 'SUM(amount) WHERE status NOT IN (Cancelled, Returned)', grain: 'Month', better: 'up' },
  { key: 'customers', name: 'Active customers', role: 'Driver', definition: 'Distinct customers who placed at least one order in the month', formula: 'COUNT(DISTINCT customer_id)', grain: 'Month', better: 'up' },
  { key: 'ordersPerCustomer', name: 'Orders per customer', role: 'Driver', definition: 'How often an active customer orders in the month', formula: 'orders ÷ active customers', grain: 'Month', better: 'up' },
  { key: 'aov', name: 'Average order value', role: 'Driver', definition: 'Average gross amount per order', formula: 'SUM(amount) ÷ COUNT(orders)', grain: 'Month', better: 'up' },
  { key: 'keepRate', name: 'Keep rate', role: 'Driver', definition: 'Share of gross revenue that is not lost to cancellations or returns', formula: 'net revenue ÷ gross revenue', grain: 'Month', better: 'up' },
  { key: 'newCustomers', name: 'New customers', role: 'Input', definition: 'Customers whose first ever order falls in the month', formula: 'COUNT(customers with MIN(date) in month)', grain: 'Month', better: 'up' },
  { key: 'returningShare', name: 'Returning share', role: 'Input', definition: 'Share of active customers who had ordered before', formula: 'returning ÷ active customers', grain: 'Month', better: 'up' },
  { key: 'cancelRate', name: 'Cancel rate', role: 'Guardrail', definition: 'Share of orders cancelled', formula: 'cancelled ÷ orders', grain: 'Month', better: 'down', limit: 0.12 },
  { key: 'returnRate', name: 'Return rate', role: 'Guardrail', definition: 'Share of delivered orders sent back', formula: 'returned ÷ (delivered + returned)', grain: 'Month', better: 'down', limit: 0.25 },
];
