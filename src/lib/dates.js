const DAY = 86400000;

export const parseDate = (s) => {
  if (s instanceof Date) return s;
  const d = new Date(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const isoDate = (d) => parseDate(d).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(parseDate(d).getTime() + n * DAY);

// Monday of the ISO week containing d (UTC).
export const weekStart = (d) => {
  const date = parseDate(d);
  const dow = (date.getUTCDay() + 6) % 7;
  return isoDate(addDays(date, -dow));
};

export const monthKey = (d) => isoDate(parseDate(d)).slice(0, 7);

export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dowIndex = (d) => (parseDate(d).getUTCDay() + 6) % 7;

export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};
