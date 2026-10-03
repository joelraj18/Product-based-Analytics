// Single source of truth for the files each feature accepts: exact column
// names, types, meanings and examples. The Upload page, every import button
// and the in-app Column reference all read from here.
import { toNumber } from './stats';
import { parseDate, isoDate } from './dates';
import { toCSV } from './csv';

const col = (name, type, description, example, key) => ({ name, type, description, example, key: key || name });

// Normalises a header so "Line ID", "line-id" and "lineId" all match "line_id".
export const normalizeHeader = (h) => String(h ?? '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const LINE_PARAM_COLUMNS = [
  col('site_id', 'text', 'Site the line belongs to, matching a site id like NH', 'NH', 'siteId'),
  col('type', 'text', '`realtime` for phone or chat, staffed with Erlang C, or `deferred` for email and back office work', 'realtime'),
  col('aht', 'number', 'Average handle time per contact, in seconds', 360),
  col('npt', 'number', 'Non productive time while on shift in %, such as meetings, coaching and system downtime', 10),
  col('shrinkage', 'number', 'Paid time lost to leave, absence, breaks and training, %', 30),
  col('occupancy', 'number', 'Target share of productive time spent handling work, %', 85),
  col('hours_per_week', 'number', 'Paid hours per full time employee per week', 40, 'hoursPerWeek'),
  col('attrition_monthly', 'number', 'Share of staff who leave each month, %', 3, 'attritionMonthly'),
  col('training_weeks', 'number', 'Weeks a new hire spends in training (0% productive)', 3, 'trainingWeeks'),
  col('ramp_weeks', 'number', 'Weeks of nesting until a new hire is fully productive', 4, 'rampWeeks'),
  col('ramp_start', 'number', 'Productivity in the first nesting week, %', 50, 'rampStart'),
  col('temp_contract_weeks', 'number', 'Weeks a temp stays after reaching full productivity', 4, 'tempContractWeeks'),
  col('current_hc', 'number', 'Headcount on the line today', 95, 'currentHC'),
  col('max_ot_pct', 'number', 'Maximum overtime, % of tenured hours', 10, 'maxOtPct'),
  col('buffer_pct', 'number', 'Extra staffing buffer on top of the requirement, %', 2, 'bufferPct'),
  col('cost_model', 'text', '`hourly` for in house staff, or `perUnit` for a vendor billed per contact', 'hourly', 'costModel'),
  col('cost_per_hour', 'number', 'Fully loaded cost per paid hour', 450, 'costPerHour'),
  col('cost_per_unit', 'number', 'Vendor price per contact handled', 60, 'costPerUnit'),
  col('ot_multiplier', 'number', 'Overtime pay multiplier', 1.5, 'otMultiplier'),
  col('hire_cost', 'number', 'Recruiting + onboarding cost per hire', 25000, 'hireCost'),
  col('sl_target', 'number', 'Service level target, % of contacts answered within the threshold', 80, 'slTarget'),
  col('sl_seconds', 'number', 'Service level threshold, seconds', 30, 'slSeconds'),
];

export const SCHEMAS = [
  {
    id: 'volume_history',
    label: 'Volume history (daily)',
    usedBy: ['Demand Forecast', 'Capacity & Headcount', 'Intraday Staffing', 'Budget & OP', 'Scenarios & Risks', 'Planning Hub'],
    description: 'How many contacts (calls, chats, emails, tickets…) arrived each day for each plan line\nThis is the starting point of every forecast\nGive at least 8 complete weeks, and 2 or more years lets the forecast learn yearly seasonality',
    required: [
      col('date', 'date', 'Calendar day', '2026-01-05'),
      col('line_id', 'text', 'Plan line the volume belongs to (must match an id in Plan lines)', 'CS-VOICE'),
      col('volume', 'number', 'Contacts received that day', 2850),
    ],
    optional: [col('aht', 'number', 'Average handle time that day, seconds', 362)],
    modes: [
      { id: 'replaceLines', label: 'Replace history for the lines in this file (keep other lines)' },
      { id: 'replace', label: 'Replace all history' },
    ],
    keyOf: r => `${r.line_id}|${r.date}`,
  },
  {
    id: 'plan_lines',
    label: 'Plan lines & assumptions',
    usedBy: ['Capacity & Headcount', 'every planning screen'],
    description: 'One row per program or queue you plan headcount for, with its productivity, supply and cost assumptions\nMissing optional columns fall back to sensible defaults you can edit later',
    required: [
      col('id', 'text', 'Short unique code for the line, used as `line_id` in other files', 'CS-VOICE'),
      col('name', 'text', 'Readable name', 'Customer Support · Voice'),
    ],
    optional: LINE_PARAM_COLUMNS,
    modes: [
      { id: 'upsert', label: 'Add new lines and update existing ones (match on id)' },
      { id: 'replace', label: 'Replace all plan lines' },
    ],
    keyOf: r => String(r.id),
  },
  {
    id: 'actuals',
    label: 'Weekly actuals',
    usedBy: ['Planning KPIs', 'Planning Hub'],
    description: 'What actually happened each week per line, compared with the plan\nDrives the forecast accuracy, service level, adherence and cost KPIs',
    required: [
      col('week_start', 'date', 'Monday of the week', '2026-09-21'),
      col('line_id', 'text', 'Plan line', 'CS-VOICE'),
      col('actual_volume', 'number', 'Contacts actually received that week', 20100),
    ],
    optional: [
      col('forecast_volume', 'number', 'Contacts that were forecast for that week', 19800),
      col('planned_aht', 'number', 'AHT assumed in the plan, seconds', 360),
      col('actual_aht', 'number', 'AHT actually achieved, seconds', 371),
      col('planned_hc', 'number', 'Headcount the plan called for', 92),
      col('actual_hc', 'number', 'Headcount actually available', 90),
      col('planned_shrinkage', 'number', 'Shrinkage assumed in the plan, %', 30),
      col('actual_shrinkage', 'number', 'Shrinkage actually seen, %', 31.5),
      col('sl_target', 'number', 'Service level target, %', 80),
      col('sl_actual', 'number', 'Service level achieved, %', 78.4),
      col('occupancy', 'number', 'Occupancy achieved, %', 86.2),
      col('cost_planned', 'number', 'Planned cost for the week', 1656000),
      col('cost_actual', 'number', 'Actual cost for the week', 1689000),
    ],
    modes: [
      { id: 'upsert', label: 'Add or update weeks, matching on week start and line id' },
      { id: 'replace', label: 'Replace all actuals' },
    ],
    keyOf: r => `${r.line_id}|${r.week_start}`,
  },
  {
    id: 'op_targets',
    label: 'OP budget targets (monthly)',
    usedBy: ['Budget & OP', 'Planning Hub'],
    description: 'The operating plan targets Finance holds you to\nOP1 is the annual plan and OP2 is the mid year refresh',
    required: [
      col('month', 'month', 'Month written as year and month, like 2026-11', '2026-11'),
      col('op1_cost', 'number', 'OP1 cost target for the month', 36500000),
      col('op2_cost', 'number', 'OP2 cost target for the month', 38400000),
    ],
    optional: [
      col('op1_volume', 'number', 'OP1 volume assumption', 330000),
      col('op2_volume', 'number', 'OP2 volume assumption', 345000),
    ],
    modes: [
      { id: 'upsert', label: 'Add or update months' },
      { id: 'replace', label: 'Replace all targets' },
    ],
    keyOf: r => r.month,
  },
  {
    id: 'events',
    label: 'Planned events (forecast uplifts)',
    usedBy: ['Demand Forecast'],
    description: 'Known future events like sales, launches or campaigns that will raise or lower volume beyond normal seasonality',
    required: [
      col('name', 'text', 'Event name', 'Festive sale'),
      col('start', 'date', 'First day of the event', '2026-11-20'),
      col('end', 'date', 'Last day of the event', '2026-12-03'),
      col('uplift_pct', 'number', 'Extra volume during the event, % (negative to reduce)', 12, 'upliftPct'),
    ],
    optional: [col('line_id', 'text', 'Line it applies to; leave blank or "all" for every line', 'all', 'lineId')],
    modes: [
      { id: 'append', label: 'Add to existing events' },
      { id: 'replace', label: 'Replace all events' },
    ],
  },
  {
    id: 'defects',
    label: 'Planning defects (root causes)',
    usedBy: ['Planning KPIs'],
    description: 'A log of planning misses and their root cause, used for the Pareto chart',
    required: [
      col('date', 'date', 'When the defect happened', '2026-09-14'),
      col('line_id', 'text', 'Plan line', 'CS-CHAT'),
      col('category', 'text', 'Root cause, such as Forecast miss, AHT drift or Unplanned shrinkage', 'Forecast miss'),
    ],
    optional: [
      col('impact_fte', 'number', 'Size of the miss in FTE', 2.5),
      col('status', 'text', 'Open, Mitigated or Root cause fixed', 'Open'),
    ],
    modes: [
      { id: 'append', label: 'Add to the defect log' },
      { id: 'replace', label: 'Replace the defect log' },
    ],
  },
  {
    id: 'risks',
    label: 'Risk register',
    usedBy: ['Scenarios & Risks', 'Planning Hub'],
    description: 'Risks to the plan, with likelihood and impact scored from 1 to 5',
    required: [
      col('title', 'text', 'What could go wrong', 'Hiring class delayed'),
      col('likelihood', 'number', 'How likely, 1 (rare) to 5 (almost certain)', 3),
      col('impact', 'number', 'How bad, 1 (minor) to 5 (severe)', 4),
    ],
    optional: [
      col('line_id', 'text', 'Line affected, or "all"', 'all', 'lineId'),
      col('owner', 'text', 'Who owns the mitigation', 'Talent Acquisition'),
      col('mitigation', 'text', 'What you will do about it', 'Start sourcing 2 weeks earlier'),
      col('status', 'text', 'Open, Monitoring, Mitigated or Closed', 'Open'),
    ],
    modes: [
      { id: 'append', label: 'Add to the register' },
      { id: 'replace', label: 'Replace the register' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders / sales records',
    usedBy: ['Sales Dashboard', 'Product Analytics', 'Data Grid', 'Data Cleaning'],
    description: 'Any table of orders or transactions\nExtra columns are kept, and you can use them in the dashboard (map them with the gear icon) and in SQL',
    required: [
      col('date', 'date', 'Order date', '2026-03-14'),
      col('amount', 'number', 'Order value', 1499),
    ],
    optional: [
      col('id', 'text', 'Order id', 'ORD-10001'),
      col('status', 'text', 'Like Pending, Shipped, Delivered or Cancelled', 'Delivered'),
      col('region', 'text', 'Region or market', 'North'),
      col('category', 'text', 'Product category', 'Electronics'),
      col('units', 'number', 'Units in the order', 2),
      col('customer_id', 'text', 'Who placed the order, needed for cohorts, retention, RFM and CLV', 'CUST-1001'),
      col('channel', 'text', 'Where the order was placed, such as App, Web or Marketplace', 'App'),
      col('payment_method', 'text', 'How the order was paid, such as UPI, Card, Wallet or COD', 'UPI'),
      col('discount', 'number', 'Discount given on the order, already taken off the amount', 120),
      col('delivery_days', 'number', 'Days from order to delivery, blank until delivered', 3),
    ],
    keepExtra: true,
    modes: [
      { id: 'replace', label: 'Replace the orders table' },
      { id: 'append', label: 'Append to the orders table' },
    ],
  },
];

export const SCHEMA_BY_ID = Object.fromEntries(SCHEMAS.map(s => [s.id, s]));

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const convert = (type, v) => {
  if (isBlank(v)) return { ok: true, value: '' };
  if (type === 'number') {
    const n = toNumber(v);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (type === 'date') {
    const d = parseDate(typeof v === 'number' ? String(v) : String(v).trim());
    return d && /\d/.test(String(v)) ? { ok: true, value: isoDate(d) } : { ok: false };
  }
  if (type === 'month') {
    const s = String(v).trim();
    if (/^\d{4}-\d{2}$/.test(s)) return { ok: true, value: s };
    const d = parseDate(s);
    return d ? { ok: true, value: isoDate(d).slice(0, 7) } : { ok: false };
  }
  return { ok: true, value: typeof v === 'string' ? v.trim() : String(v) };
};

// Matches file columns to a schema and converts rows into the app's shape.
// Returns { ok, missing, matched, renamed, extra, issues, rows, skipped }.
export const validate = (schema, columns, rows) => {
  const byNorm = {};
  columns.forEach(c => { const n = normalizeHeader(c); if (!(n in byNorm)) byNorm[n] = c; });
  const all = [...schema.required, ...schema.optional];
  const matched = {};
  const renamed = [];
  all.forEach(c => {
    const fileCol = byNorm[c.name];
    if (fileCol !== undefined) {
      matched[c.name] = fileCol;
      if (fileCol !== c.name) renamed.push({ from: fileCol, to: c.name });
    }
  });
  const missing = schema.required.filter(c => !(c.name in matched)).map(c => c.name);
  const used = new Set(Object.values(matched));
  const extra = columns.filter(c => !used.has(c));
  if (missing.length) return { ok: false, missing, matched, renamed, extra, issues: [], rows: [], skipped: 0 };

  const issues = {};
  const note = (name, rowNo, kind) => {
    const it = issues[name] || (issues[name] = { column: name, kind, count: 0, rows: [] });
    it.count += 1;
    if (it.rows.length < 5) it.rows.push(rowNo);
  };
  const out = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    const rowNo = i + 2; // +1 for header, +1 for 1-based
    const obj = {};
    let bad = false;
    all.forEach(c => {
      if (!(c.name in matched)) return;
      const res = convert(c.type, r[matched[c.name]]);
      const isReq = schema.required.includes(c);
      if (!res.ok) { note(c.name, rowNo, `not a valid ${c.type}`); if (isReq) bad = true; obj[c.key] = ''; return; }
      if (isReq && res.value === '') { note(c.name, rowNo, 'empty'); bad = true; }
      obj[c.key] = res.value;
    });
    if (schema.keepExtra) extra.forEach(e => { obj[e] = r[e]; });
    if (bad) skipped += 1; else out.push(obj);
  });
  return { ok: out.length > 0, missing, matched, renamed, extra, issues: Object.values(issues), rows: out, skipped };
};

// Ranks schemas by how many of their required columns the file has.
export const suggestSchema = (columns) => {
  const norm = new Set(columns.map(normalizeHeader));
  let best = null;
  SCHEMAS.forEach(s => {
    const hit = s.required.filter(c => norm.has(c.name)).length;
    const score = hit / s.required.length + 0.01 * [...s.optional].filter(c => norm.has(c.name)).length;
    if (hit === s.required.length && (!best || score > best.score)) best = { id: s.id, score };
  });
  return best ? best.id : null;
};

export const templateRows = (schema) => [Object.fromEntries([...schema.required, ...schema.optional].map(c => [c.name, c.example]))];

export const templateCSV = (schema) => toCSV(templateRows(schema), [...schema.required, ...schema.optional].map(c => c.name));
