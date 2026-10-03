const DAY = 86400000;

// Years outside 1900 to 2199 are treated as unreadable: JavaScript reads
// text like "77777" as the year 77777, and a weekly chart from 2024 to that
// year would have millions of points.
export const parseDate = (s) => {
  if (s instanceof Date) return s;
  const d = new Date(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y < 1900 || y > 2199 ? null : d;
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
