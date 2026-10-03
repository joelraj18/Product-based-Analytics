import { makeRng } from '../lib/random';
import { addDays, isoDate, weekStart, dowIndex, parseDate } from '../lib/dates';
import { DEFAULT_LINE_PARAMS } from '../lib/capacity';

// Demo data is deterministic (seeded) and anchored to the current week so the
// planning horizon is always in the future.
const anchor = () => weekStart(new Date()); // Monday of this week
const historyEnd = () => addDays(anchor(), -1); // last complete Sunday

// ---------- Generic order analytics dataset ----------
// A made up but realistic e-commerce sample of exactly 100,000 orders from
// December 2024 to December 2026. Daily volume follows growth, a weekly
// rhythm, the festive season and sale events, so dashboards show real
// patterns. It is regenerated from a fixed seed on every load instead of
// being saved, because 100,000 rows is far more than localStorage holds.
const REGIONS = ['North', 'South', 'East', 'West'];
const CATEGORIES = ['Electronics', 'Home', 'Apparel', 'Beauty', 'Grocery'];
const CHANNELS = ['App', 'Web', 'Marketplace'];
const PAYMENTS = ['UPI', 'Card', 'Wallet', 'COD'];
export const ORDERS_START = '2024-12-01';
export const ORDERS_END = '2026-12-31';
export const ORDERS_TARGET = 100000;
export const ORDER_COLUMNS = ['id', 'date', 'amount', 'units', 'status', 'region', 'category', 'fulfillment_center', 'customer_id', 'channel', 'payment_method', 'discount', 'delivery_days'];

const MONTH_SEASON = [0.86, 0.84, 0.94, 0.96, 1.0, 1.0, 1.06, 1.0, 1.04, 1.32, 1.42, 1.22];
const WEEKDAY = [0.92, 0.94, 0.97, 1.0, 1.07, 1.18, 1.12]; // Mon to Sun
// Sale windows by month and day: [month (1 to 12), first day, last day, lift].
const SALES = [[1, 26, 26, 1.6], [7, 12, 15, 2.1], [10, 3, 9, 2.3], [11, 27, 30, 1.9], [12, 24, 26, 1.5]];
const PRICE = { Electronics: 2600, Home: 950, Apparel: 700, Beauty: 420, Grocery: 240 };
const REGION_DAYS = { North: 3.1, South: 2.5, East: 3.7, West: 2.8 }; // typical delivery days
const FC_DAYS = [0, -0.3, 0, 0.2, 1.1, 0, -0.2, 0.4, 0.6]; // by FC number; FC-4 is the slow one
const pickWeighted = (rng, items, weights) => {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
};

export const seedOrders = () => {
  const rng = makeRng(42);
  const start = parseDate(ORDERS_START);
  const days = Math.round((parseDate(ORDERS_END) - start) / 86400000) + 1;
  // Pass 1: the shape of daily demand. Pass 2 scales it so the sample has
  // exactly ORDERS_TARGET orders (cumulative rounding keeps the total exact).
  const shape = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d);
    const m = date.getUTCMonth();
    const dom = date.getUTCDate();
    const sale = SALES.find(([sm, a, b]) => sm === m + 1 && dom >= a && dom <= b);
    const lambda = 1.27 ** (d / 365) * MONTH_SEASON[m] * WEEKDAY[dowIndex(date)] * (sale ? sale[3] : 1);
    shape.push({ iso: isoDate(date), sale: !!sale, w: lambda * (0.78 + 0.44 * rng.next()) });
  }
  const scale = ORDERS_TARGET / shape.reduce((s, x) => s + x.w, 0);
  const orders = [];
  let cum = 0;
  for (let d = 0; d < days; d++) {
    const { iso, sale, w } = shape[d];
    const n = Math.round((cum + w) * scale) - Math.round(cum * scale);
    cum += w;
    const years = d / 365;
    const left = days - d; // the last few days of the sample are still in flight
    for (let k = 0; k < n; k++) {
      // Electronics, the South region, the app and UPI grow, so mixes shift over time.
      const category = pickWeighted(rng, CATEGORIES, [0.2 + 0.05 * years, 0.2, 0.22, 0.17, 0.21 - 0.02 * years]);
      const region = pickWeighted(rng, REGIONS, [0.26, 0.24 + 0.04 * years, 0.27, 0.23 - 0.02 * years]);
      const channel = pickWeighted(rng, CHANNELS, [0.42 + 0.08 * years, 0.38 - 0.05 * years, 0.2 - 0.03 * years]);
      const payment = pickWeighted(rng, PAYMENTS, [0.38 + 0.06 * years, 0.24, 0.12, 0.26 - 0.06 * years]);
      const units = pickWeighted(rng, [1, 2, 3, 4, 5], [0.38, 0.27, 0.17, 0.11, 0.07]);
      const gross = units * PRICE[category] * 1.04 ** years * (0.7 + 0.6 * rng.next());
      // Sale days carry a 12 to 24% discount; on other days about 3 in 10
      // orders use a 5 to 10% coupon. `amount` is what the customer paid.
      const rate = sale ? 0.12 + 0.12 * rng.next() : rng.next() < 0.3 ? 0.05 + 0.05 * rng.next() : 0;
      const discount = Math.round(gross * rate);
      const cod = payment === 'COD';
      // Orders in the last few days are still in flight; older ones have a
      // small backlog of stuck pending or shipped orders, as real data does.
      // Cash on delivery orders are cancelled and returned more often.
      const status = left <= 3 ? pickWeighted(rng, ['Pending', 'Shipped', 'Delivered', 'Cancelled'], [0.35, 0.4, 0.2, 0.05])
        : left <= 8 ? pickWeighted(rng, ['Shipped', 'Delivered', 'Pending', 'Cancelled'], [0.35, 0.55, 0.04, 0.06])
          : pickWeighted(rng, ['Delivered', 'Cancelled', 'Returned', 'Shipped', 'Pending'], [0.79, 0.07 + (sale ? 0.03 : 0) + (cod ? 0.05 : 0), (category === 'Apparel' ? 0.13 : 0.07) + (cod ? 0.04 : 0), 0.02, 0.015]);
      const fc = rng.int(1, 8);
      const done = status === 'Delivered' || status === 'Returned';
      const deliveryDays = done ? Math.max(1, Math.round(REGION_DAYS[region] + FC_DAYS[fc] + (sale ? 0.9 : 0) - 0.15 * years + 2.2 * (rng.next() - 0.4))) : null;
      orders.push({
        date: iso,
        amount: Math.round(gross) - discount,
        units,
        status,
        region,
        category,
        fulfillment_center: `FC-${fc}`,
        channel,
        payment_method: payment,
        discount,
        delivery_days: deliveryDays,
      });
    }
  }
  return assignCustomers(orders);
};

// Gives each order an id and a customer, walking forward in time. A new
// customer is acquired some of the time; otherwise a returning customer is
// picked from a random handful, weighted by loyalty × recency decay, so some
// customers come back often and others churn. Sampling a handful keeps it
// linear for tens of thousands of customers.
const assignCustomers = (orders) => {
  const rng = makeRng(4242);
  const customers = []; // { id, loyalty, last }
  const pool = new Array(40);
  const weights = new Array(40);
  let lastIso = null;
  let day = 0;
  return orders.map((o, i) => {
    if (o.date !== lastIso) { lastIso = o.date; day = parseDate(o.date).getTime() / 86400000; }
    let c;
    if (customers.length < 20 || rng.next() < 0.3) {
      c = { id: `CUST-${10001 + customers.length}`, loyalty: 0.15 + 2.6 * rng.next() ** 2, last: day };
      customers.push(c);
    } else {
      for (let k = 0; k < 40; k++) {
        const x = customers[Math.floor(rng.next() * customers.length)];
        pool[k] = x;
        weights[k] = x.loyalty * Math.exp(-(day - x.last) / 90);
      }
      c = pickWeighted(rng, pool, weights);
      c.last = day;
    }
    const { channel, payment_method, discount, delivery_days, ...base } = o;
    return { id: `ORD-${100001 + i}`, ...base, customer_id: c.id, channel, payment_method, discount, delivery_days };
  });
};

// The demo is the same every time, so it is built once per page load.
let demoCache = null;
export const demoOrders = () => {
  if (!demoCache) demoCache = seedOrders();
  return demoCache;
};

export const seedInventory = () => {
  const rng = makeRng(7);
  return Array.from({ length: 20 }, (_, i) => ({
    sku: `SKU-${500 + i}`,
    name: `Product ${String.fromCharCode(65 + i)}`,
    category: CATEGORIES[i % CATEGORIES.length],
    stock: rng.int(0, 1000),
    reorder_point: 100,
  }));
};

// ---------- Workforce planning dataset ----------
export const seedSites = () => [
  { id: 'NH', name: 'North Hub', type: 'In-house', timezone: 'UTC+05:30' },
  { id: 'SH', name: 'South Hub', type: 'In-house', timezone: 'UTC+05:30' },
  { id: 'VE', name: 'Vendor East', type: 'Vendor', timezone: 'UTC+08:00' },
];

// A plan line is one program/queue at one site — the unit headcount is planned at.
export const seedLines = () => [
  {
    ...DEFAULT_LINE_PARAMS,
    id: 'CS-VOICE', name: 'Customer Support · Voice', siteId: 'NH', type: 'realtime',
    baseWeekly: 20000, aht: 360, npt: 10, shrinkage: 30, occupancy: 85, currentHC: 95,
    attritionMonthly: 3.5, costPerHour: 450, slTarget: 80, slSeconds: 30,
  },
  {
    ...DEFAULT_LINE_PARAMS,
    id: 'CS-CHAT', name: 'Customer Support · Chat', siteId: 'SH', type: 'realtime',
    baseWeekly: 9000, aht: 540, npt: 8, shrinkage: 28, occupancy: 82, currentHC: 60,
    attritionMonthly: 3, costPerHour: 420, slTarget: 80, slSeconds: 60,
  },
  {
    ...DEFAULT_LINE_PARAMS,
    id: 'PARTNER-EMAIL', name: 'Partner Support · Email', siteId: 'NH', type: 'deferred',
    baseWeekly: 6000, aht: 480, npt: 10, shrinkage: 30, occupancy: 90, currentHC: 36,
    attritionMonthly: 2.5, costPerHour: 480, slTarget: 90, slSeconds: 86400,
  },
  {
    ...DEFAULT_LINE_PARAMS,
    id: 'RETURNS-OPS', name: 'Returns & Claims Ops', siteId: 'VE', type: 'deferred',
    baseWeekly: 15000, aht: 300, npt: 12, shrinkage: 32, occupancy: 88, currentHC: 58,
    attritionMonthly: 5, costModel: 'perUnit', costPerUnit: 62, costPerHour: 380, slTarget: 95, slSeconds: 172800,
  },
];

const DOW_FACTOR = [1.18, 1.1, 1.04, 1.0, 0.98, 0.9, 0.8];
const bump = (doy, center, width, height) => {
  const d = Math.min(Math.abs(doy - center), 365 - Math.abs(doy - center));
  return height * Math.exp(-((d / width) ** 2));
};
// Annual demand shape: festive/peak season in Nov–Dec, mid-year sale in July,
// post-peak returns in January (returns line only).
const seasonality = (date, lineId) => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = Math.floor((date.getTime() - start) / 86400000);
  let f = 1 + bump(doy, 330, 18, 0.45) + bump(doy, 355, 8, 0.2) + bump(doy, 196, 6, 0.25);
  if (lineId === 'RETURNS-OPS') f += bump(doy, 12, 14, 0.4);
  return f;
};

export const seedVolumeHistory = (lines = seedLines(), weeks = 156) => {
  const rng = makeRng(2024);
  const end = historyEnd();
  const days = weeks * 7;
  const rows = [];
  lines.forEach(line => {
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(end, -i);
      const growth = 1 + 0.12 * ((days - i) / 364 - weeks / 52); // ~12%/yr growth, 1.0 at end
      const volume = (line.baseWeekly / 7) * DOW_FACTOR[dowIndex(date)] * seasonality(date, line.id) * growth * (1 + rng.normal(0, 0.05));
      const aht = line.aht * (1 + rng.normal(0, 0.03)) * (seasonality(date, line.id) > 1.2 ? 1.04 : 1);
      rows.push({ date: isoDate(date), line_id: line.id, volume: Math.max(0, Math.round(volume)), aht: Math.round(aht) });
    }
  });
  return rows;
};

// Share of daily volume by hour (index 0–23) for a weekday or weekend.
export const intradayProfile = (type, weekend) => {
  const raw = Array.from({ length: 24 }, (_, h) => {
    if (type === 'deferred') return h >= 8 && h < 20 ? 1 + 0.3 * Math.sin(((h - 8) / 12) * Math.PI) : 0.15;
    const morning = Math.exp(-(((h - 11) / 2.2) ** 2));
    const evening = Math.exp(-(((h - 19) / 2.5) ** 2)) * (weekend ? 0.9 : 0.75);
    return 0.05 + morning + evening;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / total);
};

export const DOW_SHARE = DOW_FACTOR.map(f => f / DOW_FACTOR.reduce((a, b) => a + b, 0));

export const seedEvents = () => {
  const a = parseDate(anchor());
  const y = a.getUTCFullYear();
  // Next occurrence of a festive sale (late Nov) and a January launch.
  const sale = new Date(Date.UTC(y, 10, 20)) < a ? y + 1 : y;
  const launch = new Date(Date.UTC(y, 0, 12)) < a ? y + 1 : y;
  return [
    { id: 'EV-1', name: 'Festive sale — incremental vs last year', start: `${sale}-11-20`, end: `${sale}-12-03`, upliftPct: 12, lineId: 'all' },
    { id: 'EV-2', name: 'New product launch support', start: `${launch}-01-12`, end: `${launch}-02-08`, upliftPct: 8, lineId: 'CS-CHAT' },
  ];
};

export const seedActuals = (lines = seedLines(), history = seedVolumeHistory(lines), weeks = 26) => {
  const rng = makeRng(99);
  const rows = [];
  const byWeek = {};
  history.forEach(h => {
    const k = `${h.line_id}|${weekStart(h.date)}`;
    const w = byWeek[k] || (byWeek[k] = { volume: 0, ahtSum: 0 });
    w.volume += h.volume;
    w.ahtSum += h.aht * h.volume;
  });
  const lastWeek = weekStart(historyEnd());
  lines.forEach(line => {
    for (let i = weeks - 1; i >= 0; i--) {
      const ws = isoDate(addDays(lastWeek, -7 * i));
      const w = byWeek[`${line.id}|${ws}`];
      if (!w) continue;
      const actualVolume = w.volume;
      const actualAht = Math.round(w.ahtSum / Math.max(1, w.volume));
      const forecastVolume = Math.round(actualVolume * (1 + rng.normal(0.01, 0.06)));
      const shrinkActual = line.shrinkage + rng.normal(1, 2.5);
      const prodHrs = 40 * (1 - line.shrinkage / 100) * (1 - line.npt / 100);
      const plannedHC = Math.round((forecastVolume * line.aht) / 3600 / (line.occupancy / 100) / prodHrs);
      const actualHC = Math.round(plannedHC * (1 + rng.normal(-0.01, 0.03)));
      const neededHC = (actualVolume * actualAht) / 3600 / (line.occupancy / 100) / (40 * (1 - shrinkActual / 100) * (1 - line.npt / 100));
      const ratio = actualHC / Math.max(1, neededHC);
      const slActual = Math.max(40, Math.min(99, line.slTarget + (ratio - 1) * 120 + rng.normal(0, 3)));
      const workload = (actualVolume * actualAht) / 3600;
      const occupancy = Math.min(98, (100 * workload) / Math.max(1, actualHC * 40 * (1 - shrinkActual / 100) * (1 - line.npt / 100)));
      const costPlanned = line.costModel === 'perUnit' ? forecastVolume * line.costPerUnit : plannedHC * 40 * line.costPerHour;
      const costActual = line.costModel === 'perUnit' ? actualVolume * line.costPerUnit : actualHC * 40 * line.costPerHour * (1 + Math.max(0, rng.normal(0.02, 0.02)));
      rows.push({
        week_start: ws, line_id: line.id,
        forecast_volume: forecastVolume, actual_volume: actualVolume,
        planned_aht: line.aht, actual_aht: actualAht,
        planned_hc: plannedHC, actual_hc: actualHC,
        planned_shrinkage: line.shrinkage, actual_shrinkage: Number(shrinkActual.toFixed(1)),
        sl_target: line.slTarget, sl_actual: Number(slActual.toFixed(1)),
        occupancy: Number(occupancy.toFixed(1)),
        cost_planned: Math.round(costPlanned), cost_actual: Math.round(costActual),
      });
    }
  });
  return rows;
};

export const DEFECT_CATEGORIES = [
  'Forecast miss', 'AHT drift', 'Unplanned shrinkage', 'Attrition above plan',
  'Hiring / training delay', 'Data / reporting gap', 'Schedule misalignment',
];

export const seedDefects = (lines = seedLines()) => {
  const rng = makeRng(314);
  const weights = [9, 7, 6, 4, 3, 2, 2];
  const pickWeighted = () => {
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return DEFECT_CATEGORIES[i]; }
    return DEFECT_CATEGORIES[0];
  };
  const end = historyEnd();
  return Array.from({ length: 36 }, (_, i) => {
    const category = pickWeighted();
    return {
      id: `DEF-${100 + i}`,
      date: isoDate(addDays(end, -rng.int(0, 180))),
      line_id: rng.pick(lines).id,
      category,
      impact_fte: Number((rng.next() * 6 + 0.5).toFixed(1)),
      status: rng.next() < 0.6 ? 'Root cause fixed' : rng.next() < 0.5 ? 'Mitigated' : 'Open',
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
};

export const seedRisks = () => [
  { id: 'R-1', title: 'Peak season volume above forecast', lineId: 'CS-VOICE', likelihood: 3, impact: 5, owner: 'Planning', mitigation: 'Preapprove a 15% OT cap and a 2 week vendor overflow contract', status: 'Open', due: '' },
  { id: 'R-2', title: 'Hiring class delayed by recruiting backlog', lineId: 'CS-CHAT', likelihood: 3, impact: 4, owner: 'Talent Acquisition', mitigation: 'Start sourcing 2 weeks earlier; keep a waitlist of 10 candidates', status: 'Open', due: '' },
  { id: 'R-3', title: 'AHT increase after policy change', lineId: 'PARTNER-EMAIL', likelihood: 2, impact: 3, owner: 'Program', mitigation: 'Macro templates + refresher training before launch', status: 'Monitoring', due: '' },
  { id: 'R-4', title: 'Vendor attrition above 5%/month', lineId: 'RETURNS-OPS', likelihood: 4, impact: 3, owner: 'Vendor Mgmt', mitigation: 'Weekly attrition review; contractual staffing SLA', status: 'Open', due: '' },
  { id: 'R-5', title: 'Shrinkage spike during holiday weeks', lineId: 'all', likelihood: 4, impact: 3, owner: 'Ops', mitigation: 'Leave blackout for peak weeks; plan shrinkage +4 pts', status: 'Mitigated', due: '' },
];

export const seedTasks = () => [
  { id: 'T-1', content: 'Publish weekly headcount plan for all sites', status: 'In Progress', tag: 'Planning', priority: 'High', owner: 'Planning', due: isoDate(addDays(anchor(), 4)) },
  { id: 'T-2', content: 'Reconcile OP2 variable cost with Finance', status: 'To Do', tag: 'Finance', priority: 'High', owner: 'Finance', due: isoDate(addDays(anchor(), 10)) },
  { id: 'T-3', content: 'Automate actuals ingestion (AHT, shrinkage) from reporting', status: 'To Do', tag: 'Automation', priority: 'Medium', owner: 'Analytics', due: isoDate(addDays(anchor(), 21)) },
  { id: 'T-4', content: 'RCA: forecast miss on chat queue, last 4 weeks', status: 'In Progress', tag: 'Analytics', priority: 'Medium', owner: 'Planning', due: isoDate(addDays(anchor(), 6)) },
  { id: 'T-5', content: 'Peak readiness review with Program and Ops', status: 'To Do', tag: 'Planning', priority: 'High', owner: 'Program', due: isoDate(addDays(anchor(), 14)) },
  { id: 'T-6', content: 'Standardize AHT/NPT input template across sites', status: 'Done', tag: 'Process', priority: 'Low', owner: 'Planning', due: isoDate(addDays(anchor(), -7)) },
];

export const DEFAULT_SETTINGS = {
  currency: 'INR',
  horizonWeeks: 26,
  forecastMethod: 'auto',
};
