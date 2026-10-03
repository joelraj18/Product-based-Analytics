import { SCHEMAS, SCHEMA_BY_ID, validate, normalizeHeader, suggestSchema, templateRows } from '../schemas';
import { gridToTable, detectHeaderRow, parseTextTable, parseJsonTable } from '../fileImport';
import { mergeImport } from '../importMerge';
import { runSql, sameResult, rewriteMinMax, hoistScalarSubqueries } from '../sqlRunner';
import { builtinTables, sanitizeTableName } from '../sqlTables';
import { buildPlan } from '../planEngine';
import { PRACTICE, LEVELS } from '../../content/sqlPractice';
import { deriveOpTargets, monthlyTotals } from '../opTargets';
import * as seed from '../../data/seed';
import { maxOf } from '../stats';

describe('file parsing', () => {
  test('detects a header below title rows (Excel exports)', () => {
    const grid = [['Weekly plan export', null], [null, null], ['week_start', 'volume'], ['2026-01-05', 10]];
    expect(detectHeaderRow(grid)).toBe(2);
    expect(gridToTable(grid, 2)).toEqual({ columns: ['week_start', 'volume'], rows: [{ week_start: '2026-01-05', volume: 10 }] });
  });
  test('TSV, semicolon text and JSON', () => {
    expect(parseTextTable('a\tb\n1\t2', 'tsv')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseTextTable('a;b\n1;2', 'txt')).toEqual([['a', 'b'], ['1', '2']]);
    const grid = parseJsonTable('[{"a":1,"b":"x"},{"a":2,"c":true}]');
    expect(gridToTable(grid, 0).columns).toEqual(['a', 'b', 'c']);
    expect(() => parseJsonTable('{"a":1}')).toThrow(/list of objects/);
  });
  test('duplicate and blank headers get unique names', () => {
    expect(gridToTable([['x', 'x', ''], [1, 2, 3]], 0).columns).toEqual(['x', 'x_2', 'column_3']);
  });
});

describe('schemas', () => {
  test('header normalisation matches common variants', () => {
    expect(normalizeHeader('Line ID')).toBe('line_id');
    expect(normalizeHeader('lineId')).toBe('line_id');
    expect(normalizeHeader(' upliftPct ')).toBe('uplift_pct');
  });
  test('reports missing required columns by exact name', () => {
    const v = validate(SCHEMA_BY_ID.volume_history, ['Date', 'Line ID', 'calls'], [{ Date: '2026-01-05', 'Line ID': 'A', calls: 5 }]);
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(['volume']);
  });
  test('converts types, skips bad required values, keeps zero', () => {
    const rows = [
      { date: '2026-01-05', line_id: 'A', volume: '1,200' },
      { date: 'not a date', line_id: 'A', volume: 5 },
      { date: '2026-01-07', line_id: 'A', volume: 0 },
    ];
    const v = validate(SCHEMA_BY_ID.volume_history, ['date', 'line_id', 'volume'], rows);
    expect(v.ok).toBe(true);
    expect(v.rows).toEqual([{ date: '2026-01-05', line_id: 'A', volume: 1200 }, { date: '2026-01-07', line_id: 'A', volume: 0 }]);
    expect(v.skipped).toBe(1);
    expect(v.issues[0]).toMatchObject({ column: 'date', count: 1, rows: [3] });
  });
  test('every template validates against its own schema and suggests itself', () => {
    SCHEMAS.forEach(s => {
      const rows = templateRows(s);
      const v = validate(s, Object.keys(rows[0]), rows);
      expect(v.ok).toBe(true);
      expect(v.skipped).toBe(0);
    });
    expect(suggestSchema(['date', 'line_id', 'volume', 'aht'])).toBe('volume_history');
    expect(suggestSchema(['foo', 'bar'])).toBeNull();
  });
  test('plan_lines maps snake_case columns to app fields with defaults', () => {
    const v = validate(SCHEMA_BY_ID.plan_lines, ['id', 'name', 'current_hc', 'cost_model'], [{ id: 'X', name: 'New line', current_hc: 12, cost_model: 'perUnit' }]);
    const [line] = mergeImport('plan_lines', 'upsert', [], v.rows);
    expect(line).toMatchObject({ id: 'X', currentHC: 12, costModel: 'perUnit', aht: 360, shrinkage: 30 });
  });
});

describe('import merge modes', () => {
  const existing = [{ date: '2026-01-05', line_id: 'A', volume: 1 }, { date: '2026-01-05', line_id: 'B', volume: 2 }];
  test('replaceLines keeps other lines', () => {
    const out = mergeImport('volume_history', 'replaceLines', existing, [{ date: '2026-02-01', line_id: 'A', volume: 9 }]);
    expect(out.map(r => r.line_id).sort()).toEqual(['A', 'B']);
    expect(out.find(r => r.line_id === 'A').volume).toBe(9);
  });
  test('upsert updates matching keys and adds new ones', () => {
    const out = mergeImport('op_targets', 'upsert', [{ month: '2026-11', op1_cost: 1, op2_cost: 2 }], [{ month: '2026-11', op1_cost: 5, op2_cost: '' }, { month: '2026-12', op1_cost: 3, op2_cost: 4 }]);
    expect(out).toEqual([{ month: '2026-11', op1_cost: 5, op2_cost: 2 }, { month: '2026-12', op1_cost: 3, op2_cost: 4 }]);
  });
});

describe('SQL practice', () => {
  const lines = seed.seedLines();
  const history = seed.seedVolumeHistory(lines);
  const ws = {
    orders: seed.seedOrders(), inventory: seed.seedInventory(), tasks: seed.seedTasks(), sites: seed.seedSites(), lines,
    volumeHistory: history, actuals: seed.seedActuals(lines, history), defects: seed.seedDefects(lines), risks: seed.seedRisks(),
    events: seed.seedEvents(),
    plan: buildPlan({ lines, history, settings: seed.DEFAULT_SETTINGS, events: [], hiresPlan: {} }),
  };
  ws.opTargets = deriveOpTargets(monthlyTotals(ws.plan.plans));
  const ex = (id) => PRACTICE.find(p => p.id === id);
  const tables = builtinTables(ws);
  test('over 100 exercises, at least 25 per level, unique ids', () => {
    expect(PRACTICE.length).toBeGreaterThanOrEqual(100);
    LEVELS.forEach(l => expect(PRACTICE.filter(p => p.level === l.id).length).toBeGreaterThanOrEqual(25));
    expect(new Set(PRACTICE.map(p => p.id)).size).toBe(PRACTICE.length);
  });
  test('read only queries share one cached copy without changing app data', () => {
    const first = tables.orders[0];
    const sorted = runSql('SELECT * FROM orders ORDER BY amount DESC LIMIT 3', tables);
    expect(sorted[0].amount).toBe(maxOf(tables.orders.map(o => o.amount)));
    expect(tables.orders[0]).toBe(first);
    expect(runSql('SELECT id FROM orders LIMIT 1', tables)[0].id).toBe(first.id);
    // A write runs on a throwaway copy, so the next read still sees every row.
    runSql("DELETE FROM orders WHERE region = 'North'", tables);
    expect(runSql('SELECT COUNT(*) AS n FROM orders', tables)[0].n).toBe(tables.orders.length);
  });
  test.each(PRACTICE.map(p => [p.id, p]))('%s solution runs and returns rows', (_, p) => {
    const rows = runSql(p.solution, tables);
    expect(rows.length).toBeGreaterThan(0);
    // No column comes back undefined or NaN (alasql drops unsupported results silently).
    Object.values(rows[0]).forEach(v => expect(v === undefined || Number.isNaN(v)).toBe(false));
    expect(sameResult(rows, runSql(p.solution, tables), p.ordered)).toBe(true);
  });
  test('sub-query exercise really filters below the average', () => {
    const avg = ws.actuals.reduce((a, r) => a + r.sl_actual, 0) / ws.actuals.length;
    expect(runSql(ex('a19').solution, tables).length).toBeGreaterThan(0);
    expect(runSql('SELECT * FROM actuals WHERE sl_actual < (SELECT AVG(sl_actual) FROM actuals)', tables)).toHaveLength(ws.actuals.filter(r => r.sl_actual < avg).length);
  });
  test('answer checking ignores aliases but not values', () => {
    expect(sameResult(runSql('SELECT COUNT(*) AS n FROM orders', tables), runSql(ex('b18').solution, tables))).toBe(true);
    expect(sameResult(runSql('SELECT COUNT(*) FROM risks', tables), runSql(ex('b18').solution, tables))).toBe(false);
  });
  test('MIN and MAX work on text and dates, not only numbers', () => {
    expect(rewriteMinMax("SELECT MAX(d), min (x) FROM t WHERE n = 'MAX(y)'")).toBe("SELECT WX_MAX(d), WX_MIN(x) FROM t WHERE n = 'MAX(y)'");
    const last = runSql('SELECT MAX(week_start) AS w FROM actuals', tables)[0].w;
    expect(last).toBe([...ws.actuals.map(a => a.week_start)].sort().pop());
    expect(runSql("SELECT MIN(date) AS a FROM volume_history WHERE line_id = 'CS-VOICE'", tables)[0].a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(runSql('SELECT MAX(amount) AS m FROM orders', tables)[0].m).toBe(maxOf(ws.orders.map(o => o.amount)));
    expect(() => runSql('SELECT MAX( FROM orders', tables)).toThrow(/MAX|Parse/);
  });
  test('uncorrelated scalar subqueries are computed once, correlated ones are left alone', () => {
    const run = (q) => (q.includes('o.region') ? (() => { throw new Error('alias o'); })() : [{ v: 42 }]);
    expect(hoistScalarSubqueries('SELECT * FROM orders WHERE amount > (SELECT AVG(amount) FROM orders)', run)).toBe('SELECT * FROM orders WHERE amount > 42');
    expect(hoistScalarSubqueries("SELECT 100.0 * SUM(amount) / (SELECT SUM(amount) FROM orders WHERE x = ')') FROM t", run)).toBe('SELECT 100.0 * SUM(amount) / 42 FROM t');
    const kept = ['SELECT * FROM (SELECT 1) AS t', 'SELECT * FROM t WHERE c IN (SELECT c FROM u)', 'SELECT * FROM t WHERE EXISTS (SELECT 1 FROM u)', 'SELECT * FROM orders o WHERE amount = (SELECT MAX(amount) FROM orders o2 WHERE o2.region = o.region)'];
    kept.forEach(q => expect(hoistScalarSubqueries(q, run)).toBe(q));
    // Same answer as without hoisting, and fast on the full sample.
    const started = Date.now();
    const rows = runSql('SELECT COUNT(*) AS n FROM orders WHERE amount > (SELECT AVG(amount) FROM orders)', tables);
    expect(Date.now() - started).toBeLessThan(3000);
    const avg = ws.orders.reduce((a, o) => a + o.amount, 0) / ws.orders.length;
    expect(rows[0].n).toBe(ws.orders.filter(o => o.amount > avg).length);
  });
  test('uploaded table names are sanitised', () => {
    expect(sanitizeTableName('My Sales 2026.xlsx')).toBe('my_sales_2026');
    expect(sanitizeTableName('2026 data')).toBe('t_2026_data');
    expect(runSql('SELECT SUM(x) AS s FROM my_sales_2026', { my_sales_2026: [{ x: 1 }, { x: 2 }] })).toEqual([{ s: 3 }]);
  });
});
