// Grading helpers for Excel Lab practice.
import { Sheet } from './engine';
import { parseRef } from './parser';
import { isErr, isArr, toGrid, dims } from './values';
import { fill } from '../../content/excelPractice';
import { columnsOf } from '../csv';

export const sheetFromRows = (rows) => Sheet.fromRows(columnsOf(rows.slice(0, 200)), rows);

const sameScalar = (a, b) => {
  if (isErr(a) || isErr(b)) return isErr(a) && isErr(b) && a.code === b.code;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return (a ?? null) === (b ?? null);
};

export const sameValue = (a, b) => {
  if (!isArr(a) && !isArr(b)) return sameScalar(a, b);
  const x = toGrid(a);
  const y = toGrid(b);
  const [h, w] = dims(x);
  const [h2, w2] = dims(y);
  if (h !== h2 || w !== w2) return false;
  return x.every((row, i) => row.every((v, j) => sameScalar(v, y[i][j])));
};

// Expected answer for a formula exercise, evaluated at its target cell.
export const expectedFor = (sheet, exercise, lastRow) => {
  const { row, col } = parseRef(exercise.cell);
  return sheet.evaluateAt(fill(exercise.formula, lastRow).replace(/^=/, ''), row, col);
};

export const gradeFormula = (sheet, exercise, lastRow) => {
  const { row, col } = parseRef(exercise.cell);
  const raw = sheet.getRaw(row, col);
  if (raw === undefined) return { ok: false, reason: `Type something in ${exercise.cell} first` };
  const got = sheet.result(row, col);
  const expected = expectedFor(sheet, exercise, lastRow);
  if (sameValue(got, expected)) return { ok: true };
  const show = (v) => (isArr(v) ? `a ${dims(v)[0]} × ${dims(v)[1]} array` : isErr(v) ? v.code : JSON.stringify(v));
  if (isArr(got) || isArr(expected)) return { ok: false, reason: `Got ${show(got)}, expected ${show(expected)}` };
  return { ok: false, reason: `Got ${show(got)}, which is not the expected answer\nTry the hint` };
};
