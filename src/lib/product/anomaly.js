// Anomaly detection with a trailing z score: each point is compared with the
// mean and standard deviation of the previous `window` points (never
// including itself, so a spike cannot hide inside its own baseline).
import { weekStart, isoDate } from '../dates';

export const detectAnomalies = (series, { window = 8, threshold = 2.5, minHistory = 4 } = {}) => series.map((p, i) => {
  const hist = series.slice(Math.max(0, i - window), i).map(x => x.value);
  if (hist.length < minHistory) return { ...p, mean: null, sd: null, z: null, flag: null };
  const mean = hist.reduce((s, v) => s + v, 0) / hist.length;
  const sd = Math.sqrt(hist.reduce((s, v) => s + (v - mean) ** 2, 0) / (hist.length - 1));
  // A flat history (for example all zeros) has no spread: any change from it is
  // unusual, so it gets an infinite score instead of being ignored.
  const z = sd > 0 ? (p.value - mean) / sd : p.value === mean ? 0 : Math.sign(p.value - mean) * Infinity;
  return { ...p, mean, sd, z, flag: Math.abs(z) >= threshold ? (z > 0 ? 'spike' : 'drop') : null, low: mean - threshold * sd, high: mean + threshold * sd };
});

// Weekly totals (Monday start) with empty weeks filled as zero, so a week
// with no orders shows as a drop instead of disappearing.
export const weeklyTotals = (orders, valueOf) => {
  if (!orders.length) return [];
  const sums = {};
  orders.forEach(o => { const k = isoDate(weekStart(o.date)); sums[k] = (sums[k] || 0) + valueOf(o); });
  const keys = Object.keys(sums).sort();
  const out = [];
  for (let d = new Date(`${keys[0]}T00:00:00Z`); isoDate(d) <= keys[keys.length - 1]; d = new Date(d.getTime() + 7 * 86400000)) {
    const k = isoDate(d);
    out.push({ key: k, value: sums[k] || 0 });
  }
  return out;
};

export const dailyTotals = (rows, dateKey, valueKey, filter = () => true) => {
  const sums = {};
  rows.filter(filter).forEach(r => { const k = String(r[dateKey]).slice(0, 10); sums[k] = (sums[k] || 0) + (Number(r[valueKey]) || 0); });
  return Object.keys(sums).sort().map(k => ({ key: k, value: sums[k] }));
};
