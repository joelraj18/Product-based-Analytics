import { builtinTables } from '../../sqlTables';
import { buildPlan } from '../../planEngine';
import { deriveOpTargets, monthlyTotals } from '../../opTargets';
import * as seed from '../../../data/seed';
import { EXCEL_PRACTICE, DATASETS, GROUPS, fill } from '../../../content/excelPractice';
import { LESSONS, TRACKS } from '../../../content/excelLessons';
import { sheetFromRows, expectedFor, gradeFormula } from '../grade';
import { buildPivot, pivotRows, samePivot, equivalentFormula } from '../pivot';
import { parseRef, indexToCol } from '../parser';
import { isErr, isArr } from '../values';
import { columnsOf } from '../../csv';

const lines = seed.seedLines();
const history = seed.seedVolumeHistory(lines);
const ws = {
  orders: seed.seedOrders(), inventory: seed.seedInventory(), tasks: seed.seedTasks(), sites: seed.seedSites(), lines,
  volumeHistory: history, actuals: seed.seedActuals(lines, history), defects: seed.seedDefects(lines), risks: seed.seedRisks(),
  events: seed.seedEvents(),
  plan: buildPlan({ lines, history, settings: seed.DEFAULT_SETTINGS, events: [], hiresPlan: {} }),
};
ws.opTargets = deriveOpTargets(monthlyTotals(ws.plan.plans));
const tables = builtinTables(ws);

describe('Excel practice content', () => {
  test('dataset column letters match the real tables', () => {
    Object.entries(DATASETS).forEach(([name, d]) => {
      const expected = columnsOf(tables[name]).map((c, i) => `${indexToCol(i)} ${c}`).join(' · ');
      expect(d.letters).toBe(expected);
    });
  });
  test('ids are unique and every group has exercises', () => {
    expect(new Set(EXCEL_PRACTICE.map(e => e.id)).size).toBe(EXCEL_PRACTICE.length);
    expect(EXCEL_PRACTICE.length).toBeGreaterThanOrEqual(60);
    GROUPS.forEach(g => expect(EXCEL_PRACTICE.some(e => e.group === g.id)).toBe(true));
  });
  test.each(EXCEL_PRACTICE.filter(e => e.formula).map(e => [e.id, e]))('%s reference formula evaluates cleanly', (_, e) => {
    const rows = tables[e.dataset];
    const sheet = sheetFromRows(rows);
    const v = expectedFor(sheet, e, rows.length + 1);
    const cells = isArr(v) ? v.flat() : [v];
    cells.forEach(c => { expect(isErr(c) ? c.code : 'ok').toBe('ok'); expect(c === null || c === '').toBe(false); });
    // The target cell must be empty so it does not overwrite data.
    const { row, col } = parseRef(e.cell);
    expect(sheet.getRaw(row, col)).toBeUndefined();
    // Typing the reference formula into the cell passes the grader.
    sheet.setRaw(row, col, fill(e.formula, rows.length + 1));
    expect(gradeFormula(sheet, e, rows.length + 1)).toEqual({ ok: true });
  });
  test('a wrong answer fails with a reason', () => {
    const e = EXCEL_PRACTICE.find(x => x.id === 'e11');
    const sheet = sheetFromRows(tables.orders);
    sheet.setRaw(1, 13, '=SUM(C:C)');
    const r = gradeFormula(sheet, e, tables.orders.length + 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not the expected/);
  });
  test.each(EXCEL_PRACTICE.filter(e => e.pivot).map(e => [e.id, e]))('%s pivot builds', (_, e) => {
    const rows = pivotRows(buildPivot(tables[e.dataset], e.pivot), e.pivot);
    expect(rows.length).toBeGreaterThan(1);
    expect(samePivot(rows, rows)).toBe(true);
  });
  test('lessons have code and answers in every track', () => {
    TRACKS.forEach(t => expect(LESSONS.filter(l => l.track === t.id).length).toBeGreaterThanOrEqual(8));
    LESSONS.forEach(l => { expect(l.code.length).toBeGreaterThan(10); expect(l.answer.length).toBeGreaterThan(5); });
  });
});

describe('pivot', () => {
  const data = [
    { region: 'North', status: 'A', amount: 10 },
    { region: 'North', status: 'B', amount: 30 },
    { region: 'South', status: 'A', amount: 60 },
  ];
  test('sums, totals and percent of grand total', () => {
    const p = buildPivot(data, { rows: 'region', cols: 'status', value: 'amount', agg: 'Sum' });
    expect(p.cell('North', 'B')).toBe(30);
    expect(p.cell('South', 'B')).toBeNull();
    expect(p.rowTotal('North')).toBe(40);
    expect(p.colTotal('A')).toBe(70);
    expect(p.grand).toBe(100);
    const pct = buildPivot(data, { rows: 'region', value: 'amount', agg: 'Sum', percent: true });
    expect(pct.rowTotal('South')).toBeCloseTo(0.6);
  });
  test('count, average, distinct and filter', () => {
    expect(buildPivot(data, { rows: 'region', value: 'amount', agg: 'Count' }).rowTotal('North')).toBe(2);
    expect(buildPivot(data, { rows: 'region', value: 'amount', agg: 'Average' }).rowTotal('North')).toBe(20);
    expect(buildPivot(data, { rows: 'region', value: 'status', agg: 'Distinct count' }).grand).toBe(2);
    expect(buildPivot(data, { rows: 'region', value: 'amount', agg: 'Sum', filterField: 'status', filterValue: 'A' }).grand).toBe(70);
  });
  test('equivalent formula matches the pivot cell on a sheet', () => {
    const cfg = { rows: 'region', value: 'amount', agg: 'Sum', filterField: 'status', filterValue: 'Delivered' };
    const cols = columnsOf(tables.orders);
    const colOf = (f) => indexToCol(cols.indexOf(f));
    const p = buildPivot(tables.orders, cfg);
    const f = equivalentFormula(cfg, colOf, 'North', undefined, tables.orders.length + 1);
    expect(f).toMatch(/^=SUMIFS\(/);
    expect(sheetFromRows(tables.orders).evaluateAt(f.slice(1), 1, 20)).toBeCloseTo(p.rowTotal('North'));
  });
});
