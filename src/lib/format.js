export const CURRENCIES = {
  INR: { locale: 'en-IN', symbol: '₹' },
  USD: { locale: 'en-US', symbol: '$' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  JPY: { locale: 'ja-JP', symbol: '¥' },
  SGD: { locale: 'en-SG', symbol: 'S$' },
  AED: { locale: 'en-AE', symbol: 'AED ' },
};

const safe = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const formatCurrency = (val, currency = 'INR', opts = {}) => {
  const cfg = CURRENCIES[currency] || CURRENCIES.INR;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency', currency, maximumFractionDigits: 0, ...opts,
  }).format(safe(val));
};

// Compact form for axes and tiles: ₹12.3L style is locale-specific, so use K/M/B uniformly.
export const formatCompact = (val, currency) => {
  const n = safe(val);
  const sym = currency ? (CURRENCIES[currency] || CURRENCIES.INR).symbol : '';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${sym}${abs.toFixed(abs < 10 && abs % 1 ? 1 : 0)}`;
};

export const formatNumber = (val, digits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(safe(val));

export const formatPct = (val, digits = 1) => `${safe(val).toFixed(digits)}%`;

export const signed = (val, digits = 1) => `${safe(val) > 0 ? '+' : ''}${safe(val).toFixed(digits)}`;
