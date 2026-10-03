// Tables exposed to SQL Lab: built-in workspace data plus the user's uploads.
import { planToRows } from './planEngine';
import { inferType } from './fileImport';
import { columnsOf } from './csv';

export const BUILTIN_TABLES = [
  'orders', 'inventory', 'tasks', 'sites', 'plan_lines', 'volume_history',
  'capacity_plan', 'actuals', 'defects', 'risks', 'op_targets', 'events',
];

export const builtinTables = (ws) => ({
  orders: ws.orders,
  inventory: ws.inventory,
  tasks: ws.tasks,
  sites: ws.sites,
  plan_lines: ws.lines.map(({ baseWeekly, ...l }) => l),
  volume_history: ws.volumeHistory,
  capacity_plan: planToRows(ws.plan.plans),
  actuals: ws.actuals,
  defects: ws.defects,
  risks: ws.risks,
  op_targets: ws.opTargets,
  events: ws.events,
});

// Known join keys between built-in tables, shown on the Schema tab.
export const RELATIONSHIPS = [
  ['plan_lines.siteId', 'sites.id', 'each plan line runs at one site'],
  ['volume_history.line_id', 'plan_lines.id', 'daily volume per line'],
  ['capacity_plan.line_id', 'plan_lines.id', 'weekly plan per line'],
  ['actuals.line_id', 'plan_lines.id', 'weekly actuals per line'],
  ['defects.line_id', 'plan_lines.id', 'planning misses per line'],
  ['risks.lineId', 'plan_lines.id', "risk scope ('all' = every line)"],
  ['events.lineId', 'plan_lines.id', "event scope ('all' = every line)"],
  ['orders.category', 'inventory.category', 'orders and stock by product category'],
  ['capacity_plan.week_start', 'actuals.week_start', 'plan weeks vs actual weeks (different periods)'],
];

// Turns an upload name into a safe SQL identifier.
export const sanitizeTableName = (name) => {
  let n = String(name || '').trim().toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!n) n = 'my_table';
  if (/^\d/.test(n)) n = `t_${n}`;
  return n.slice(0, 48);
};

export const describeTable = (rows) => {
  const cols = columnsOf(rows.slice(0, 200));
  return cols.map(c => ({ name: c, type: inferType(rows, c) }));
};
