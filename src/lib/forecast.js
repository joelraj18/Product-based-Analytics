import { mean, wape, mape, bias } from './stats';
import { addDays, isoDate, parseDate } from './dates';

const clampNonNeg = (arr) => arr.map(v => Math.max(0, v));

export const seasonalNaive = (y, h, { season = 52 } = {}) => {
  if (!y.length) return Array(h).fill(0);
  if (y.length < season) return Array(h).fill(y[y.length - 1]);
  return Array.from({ length: h }, (_, i) => y[y.length - season + (i % season)]);
};

export const movingAverage = (y, h, { window = 8 } = {}) => {
  const tail = y.slice(-window);
  return Array(h).fill(tail.length ? mean(tail) : 0);
};

const linearFit = (y) => {
  const n = y.length;
  const xm = (n - 1) / 2;
  const ym = mean(y);
  let num = 0;
  let den = 0;
  y.forEach((v, x) => { num += (x - xm) * (v - ym); den += (x - xm) ** 2; });
  const slope = den ? num / den : 0;
  return { slope, intercept: ym - slope * xm };
};

// Linear trend times a multiplicative seasonal index (classical decomposition).
export const trendSeasonal = (y, h, { season = 52 } = {}) => {
  if (y.length < 3) return Array(h).fill(y.length ? y[y.length - 1] : 0);
  const { slope, intercept } = linearFit(y);
  const trend = (x) => intercept + slope * x;
  const idx = Array(season).fill(1);
  if (y.length >= 2 * season) {
    const buckets = Array.from({ length: season }, () => []);
    y.forEach((v, x) => { const t = trend(x); if (t > 0) buckets[x % season].push(v / t); });
    buckets.forEach((b, i) => { idx[i] = b.length ? mean(b) : 1; });
    const norm = mean(idx);
    for (let i = 0; i < season; i++) idx[i] /= norm;
  }
  const n = y.length;
  return clampNonNeg(Array.from({ length: h }, (_, i) => trend(n + i) * idx[(n + i) % season]));
};

// Additive Holt-Winters. Falls back to Holt's linear method without two full seasons.
export const holtWinters = (y, h, { season = 52, alpha = 0.3, beta = 0.05, gamma = 0.2 } = {}) => {
  const n = y.length;
  if (n < 3) return Array(h).fill(n ? y[n - 1] : 0);
  if (n < 2 * season) {
    let level = y[0];
    let trend = y[1] - y[0];
    for (let t = 1; t < n; t++) {
      const prev = level;
      level = alpha * y[t] + (1 - alpha) * (level + trend);
      trend = beta * (level - prev) + (1 - beta) * trend;
    }
    return clampNonNeg(Array.from({ length: h }, (_, i) => level + (i + 1) * trend));
  }
  const s1 = mean(y.slice(0, season));
  const s2 = mean(y.slice(season, 2 * season));
  let level = s1;
  let trend = (s2 - s1) / season;
  const seasonal = y.slice(0, season).map(v => v - s1);
  for (let t = season; t < n; t++) {
    const s = seasonal[t % season];
    const prev = level;
    level = alpha * (y[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
    seasonal[t % season] = gamma * (y[t] - level) + (1 - gamma) * s;
  }
  return clampNonNeg(Array.from({ length: h }, (_, i) => level + (i + 1) * trend + seasonal[(n + i) % season]));
};

export const METHODS = {
  holtWinters: { label: 'Holt-Winters (trend + seasonality)', fn: holtWinters },
  trendSeasonal: { label: 'Linear trend × seasonal index', fn: trendSeasonal },
  seasonalNaive: { label: 'Seasonal naive (same week last year)', fn: seasonalNaive },
  movingAverage: { label: 'Moving average (8 wk)', fn: movingAverage },
};

export const backtest = (y, method, holdout = 8, opts = {}) => {
  if (y.length <= holdout + 3) return { wape: NaN, mape: NaN, bias: NaN, actual: [], forecast: [] };
  const train = y.slice(0, -holdout);
  const actual = y.slice(-holdout);
  const forecast = METHODS[method].fn(train, holdout, opts);
  return { wape: wape(actual, forecast), mape: mape(actual, forecast), bias: bias(actual, forecast), actual, forecast };
};

// Picks the method with the lowest backtest WAPE.
export const bestMethod = (y, holdout = 8, opts = {}) => {
  let best = 'holtWinters';
  let bestScore = Infinity;
  Object.keys(METHODS).forEach(m => {
    const score = backtest(y, m, holdout, opts).wape;
    if (Number.isFinite(score) && score < bestScore) { bestScore = score; best = m; }
  });
  return best;
};

// Multiplies forecast weeks that overlap an event window by (1 + uplift%).
export const applyEvents = (weekStarts, values, events = []) => values.map((v, i) => {
  const ws = parseDate(weekStarts[i]);
  const we = addDays(ws, 6);
  let factor = 1;
  events.forEach(ev => {
    const s = parseDate(ev.start);
    const e = parseDate(ev.end);
    if (s && e && s <= we && e >= ws) factor *= 1 + (Number(ev.upliftPct) || 0) / 100;
  });
  return v * factor;
});

export const futureWeeks = (lastWeekStart, h) =>
  Array.from({ length: h }, (_, i) => isoDate(addDays(lastWeekStart, 7 * (i + 1))));

// Runs a full weekly forecast for one plan line.
// Backtest window matches the planning horizon (capped) so method choice is
// judged on the same kind of look-ahead the plan needs.
export const backtestWindow = (n, horizon) => Math.max(4, Math.min(horizon, 26, n - 6));

export const forecastSeries = ({ weeks, values, horizon, method = 'auto', events = [], volumeAdjPct = 0, season = 52 }) => {
  const holdout = backtestWindow(values.length, horizon);
  const chosen = method === 'auto' ? bestMethod(values, holdout, { season }) : method;
  const base = METHODS[chosen].fn(values, horizon, { season });
  const dates = futureWeeks(weeks[weeks.length - 1], horizon);
  const adjusted = applyEvents(dates, base, events).map(v => Math.round(v * (1 + volumeAdjPct / 100)));
  return { method: chosen, weeks: dates, base: base.map(Math.round), values: adjusted, accuracy: { ...backtest(values, chosen, holdout, { season }), holdout } };
};
