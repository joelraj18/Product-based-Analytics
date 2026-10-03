import { makeRng } from '../lib/random';
import { addDays, isoDate, weekStart, dowIndex, parseDate } from '../lib/dates';
import { DEFAULT_LINE_PARAMS } from '../lib/capacity';

// Demo data is deterministic (seeded) and anchored to the current week so the
// planning horizon is always in the future.
const anchor = () => weekStart(new Date()); // Monday of this week
const historyEnd = () => addDays(anchor(), -1); // last complete Sunday

// ---------- Generic order analytics dataset ----------
const REGIONS = ['North', 'South', 'East', 'West'];
const STATUSES = ['Delivered', 'Delivered', 'Delivered', 'Shipped', 'Shipped', 'Pending', 'Cancelled', 'Returned'];
const CATEGORIES = ['Electronics', 'Home', 'Apparel', 'Beauty', 'Grocery'];

export const seedOrders = (count = 400) => {
  const rng = makeRng(42);
  const end = historyEnd();
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = rng.int(0, 364);
    const category = rng.pick(CATEGORIES);
    const units = rng.int(1, 5);
    const unitPrice = { Electronics: 2400, Home: 900, Apparel: 650, Beauty: 400, Grocery: 220 }[category];
    return {
      id: `ORD-${10000 + i}`,
      date: isoDate(addDays(end, -daysAgo)),
      amount: Math.round(units * unitPrice * (0.6 + rng.next() * 0.9)),
      units,
      status: rng.pick(STATUSES),
      region: rng.pick(REGIONS),
      category,
      fulfillment_center: `FC-${rng.int(1, 8)}`,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
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
