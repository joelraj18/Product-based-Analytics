// Values like "₹1,299", "$ 42", "(150)" or "12%" become numbers. Text with
// letters (IDs such as "ORD-10000") or blanks become NaN. Zero is a real value.
export const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return NaN;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(/^(rs\.?|inr|usd|eur|gbp)\s*/i, '');
  let negative = false;
  if (/^\(.*\)$/.test(str)) { negative = true; str = str.slice(1, -1); }
  str = str.replace(/[\s,₹$€£¥%]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(str)) return NaN;
  const n = Number(str);
  return negative ? -n : n;
};

export const isMissing = (v) =>
  v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ||
  (typeof v === 'string' && ['', 'null', 'nan', 'undefined', 'n/a'].includes(v.trim().toLowerCase()));

export const numericValues = (rows, col) => rows.map(r => toNumber(r[col])).filter(Number.isFinite);

// Loops instead of Math.min(...arr): spreading 100,000 values into one call
// can overflow the call stack.
export const minOf = (arr) => { let m = Infinity; for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i]; return m; };
export const maxOf = (arr) => { let m = -Infinity; for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]; return m; };

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : NaN);

export const median = (arr) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const mode = (arr) => {
  const counts = new Map();
  let best;
  let bestCount = 0;
  arr.forEach(v => {
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > bestCount) { bestCount = c; best = v; }
  });
  return best;
};

export const stdDev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map(v => (v - m) ** 2)) / arr.length);
};

export const percentile = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

// Pearson's second skewness coefficient.
export const skewness = (arr) => {
  const sd = stdDev(arr);
  return sd === 0 ? 0 : (3 * (mean(arr) - median(arr))) / sd;
};

export const describeSkew = (skew) => {
  const a = Math.abs(skew);
  if (a > 1) return 'Highly skewed, so impute with the median';
  if (a > 0.5) return 'Moderately skewed, so impute with the median';
  return 'Roughly symmetric, so the mean is fine';
};

// IQR outlier fences.
export const iqrFences = (arr, k = 1.5) => {
  const q1 = percentile(arr, 0.25);
  const q3 = percentile(arr, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, lower: q1 - k * iqr, upper: q3 + k * iqr };
};

// Forecast accuracy. All take aligned arrays of actuals and forecasts.
export const mape = (actual, forecast) => {
  const pairs = actual.map((a, i) => [a, forecast[i]]).filter(([a, f]) => a !== 0 && Number.isFinite(a) && Number.isFinite(f));
  return pairs.length ? (100 * sum(pairs.map(([a, f]) => Math.abs(a - f) / Math.abs(a)))) / pairs.length : NaN;
};

export const wape = (actual, forecast) => {
  const denom = sum(actual.map(Math.abs));
  return denom ? (100 * sum(actual.map((a, i) => Math.abs(a - forecast[i])))) / denom : NaN;
};

// Positive bias = over-forecasting.
export const bias = (actual, forecast) => {
  const denom = sum(actual);
  return denom ? (100 * (sum(forecast) - denom)) / denom : NaN;
};

export const pctChange = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

export const groupBy = (rows, keyFn) => rows.reduce((acc, r) => {
  const k = keyFn(r);
  (acc[k] = acc[k] || []).push(r);
  return acc;
}, {});
