// Builds the downloadable practice workbook: an Instructions sheet, one
// sheet per dataset (dates as real Excel dates) and an Answers sheet.
import { EXCEL_PRACTICE, DATASETS, GROUPS, fill } from '../../content/excelPractice';
import { LESSONS, TRACKS } from '../../content/excelLessons';
import { columnsOf } from '../csv';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cell = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return { value: v, type: Number };
  if (typeof v === 'boolean') return { value: v, type: Boolean };
  if (typeof v === 'string' && ISO.test(v)) return { value: new Date(`${v}T00:00:00Z`), type: Date, format: 'yyyy-mm-dd' };
  return { value: String(v), type: String };
};
const head = (labels) => labels.map(l => ({ value: l, fontWeight: 'bold', backgroundColor: '#E2E8F0' }));
const plain = (s) => String(s).replace(/`/g, '');
const groupLabel = (id) => (GROUPS.find(g => g.id === id) || {}).label || id;

export const buildPracticeWorkbook = (tables) => {
  const sheets = [];
  const intro = [
    [{ value: 'WorkX Excel practice workbook', fontWeight: 'bold', fontSize: 14 }],
    [{ value: 'Each task names a sheet and a target cell\nType your formula there, then compare with the Answers sheet', wrap: true }],
    [],
    head(['#', 'Group', 'Sheet', 'Cell', 'Task', 'Hint']),
  ];
  EXCEL_PRACTICE.forEach((e, i) => {
    const last = (tables[e.dataset] || []).length + 1;
    const task = e.pivot ? `${plain(fill(e.prompt, last))}\nInsert › PivotTable on the ${e.dataset} sheet` : plain(fill(e.prompt, last));
    intro.push([cell(i + 1), cell(groupLabel(e.group)), cell(e.dataset), cell(e.cell || 'new sheet'), { value: task, wrap: true }, { value: plain(fill(e.hint, last)), wrap: true }]);
  });
  sheets.push({ data: intro, sheet: 'Instructions', columns: [{ width: 5 }, { width: 22 }, { width: 12 }, { width: 10 }, { width: 70 }, { width: 60 }], stickyRowsCount: 4 });

  Object.keys(DATASETS).forEach(name => {
    const rows = tables[name] || [];
    const cols = columnsOf(rows.slice(0, 200));
    sheets.push({
      data: [head(cols), ...rows.map(r => cols.map(c => cell(r[c])))],
      sheet: name,
      columns: cols.map(() => ({ width: 16 })),
      stickyRowsCount: 1,
    });
  });

  const answers = [head(['#', 'Sheet', 'Cell', 'Reference answer'])];
  EXCEL_PRACTICE.forEach((e, i) => {
    const last = (tables[e.dataset] || []).length + 1;
    const p = e.pivot;
    const text = e.formula
      ? fill(e.formula, last)
      : `Rows: ${p.rows}${p.cols ? ` · Columns: ${p.cols}` : ''} · Values: ${p.agg} of ${p.value}${p.filterField ? ` · Filter: ${p.filterField} = ${p.filterValue}` : ''}${p.percent ? ' · Show values as % of grand total' : ''}`;
    answers.push([cell(i + 1), cell(e.dataset), cell(e.cell || ''), { value: text, type: String }]);
  });
  sheets.push({ data: answers, sheet: 'Answers', columns: [{ width: 5 }, { width: 12 }, { width: 8 }, { width: 90 }], stickyRowsCount: 1 });

  const lessons = [head(['Track', 'Lesson', 'Task', 'Code', 'Answer'])];
  LESSONS.forEach(l => lessons.push([cell((TRACKS.find(t => t.id === l.track) || {}).label), cell(l.title), { value: plain(l.task), wrap: true }, { value: l.code, wrap: true }, { value: l.answer, wrap: true }]));
  sheets.push({ data: lessons, sheet: 'VBA PQ DAX', columns: [{ width: 18 }, { width: 28 }, { width: 50 }, { width: 70 }, { width: 70 }], stickyRowsCount: 1 });
  return sheets;
};

export const downloadPracticeWorkbook = async (tables) => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(buildPracticeWorkbook(tables)).toFile('WorkX_excel_practice.xlsx');
};
