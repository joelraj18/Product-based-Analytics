import { seedOrders } from '../../../data/seed';
import { normalizeOrders, statusBucket, lastCompleteMonth, monthDiff, addMonths, hasCustomers } from '../orders';
import { monthStats, attributeChange, monthlySeries } from '../metrics';
import { buildFunnel, funnelBySegment } from '../funnel';
import { buildCohorts, repeatStats } from '../cohorts';
import { buildRfm, quintileScores, frequencyScore } from '../rfm';
import { normCdf, normInv, proportionTest, welchTest, sampleSize, srmCheck, tTwoSided } from '../experiment';
import { detectAnomalies, weeklyTotals } from '../anomaly';

const raw = seedOrders();
const orders = normalizeOrders(raw);

describe('demo orders', () => {
  test('every order has a customer, and repeat buyers exist', () => {
    expect(raw.every(o => /^CUST-\d+$/.test(o.customer_id))).toBe(true);
    const r = repeatStats(orders);
    expect(r.customers).toBeGreaterThan(100);
    expect(r.repeatRate).toBeGreaterThan(0.3);
    expect(hasCustomers(orders)).toBe(true);
  });
  test('the sample runs from January 2024 to December 2026 at scale', () => {
    expect(raw.length).toBeGreaterThan(10000);
    expect(raw[0].date).toBe('2024-01-01');
    expect(raw[raw.length - 1].date.slice(0, 7)).toBe('2026-12');
    expect(Object.keys(raw[0])).toEqual(['id', 'date', 'amount', 'units', 'status', 'region', 'category', 'fulfillment_center', 'customer_id']);
    expect(new Set(raw.map(o => o.id)).size).toBe(raw.length);
    // Year over year growth and a festive peak, so the dashboard has a story.
    const yr = (y) => raw.filter(o => o.date.startsWith(y)).reduce((s, o) => s + o.amount, 0);
    expect(yr('2025')).toBeGreaterThan(yr('2024'));
    expect(yr('2026')).toBeGreaterThan(yr('2025'));
    const month = (m) => raw.filter(o => o.date.startsWith(m)).length;
    expect(month('2025-11')).toBeGreaterThan(month('2025-02') * 1.4);
  });
  test('the sample is the same on every load', () => {
    expect(seedOrders().slice(0, 50)).toEqual(raw.slice(0, 50));
  });
});

describe('order helpers', () => {
  test('status buckets and month maths', () => {
    expect(['Delivered', 'Shipped', 'Pending', 'Cancelled', 'Returned', 'Refunded'].map(statusBucket)).toEqual(['delivered', 'shipped', 'pending', 'cancelled', 'returned', 'returned']);
    expect(monthDiff('2025-11', '2026-02')).toBe(3);
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
  test('last complete month skips a partial month', () => {
    const o = normalizeOrders([{ date: '2026-03-31', amount: 1 }, { date: '2026-04-12', amount: 1 }]);
    expect(lastCompleteMonth(o)).toBe('2026-03');
    expect(lastCompleteMonth(normalizeOrders([{ date: '2026-03-31', amount: 1 }]))).toBe('2026-03');
  });
});

describe('metric tree', () => {
  test('drivers multiply back to net revenue', () => {
    const m = monthStats(orders, lastCompleteMonth(orders));
    expect(m.customers * m.ordersPerCustomer * m.aov * m.keepRate).toBeCloseTo(m.net, 6);
  });
  test('attribution adds up to the total change', () => {
    const last = lastCompleteMonth(orders);
    const cur = monthStats(orders, last);
    const prev = monthStats(orders, addMonths(last, -1));
    const parts = attributeChange(cur, prev);
    expect(parts.reduce((s, p) => s + p.contribution, 0)).toBeCloseTo(cur.net - prev.net, 6);
    expect(monthlySeries(orders, last, 6).length).toBeGreaterThan(3);
  });
});

describe('funnel', () => {
  test('counts never increase and rates are consistent', () => {
    const f = buildFunnel(orders);
    f.slice(1).forEach((s, i) => expect(s.count).toBeLessThanOrEqual(f[i].count));
    expect(f[0].count).toBe(orders.length);
    expect(f[4].overallRate).toBeCloseTo(f[4].count / f[0].count);
    expect(f.slice(1).reduce((s, x) => s + x.lost, 0)).toBe(f[0].count - f[4].count);
  });
  test('maturity window drops recent orders', () => {
    expect(buildFunnel(orders, { maturityDays: 30 })[0].count).toBeLessThan(orders.length);
    expect(funnelBySegment(orders, o => o.raw.region).length).toBe(4);
  });
});

describe('cohorts', () => {
  test('month 0 is always 100% and sizes add up to all customers', () => {
    const { cohorts, curve } = buildCohorts(orders);
    cohorts.forEach(c => expect(c.values[0].rate).toBe(1));
    expect(cohorts.reduce((s, c) => s + c.size, 0)).toBe(repeatStats(orders).customers);
    expect(curve[0].rate).toBe(1);
    expect(curve[1].rate).toBeGreaterThan(0);
    expect(curve[1].rate).toBeLessThan(1);
  });
  test('hand built example', () => {
    const o = normalizeOrders([
      { date: '2026-01-05', amount: 10, status: 'Delivered', customer_id: 'a' },
      { date: '2026-01-09', amount: 10, status: 'Delivered', customer_id: 'b' },
      { date: '2026-02-03', amount: 10, status: 'Delivered', customer_id: 'a' },
      { date: '2026-03-03', amount: 10, status: 'Cancelled', customer_id: 'b' },
      { date: '2026-03-04', amount: 10, status: 'Delivered', customer_id: 'c' },
    ]);
    const { cohorts } = buildCohorts(o);
    expect(cohorts.map(c => [c.cohort, c.size])).toEqual([['2026-01', 2], ['2026-03', 1]]);
    expect(cohorts[0].values.map(v => v.active)).toEqual([2, 1, 0]); // cancelled order is not activity
  });
});

describe('RFM', () => {
  test('quintile scores handle ties and direction', () => {
    expect(quintileScores([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(quintileScores([5, 5, 5, 5])).toEqual([3, 3, 3, 3]);
    expect(quintileScores([1, 10], false)).toEqual([4, 2]);
    expect([1, 2, 3, 4, 5, 6, 20].map(frequencyScore)).toEqual([1, 2, 3, 4, 4, 5, 5]);
  });
  test('every customer gets a segment, and CLV follows the formula', () => {
    const r = buildRfm(orders, { margin: 0.3, lifespanYears: 3 });
    expect(r.customers.every(c => c.segment)).toBe(true);
    expect(r.segments.reduce((s, x) => s + x.customers, 0)).toBe(r.customers.length);
    const s = r.summary;
    expect(s.clv).toBeCloseTo(s.aov * s.ordersPerYear * 0.3 * 3, 6);
    expect(s.top20Share).toBeGreaterThan(0.2);
    expect(s.top20Share).toBeLessThan(1);
  });
});

describe('experiment statistics', () => {
  test('normal distribution', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7);
    expect(normCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(normInv(0.975)).toBeCloseTo(1.959964, 5);
    expect(normInv(0.8)).toBeCloseTo(0.841621, 5);
    expect(normInv(0.001)).toBeCloseTo(-3.090232, 5);
  });
  test('two proportion z test', () => {
    const r = proportionTest({ nA: 10000, xA: 1000, nB: 10000, xB: 1100 });
    expect(r.z).toBeCloseTo(2.3066, 3);
    expect(r.p).toBeCloseTo(0.0210, 3);
    expect(r.significant).toBe(true);
    expect(r.uplift).toBeCloseTo(0.1, 6);
    expect(r.ci[0]).toBeGreaterThan(0);
    expect(proportionTest({ nA: 1000, xA: 100, nB: 1000, xB: 105 }).significant).toBe(false);
  });
  test('Welch t test and the t distribution', () => {
    expect(tTwoSided(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(tTwoSided(0, 5)).toBeCloseTo(1, 6);
    const w = welchTest({ meanA: 100, sdA: 20, nA: 50, meanB: 110, sdB: 30, nB: 50 });
    expect(w.t).toBeCloseTo(1.9612, 3);
    expect(w.df).toBeCloseTo(85.5, 0);
    expect(w.p).toBeCloseTo(0.0531, 2);
  });
  test('sample size matches the standard formula', () => {
    expect(sampleSize({ baseline: 0.1, mde: 0.1 })).toBe(14751);
    expect(sampleSize({ baseline: 0.1, mde: 0.2 })).toBeLessThan(sampleSize({ baseline: 0.1, mde: 0.1 }));
  });
  test('sample ratio mismatch', () => {
    expect(srmCheck({ nA: 5000, nB: 5000 }).mismatch).toBe(false);
    expect(srmCheck({ nA: 5000, nB: 5400 }).mismatch).toBe(true);
  });
});

describe('anomalies', () => {
  test('flags an injected spike and ignores a steady series', () => {
    const steady = Array.from({ length: 20 }, (_, i) => ({ key: String(i), value: 100 + (i % 3) }));
    expect(detectAnomalies(steady).some(p => p.flag)).toBe(false);
    const spiked = steady.map((p, i) => (i === 15 ? { ...p, value: 160 } : p));
    const out = detectAnomalies(spiked);
    expect(out[15].flag).toBe('spike');
    expect(out.filter(p => p.flag)).toHaveLength(1);
  });
  test('weekly totals fill empty weeks', () => {
    const rows = normalizeOrders([{ date: '2026-01-05', amount: 5 }, { date: '2026-01-26', amount: 7 }]);
    expect(weeklyTotals(rows, o => o.amount, { completeOnly: false }).map(x => x.value)).toEqual([5, 0, 0, 7]);
    // The data stops on a Monday, so the last week is partial and left out.
    expect(weeklyTotals(rows, o => o.amount).map(x => x.value)).toEqual([5, 0, 0]);
    const sunday = normalizeOrders([{ date: '2026-01-05', amount: 5 }, { date: '2026-01-11', amount: 7 }]);
    expect(weeklyTotals(sunday, o => o.amount).map(x => x.value)).toEqual([12]);
  });
});

describe('audit edge cases', () => {
  test('status words that contain "deliver" are not counted as delivered', () => {
    expect(statusBucket('Out for delivery')).toBe('shipped');
    expect(statusBucket('Undelivered')).toBe('pending');
    expect(statusBucket('In transit')).toBe('shipped');
    expect(statusBucket('Delivery failed')).toBe('cancelled');
  });
  test('a brand new customer does not get an inflated CLV', () => {
    const r = buildRfm(orders);
    const newest = [...r.customers].sort((a, b) => a.recency_days - b.recency_days).find(c => c.orders === 1);
    // A first order last week means an average pace, not dozens of orders a year:
    // the customer's CLV differs from the average only through their own order value.
    const ownAov = newest.net_spend || r.summary.aov;
    expect(newest.clv / (ownAov * r.summary.ordersPerYear * 0.3 * 3)).toBeCloseTo(1, 1);
    expect(r.segments.some(s => s.name === 'New')).toBe(true);
  });
  test('statistics guard impossible inputs', () => {
    expect(sampleSize({ baseline: 0.6, mde: 1 })).toBeNull(); // 120% is not a rate
    expect(sampleSize({ baseline: 0, mde: 0.1 })).toBeNull();
    expect(srmCheck({ nA: 10, nB: 10, splitA: 0 }).mismatch).toBe(false);
    const flat = welchTest({ meanA: 5, sdA: 0, nA: 10, meanB: 5, sdB: 0, nB: 10 });
    expect(flat.p).toBe(1);
    expect(flat.significant).toBe(false);
    expect(Number.isNaN(proportionTest({ nA: 100, xA: 0, nB: 100, xB: 0 }).p)).toBe(false);
  });
  test('a jump from a flat baseline is flagged', () => {
    const s = [0, 0, 0, 0, 0, 0, 500].map((value, i) => ({ key: String(i), value }));
    expect(detectAnomalies(s)[6].flag).toBe('spike');
    expect(detectAnomalies(s.slice(0, 6)).some(p => p.flag)).toBe(false);
  });
  test('empty and tiny inputs do not crash', () => {
    expect(buildFunnel([])[0].count).toBe(0);
    expect(buildCohorts([]).cohorts).toEqual([]);
    expect(buildRfm([]).summary).toBeNull();
    expect(weeklyTotals([], o => o.amount)).toEqual([]);
    expect(lastCompleteMonth([])).toBeNull();
  });
});
