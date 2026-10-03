// RFM segmentation and customer lifetime value.
// Recency = days since last order, Frequency = orders, Monetary = net spend.
// Each is scored 1 to 5 by quintile (5 is best; for recency, fewer days is better).
import { isNet } from './orders';

// Quintile score from the value's average rank, so ties share a score.
export const quintileScores = (values, higherIsBetter = true) => {
  const n = values.length;
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const rank = new Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1; // 1 based average rank
    for (let k = i; k <= j; k++) rank[order[k][1]] = avg;
    i = j + 1;
  }
  return rank.map(r => {
    const s = Math.min(5, Math.max(1, Math.ceil((5 * (r - 0.5)) / n)));
    return higherIsBetter ? s : 6 - s;
  });
};

export const SEGMENTS = [
  { name: 'Champions', rule: 'R 4 to 5 and F 4 to 5', action: 'Reward, early access, referrals', test: (r, f) => r >= 4 && f >= 4 },
  { name: 'Loyal', rule: 'R 3 and F 4 to 5', action: 'Upsell and keep them engaged', test: (r, f) => r === 3 && f >= 4 },
  { name: 'Potential loyalists', rule: 'R 4 to 5 and F 2 to 3', action: 'Membership or bundle offers', test: (r, f) => r >= 4 && f >= 2 },
  { name: 'New', rule: 'R 4 to 5 and F 1', action: 'Onboarding and a second order nudge', test: (r, f) => r >= 4 && f === 1 },
  { name: 'At risk', rule: 'R 1 to 2 and F 3 to 5', action: 'Win back before they churn', test: (r, f) => r <= 2 && f >= 3 },
  { name: 'Needs attention', rule: 'R 3 and F 1 to 3', action: 'Personalised reminders', test: (r) => r === 3 },
  { name: 'Hibernating', rule: 'R 2 and F 1 to 2', action: 'Low cost reactivation', test: (r) => r === 2 },
  { name: 'Lost', rule: 'R 1 and F 1 to 2', action: 'Do not overspend, survey why', test: () => true },
];

export const buildRfm = (orders, { margin = 0.3, lifespanYears = 3 } = {}) => {
  const rows = orders.filter(o => o.customer && o.bucket !== 'cancelled');
  if (!rows.length) return { customers: [], segments: [], summary: null };
  const asOf = rows[rows.length - 1].day + 1;
  const firstDay = rows[0].day;
  const by = {};
  rows.forEach(o => {
    const c = by[o.customer] || (by[o.customer] = { customer: o.customer, first: o.day, last: o.day, orders: 0, gross: 0, net: 0 });
    c.first = Math.min(c.first, o.day);
    c.last = Math.max(c.last, o.day);
    c.orders += 1;
    c.gross += o.amount;
    if (isNet(o)) c.net += o.amount;
  });
  const list = Object.values(by).map(c => ({ ...c, recency: asOf - c.last }));
  const R = quintileScores(list.map(c => c.recency), false);
  const F = quintileScores(list.map(c => c.orders), true);
  const M = quintileScores(list.map(c => c.net), true);
  // Predictive CLV = AOV × orders per year × margin × expected lifespan.
  const totalNet = list.reduce((s, c) => s + c.net, 0);
  const totalOrders = list.reduce((s, c) => s + c.orders, 0);
  const years = Math.max((asOf - firstDay) / 365, 1 / 12);
  const aov = totalNet / totalOrders;
  const ordersPerYear = totalOrders / list.length / years;
  const clv = aov * ordersPerYear * margin * lifespanYears;
  const customers = list.map((c, i) => {
    const seg = SEGMENTS.find(s => s.test(R[i], F[i], M[i]));
    return {
      customer_id: c.customer,
      recency_days: c.recency,
      orders: c.orders,
      net_spend: Math.round(c.net),
      R: R[i], F: F[i], M: M[i],
      rfm: `${R[i]}${F[i]}${M[i]}`,
      segment: seg.name,
      // Customer level CLV scales the average by this customer's own pace.
      clv: Math.round((c.net / c.orders || aov) * (c.orders / Math.max((asOf - c.first) / 365, 1 / 12)) * margin * lifespanYears),
    };
  }).sort((a, b) => b.net_spend - a.net_spend);
  const segments = SEGMENTS.map(s => {
    const members = customers.filter(c => c.segment === s.name);
    const spend = members.reduce((t, c) => t + c.net_spend, 0);
    return { ...s, customers: members.length, share: members.length / customers.length, spend, spendShare: totalNet ? spend / totalNet : 0, avgRecency: members.length ? members.reduce((t, c) => t + c.recency_days, 0) / members.length : null };
  }).filter(s => s.customers > 0);
  const top = Math.max(1, Math.round(customers.length * 0.2));
  const topSpend = customers.slice(0, top).reduce((t, c) => t + c.net_spend, 0);
  return {
    customers,
    segments,
    summary: { customers: customers.length, aov, ordersPerYear, clv, top20Share: totalNet ? topSpend / totalNet : 0, margin, lifespanYears },
  };
};
