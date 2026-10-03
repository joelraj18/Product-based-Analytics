import { kvGet, kvSet, kvDelete } from './idb';

// Where the orders table lives. The demo sample is regenerated from a seed on
// every load and never saved; the user's own orders (an upload, an edit, a
// cleaning step) are saved to IndexedDB, which has no 5 MB localStorage cap.
export const ORDERS_KEY = 'orders';

const V2_COLUMNS = 'id,date,amount,units,status,region,category,fulfillment_center,customer_id';

// True for the samples older versions saved in localStorage: the first 400
// order demo (ORD-10000 to ORD-10399) and the 2024 to 2026 sample (ids from
// ORD-100001 in sequence with the nine original columns).
export const isOldDemoOrders = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return false;
  if (rows.length === 400 && rows.every(r => /^ORD-10[0-3]\d\d$/.test(String(r && r.id)))) return true;
  return rows.length > 5000
    && Object.keys(rows[0] || {}).join(',') === V2_COLUMNS
    && rows.every((r, i) => r && r.id === `ORD-${100001 + i}`);
};

export const loadUserOrders = async () => {
  const rows = await kvGet(ORDERS_KEY);
  return Array.isArray(rows) ? rows : null;
};
export const saveUserOrders = (rows) => kvSet(ORDERS_KEY, rows);
export const clearUserOrders = () => kvDelete(ORDERS_KEY);
