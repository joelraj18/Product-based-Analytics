// Order fulfilment funnel. Each step keeps the orders that reached it, so
// counts never increase down the funnel.
export const FUNNEL_STEPS = [
  { key: 'placed', label: 'Placed', test: () => true, leak: null },
  { key: 'confirmed', label: 'Not cancelled', test: (o) => o.bucket !== 'cancelled', leak: 'Cancelled' },
  { key: 'shipped', label: 'Shipped', test: (o) => ['shipped', 'delivered', 'returned'].includes(o.bucket), leak: 'Still pending' },
  { key: 'delivered', label: 'Delivered', test: (o) => ['delivered', 'returned'].includes(o.bucket), leak: 'In transit' },
  { key: 'kept', label: 'Kept', test: (o) => o.bucket === 'delivered', leak: 'Returned' },
];

// maturityDays drops orders younger than N days, which are still in flight
// and would otherwise look like drop off.
export const buildFunnel = (orders, { maturityDays = 0 } = {}) => {
  const lastDay = orders.length ? orders[orders.length - 1].day : 0;
  const base = maturityDays > 0 ? orders.filter(o => lastDay - o.day >= maturityDays) : orders;
  const first = base.length;
  return FUNNEL_STEPS.map((s, i) => {
    const n = base.filter(s.test).length;
    const prev = i === 0 ? first : base.filter(FUNNEL_STEPS[i - 1].test).length;
    return {
      key: s.key,
      label: s.label,
      count: n,
      stepRate: prev ? n / prev : null,
      overallRate: first ? n / first : null,
      lost: prev - n,
      leak: s.leak,
      value: base.filter(s.test).reduce((t, o) => t + o.amount, 0),
    };
  });
};

// Funnel per segment (for example region), for side by side comparison.
export const funnelBySegment = (orders, segmentOf, opts) => {
  const groups = {};
  orders.forEach(o => { const k = segmentOf(o) || '(blank)'; (groups[k] = groups[k] || []).push(o); });
  return Object.entries(groups)
    .map(([segment, rows]) => ({ segment, steps: buildFunnel(rows, opts) }))
    .sort((a, b) => b.steps[0].count - a.steps[0].count);
};
