// Applies validated rows (already in the app's field names) to existing data
// according to the chosen import mode. Pure: returns the new array.
import { SCHEMA_BY_ID } from './schemas';
import { DEFAULT_LINE_PARAMS } from './capacity';

const stamp = (prefix, i) => `${prefix}-${Date.now().toString(36).toUpperCase()}${i}`;

// Fill app defaults for fields the file left blank.
const shape = (schemaId, r, i) => {
  const clean = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== ''));
  switch (schemaId) {
    case 'plan_lines':
      return { ...DEFAULT_LINE_PARAMS, ...clean, id: String(r.id).trim(), name: String(r.name).trim() };
    case 'events':
      return { ...clean, lineId: clean.lineId && String(clean.lineId).toLowerCase() !== 'all' ? clean.lineId : 'all', id: stamp('EV', i) };
    case 'risks':
      return { owner: '', mitigation: '', status: 'Open', due: '', ...clean, lineId: clean.lineId || 'all', likelihood: Math.min(5, Math.max(1, Math.round(r.likelihood))), impact: Math.min(5, Math.max(1, Math.round(r.impact))), id: stamp('R', i) };
    case 'defects':
      return { impact_fte: 1, status: 'Open', ...clean, id: stamp('DEF', i) };
    case 'volume_history':
      return { aht: '', ...clean };
    default:
      return r;
  }
};

export const mergeImport = (schemaId, mode, existing, rows) => {
  const schema = SCHEMA_BY_ID[schemaId];
  const incoming = rows.map((r, i) => shape(schemaId, r, i));
  const current = Array.isArray(existing) ? existing : [];
  if (mode === 'replace') return incoming;
  if (mode === 'append') return [...current, ...incoming];
  if (mode === 'replaceLines') {
    const lines = new Set(incoming.map(r => String(r.line_id)));
    return [...current.filter(r => !lines.has(String(r.line_id))), ...incoming];
  }
  if (mode === 'upsert') {
    const map = new Map(current.map(r => [schema.keyOf(r), r]));
    incoming.forEach(r => {
      const k = schema.keyOf(r);
      map.set(k, map.has(k) ? { ...map.get(k), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== '')) } : r);
    });
    return [...map.values()];
  }
  throw new Error(`Unknown import mode: ${mode}`);
};

// Which workspace state each schema writes to.
export const TARGETS = {
  volume_history: ['volumeHistory', 'setVolumeHistory'],
  plan_lines: ['lines', 'setLines'],
  actuals: ['actuals', 'setActuals'],
  op_targets: ['opTargets', 'setOpTargets'],
  events: ['events', 'setEvents'],
  defects: ['defects', 'setDefects'],
  risks: ['risks', 'setRisks'],
  orders: ['orders', 'setOrders'],
};

// Applies an import to the workspace context and returns a summary message.
export const applyImport = (ws, schemaId, mode, rows) => {
  const [key, setter] = TARGETS[schemaId];
  const next = mergeImport(schemaId, mode, ws[key], rows);
  ws[setter](next);
  if (schemaId === 'orders' && ws.setDashboardConfig) {
    ws.setDashboardConfig({ dateCol: 'date', valCol: 'amount', statusCol: 'status', catCol: 'region' });
  }
  const warnings = [];
  if (['volume_history', 'actuals', 'defects'].includes(schemaId)) {
    const known = new Set((ws.lines || []).map(l => l.id));
    const unknown = [...new Set(rows.map(r => String(r.line_id)))].filter(id => !known.has(id));
    if (unknown.length) warnings.push(`These line ids are not in Plan lines yet: ${unknown.slice(0, 5).map(u => `\`${u}\``).join(', ')}${unknown.length > 5 ? '…' : ''}\nAdd them in Capacity & Headcount or upload a Plan lines file`);
  }
  return { count: next.length, imported: rows.length, warnings };
};
