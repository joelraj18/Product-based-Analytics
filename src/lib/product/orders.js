// Shared helpers for order level product analytics. Works on any orders
// table through a column mapping, so uploaded data can be analysed too.
import { toNumber } from '../stats';
import { parseDate, isoDate } from '../dates';

export const DEFAULT_MAP = { date: 'date', amount: 'amount', status: 'status', customer: 'customer_id' };

// Order status buckets. Pending and shipped orders are still in flight.
export const statusBucket = (s) => {
  const v = String(s ?? '').toLowerCase();
  if (/cancel|void|fail/.test(v)) return 'cancelled';
  if (/return|refund|\brto\b/.test(v)) return 'returned';
  // Check "out for delivery" and "undelivered" before "delivered".
  if (/out for|transit|ship|dispatch/.test(v)) return 'shipped';
  if (/undeliver|not deliver/.test(v)) return 'pending';
  if (/deliver|complete|done|fulfil/.test(v)) return 'delivered';
  return 'pending';
};

// Normalised rows: { date, day, month, amount, bucket, customer, raw }.
export const normalizeOrders = (rows, map = DEFAULT_MAP) => rows.map(r => {
  const d = parseDate(r[map.date]);
  if (!d || Number.isNaN(d.getTime())) return null;
  const amount = toNumber(r[map.amount]);
  const iso = isoDate(d);
  return {
    date: iso,
    day: Math.round(d.getTime() / 86400000),
    month: iso.slice(0, 7),
    amount: Number.isFinite(amount) ? amount : 0,
    bucket: statusBucket(r[map.status]),
    customer: r[map.customer] === undefined || r[map.customer] === null || r[map.customer] === '' ? null : String(r[map.customer]),
    raw: r,
  };
}).filter(Boolean).sort((a, b) => a.day - b.day);

// Net revenue excludes cancelled and returned orders.
export const isNet = (o) => o.bucket !== 'cancelled' && o.bucket !== 'returned';

// Months between two YYYY-MM keys.
export const monthDiff = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
export const addMonths = (key, n) => {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}`;
};

// The last month that is fully covered by the data (a partial month would
// make every month over month comparison look like a drop).
export const lastCompleteMonth = (orders) => {
  if (!orders.length) return null;
  const last = orders[orders.length - 1].date;
  const d = parseDate(last);
  const next = new Date(d.getTime() + 86400000);
  return next.getUTCMonth() !== d.getUTCMonth() ? last.slice(0, 7) : addMonths(last.slice(0, 7), -1);
};

export const hasCustomers = (orders) => orders.length > 0 && orders.filter(o => o.customer).length / orders.length > 0.8;
