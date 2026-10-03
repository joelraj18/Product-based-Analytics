import React, { useMemo, useState } from 'react';
import { Download, CheckCircle2, Lightbulb, Eye, RotateCcw, Copy, Search, FileSpreadsheet, Table2, BookOpen } from 'lucide-react';
import { Card, Button, Tabs, Badge, Select, DataTable, EmptyState, useToast } from '../components/ui';
import { Prose } from '../components/help';
import SheetGrid, { displayValue } from '../components/SheetGrid';
import { useWorkspace } from '../state/workspace';
import usePersistentState from '../hooks/usePersistentState';
import { builtinTables } from '../lib/sqlTables';
import { columnsOf, downloadCSV } from '../lib/csv';
import { parseRef, indexToCol } from '../lib/excel/parser';
import { sheetFromRows, gradeFormula } from '../lib/excel/grade';
import { AGGREGATIONS, buildPivot, pivotRows, samePivot, equivalentFormula } from '../lib/excel/pivot';
import { downloadPracticeWorkbook } from '../lib/excel/workbook';
import { EXCEL_PRACTICE, DATASETS, GROUPS, fill } from '../content/excelPractice';
import { LESSONS, TRACKS } from '../content/excelLessons';
import { FUNCTION_HELP } from '../content/excelFunctions';

// One click examples for the orders sheet; {n} is the last data row.
const STARTERS = [
  { label: 'SUMIFS', formula: '=SUMIFS(C:C,F:F,"North")' },
  { label: 'UNIQUE', formula: '=SORT(UNIQUE(F2:F{n}))' },
  { label: 'FILTER', formula: '=FILTER(A2:C{n},E2:E{n}="Pending")' },
  { label: 'XLOOKUP', formula: '=XLOOKUP(A10,A:A,C:C)' },
];

// Applies saved edits ({ "r,c": raw }) on top of a dataset.
const buildSheet = (rows, edits) => {
  const s = sheetFromRows(rows);
  Object.entries(edits || {}).forEach(([k, v]) => { const [r, c] = k.split(',').map(Number); s.setRaw(r, c, v); });
  return s;
};

// Owns one Sheet per dataset and keeps user edits in local storage.
const useEditableSheet = (storageKey, dataset, rows) => {
  const [allEdits, setAllEdits] = usePersistentState(storageKey, {});
  const edits = (allEdits && allEdits[dataset]) || {};
  const sheet = useMemo(() => buildSheet(rows, edits),
    // Rebuild only when the data or dataset changes; edits are applied in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, dataset]);
  const [version, setVersion] = useState(0);
  const edit = (r, c, raw) => {
    sheet.setRaw(r, c, raw);
    setVersion(v => v + 1);
    setAllEdits(all => ({ ...(all || {}), [dataset]: { ...((all || {})[dataset] || {}), [`${r},${c}`]: raw } }));
  };
  const reset = () => {
    Object.keys(edits).forEach(k => { const [r, c] = k.split(',').map(Number); const orig = r > 0 ? (rows[r - 1] || {})[columnsOf(rows.slice(0, 200))[c]] : columnsOf(rows.slice(0, 200))[c]; sheet.setRaw(r, c, orig === undefined ? '' : orig); });
    setAllEdits(all => ({ ...(all || {}), [dataset]: {} }));
    setVersion(v => v + 1);
  };
  return { sheet, version, edit, reset, editCount: Object.keys(edits).length };
};

const DatasetPicker = ({ value, onChange, tables, only }) => (
  <Select
    aria-label="Dataset"
    value={value}
    onChange={onChange}
    className="w-auto"
    options={Object.keys(tables).filter(n => !only || only.includes(n)).map(n => ({ value: n, label: `${n} (${tables[n].length.toLocaleString('en-IN')} rows)` }))}
  />
);

const FunctionHelp = ({ onInsert }) => {
  const [q, setQ] = useState('');
  const list = FUNCTION_HELP.filter(h => !q || `${h.syntax} ${h.desc} ${h.group}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card className="flex flex-col overflow-hidden xl:w-80 shrink-0 max-h-[70vh]">
      <div className="p-3 border-b bg-slate-50">
        <div className="text-xs font-bold uppercase text-slate-600 mb-2">Functions · {FUNCTION_HELP.length}</div>
        <label className="flex items-center gap-2 border rounded-lg px-2 py-1 bg-white">
          <Search size={14} className="text-slate-400" />
          <input aria-label="Search functions" className="flex-1 text-sm focus:outline-none" value={q} onChange={e => setQ(e.target.value)} placeholder="Search, for example lookup" />
        </label>
      </div>
      <div className="overflow-auto divide-y">
        {list.map(h => (
          <button type="button" key={h.syntax} onClick={() => onInsert(`=${h.fn.split(' ')[0]}(`)} className="block w-full text-left px-3 py-2 hover:bg-blue-50">
            <code className="text-xs text-blue-800 break-words">{h.syntax}</code>
            <span className="block text-xs text-slate-500 mt-0.5"><Prose text={h.desc} /></span>
          </button>
        ))}
      </div>
    </Card>
  );
};

// ───────────── Pivot builder ─────────────
const PivotBuilder = ({ rows, config, setConfig, compact }) => {
  const fields = columnsOf(rows.slice(0, 200));
  const opts = (blank) => [...(blank ? [{ value: '', label: blank }] : []), ...fields.map(f => ({ value: f, label: f }))];
  const filterValues = useMemo(() => (config.filterField ? [...new Set(rows.map(r => String(r[config.filterField] ?? '')))].sort() : []), [rows, config.filterField]);
  const valid = config.rows && config.value;
  const pivot = useMemo(() => (valid ? buildPivot(rows, config) : null), [rows, config, valid]);
  const table = pivot ? pivotRows(pivot, config) : [];
  const colOf = (f) => indexToCol(fields.indexOf(f));
  const fmt = (v) => (v === null || v === undefined ? '' : config.percent ? `${(v * 100).toFixed(1)}%` : typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })) : String(v));
  const set = (k) => (v) => setConfig(c => ({ ...c, [k]: v, ...(k === 'filterField' ? { filterValue: '' } : {}) }));
  const labelKey = config.rows || 'Rows';
  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
        <label className="text-xs font-semibold text-slate-600">Rows<Select aria-label="Rows field" value={config.rows || ''} onChange={set('rows')} options={opts('Choose a field')} /></label>
        <label className="text-xs font-semibold text-slate-600">Columns<Select aria-label="Columns field" value={config.cols || ''} onChange={set('cols')} options={opts('None')} /></label>
        <label className="text-xs font-semibold text-slate-600">Values<Select aria-label="Values field" value={config.value || ''} onChange={set('value')} options={opts('Choose a field')} /></label>
        <label className="text-xs font-semibold text-slate-600">Summarise by<Select aria-label="Summarise by" value={config.agg || 'Sum'} onChange={set('agg')} options={AGGREGATIONS} /></label>
        <label className="text-xs font-semibold text-slate-600">Filter field<Select aria-label="Filter field" value={config.filterField || ''} onChange={set('filterField')} options={opts('None')} /></label>
        <label className="text-xs font-semibold text-slate-600">Filter value<Select aria-label="Filter value" value={config.filterValue || ''} onChange={set('filterValue')} options={[{ value: '', label: 'All' }, ...filterValues.map(v => ({ value: v, label: v }))]} disabled={!config.filterField} /></label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!!config.percent} onChange={e => set('percent')(e.target.checked)} /> Show values as % of grand total
      </label>
      {pivot ? (
        <>
          <div className="border rounded-lg overflow-hidden">
            <DataTable
              maxHeight={compact ? 320 : 480}
              rows={table.map((r, i) => ({ ...r, key: i }))}
              rowClassName={(r) => (r[labelKey] === 'Grand Total' ? 'font-bold bg-slate-50' : '')}
              columns={Object.keys(table[0] || {}).map((k, i) => ({ key: k, label: k || '(value)', align: i ? 'right' : 'left', format: i ? fmt : undefined }))}
            />
          </div>
          {!compact && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Same number as a formula, for {pivot.rowKeys[0]}{config.cols ? ` and ${pivot.colKeys[0]}` : ''}: <code className="bg-slate-100 px-1 rounded text-slate-800">{equivalentFormula(config, colOf, pivot.rowKeys[0], config.cols ? pivot.colKeys[0] : undefined, rows.length + 1)}</code>{config.percent ? ' divided by the grand total' : ''}</span>
              <Button size="sm" variant="secondary" onClick={() => downloadCSV(table, 'pivot.csv')}><Download size={12} /> Export CSV</Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="Choose a Rows field and a Values field" icon={<Table2 size={36} className="mb-2 opacity-30" />}>Columns and a filter are optional</EmptyState>
      )}
    </div>
  );
};

// ───────────── Lessons ─────────────
const CodeBlock = ({ code, label }) => {
  const { notify } = useToast();
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => notify('Copied', 'success'), () => notify('Copy failed, select the code instead', 'error'));
  };
  return (
    <div className="relative">
      <pre aria-label={label} className="text-xs bg-slate-900 text-blue-100 p-3 pr-16 rounded-lg overflow-auto whitespace-pre">{code}</pre>
      <button type="button" onClick={copy} className="absolute top-2 right-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded px-2 py-1 inline-flex items-center gap-1"><Copy size={11} /> Copy</button>
    </div>
  );
};

const Lessons = () => {
  const [track, setTrack] = usePersistentState('excel_track', 'vba');
  const [lessonId, setLessonId] = usePersistentState('excel_lesson', 'vba01');
  const [done, setDone] = usePersistentState('excel_lessons_done', []);
  const [show, setShow] = useState(false);
  const list = LESSONS.filter(l => l.track === track);
  const lesson = list.find(l => l.id === lessonId) || list[0];
  const t = TRACKS.find(x => x.id === track) || TRACKS[0];
  const doneSet = new Set(Array.isArray(done) ? done : []);
  const pick = (id) => { setLessonId(id); setShow(false); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lesson track">
        {TRACKS.map(x => {
          const all = LESSONS.filter(l => l.track === x.id);
          const n = all.filter(l => doneSet.has(l.id)).length;
          return (
            <button type="button" key={x.id} role="tab" aria-selected={track === x.id} onClick={() => { setTrack(x.id); pick(all[0].id); }}
              className={`px-3 py-2 rounded-lg text-sm font-semibold border text-left ${track === x.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
              {x.label} <span className={track === x.id ? 'text-slate-300' : 'text-slate-400'}>{n}/{all.length}</span>
              <span className={`block text-xs font-normal ${track === x.id ? 'text-slate-300' : 'text-slate-500'}`}>{x.blurb}</span>
            </button>
          );
        })}
      </div>
      <Card className="p-3 text-sm bg-blue-50 border-blue-100 text-blue-900"><span className="font-semibold">How to run this in desktop Excel</span><br /><Prose text={t.setup} chipClassName="bg-blue-100 text-blue-950" /></Card>
      <div className="flex flex-col lg:flex-row gap-4">
        <Card className="lg:w-72 shrink-0 p-2 h-fit">
          {list.map((l, i) => (
            <button type="button" key={l.id} onClick={() => pick(l.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${l.id === lesson.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'}`}>
              <span className="w-5 text-xs opacity-70">{i + 1}</span>
              <span className="flex-1">{l.title}</span>
              {doneSet.has(l.id) && <CheckCircle2 size={14} className={l.id === lesson.id ? 'text-white' : 'text-emerald-600'} aria-label="done" />}
            </button>
          ))}
        </Card>
        <Card className="flex-1 p-5 space-y-4 min-w-0">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{lesson.title}</h3>
            <p className="text-sm text-slate-700 mt-1"><Prose text={lesson.explain} /></p>
          </div>
          <CodeBlock code={lesson.code} label="Lesson code" />
          <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-950">
            <span className="font-semibold">Your turn</span><br />
            <Prose text={lesson.task} chipClassName="bg-amber-100 text-amber-950" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShow(s => !s)}><Eye size={12} /> {show ? 'Hide answer' : 'Show answer'}</Button>
            <Button size="sm" variant={doneSet.has(lesson.id) ? 'secondary' : 'success'} onClick={() => setDone(doneSet.has(lesson.id) ? [...doneSet].filter(x => x !== lesson.id) : [...doneSet, lesson.id])}>
              <CheckCircle2 size={12} /> {doneSet.has(lesson.id) ? 'Marked done' : 'Mark as done'}
            </Button>
          </div>
          {show && <CodeBlock code={lesson.answer} label="Answer code" />}
        </Card>
      </div>
    </div>
  );
};

// ───────────── Practice ─────────────
const Practice = ({ tables }) => {
  const { notify } = useToast();
  const [exId, setExId] = usePersistentState('excel_exercise', EXCEL_PRACTICE[0].id);
  const [solved, setSolved] = usePersistentState('excel_solved', []);
  const [pivotConfig, setPivotConfig] = useState({ agg: 'Sum' });
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState(false);
  const [message, setMessage] = useState(null);
  const ex = EXCEL_PRACTICE.find(e => e.id === exId) || EXCEL_PRACTICE[0];
  const [group, setGroup] = useState(ex.group);
  const rows = tables[ex.dataset] || [];
  const last = rows.length + 1;
  const { sheet, version, edit, reset } = useEditableSheet('excel_practice_edits_v3', ex.dataset, rows);
  const solvedSet = new Set((Array.isArray(solved) ? solved : []).filter(id => EXCEL_PRACTICE.some(e => e.id === id)));
  const inGroup = EXCEL_PRACTICE.filter(e => e.group === group);
  const target = ex.cell ? parseRef(ex.cell) : null;

  const pick = (id) => { setExId(id); setHint(false); setAnswer(false); setMessage(null); setPivotConfig({ agg: 'Sum' }); };
  const pass = () => { setMessage({ ok: true, text: '✓ Correct, nicely done' }); if (!solvedSet.has(ex.id)) setSolved([...solvedSet, ex.id]); };
  const check = () => {
    if (ex.pivot) {
      if (!pivotConfig.rows || !pivotConfig.value) { setMessage({ ok: false, text: 'Choose a Rows field and a Values field first' }); return; }
      const ok = samePivot(pivotRows(buildPivot(rows, pivotConfig), pivotConfig), pivotRows(buildPivot(rows, ex.pivot), ex.pivot));
      if (ok) pass(); else setMessage({ ok: false, text: 'The numbers do not match yet\nCheck the fields, the summary and the filter' });
      return;
    }
    const r = gradeFormula(sheet, ex, last);
    if (r.ok) pass(); else setMessage({ ok: false, text: r.reason });
  };
  const nextUnsolved = () => {
    const i = EXCEL_PRACTICE.findIndex(e => e.id === ex.id);
    const next = [...EXCEL_PRACTICE.slice(i + 1), ...EXCEL_PRACTICE.slice(0, i + 1)].find(e => !solvedSet.has(e.id));
    if (next) { setGroup(next.group); pick(next.id); }
  };
  const download = async () => {
    try { await downloadPracticeWorkbook(tables); notify('Practice workbook downloaded', 'success'); } catch (e) { notify(`Download failed: ${e.message}`, 'error'); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Practice group">
            {GROUPS.map(g => {
              const all = EXCEL_PRACTICE.filter(e => e.group === g.id);
              const n = all.filter(e => solvedSet.has(e.id)).length;
              return (
                <button type="button" key={g.id} role="tab" aria-selected={group === g.id} title={g.blurb}
                  onClick={() => { setGroup(g.id); if (ex.group !== g.id) pick(all[0].id); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${group === g.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                  {g.label || g.id} <span className={group === g.id ? 'text-slate-300' : 'text-slate-400'}>{n}/{all.length}</span>
                  <span className="block h-1 mt-1 rounded bg-slate-200 overflow-hidden"><span className="block h-full bg-emerald-500" style={{ width: `${(100 * n) / all.length}%` }} /></span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={nextUnsolved} disabled={solvedSet.size === EXCEL_PRACTICE.length}>Next unsolved →</Button>
            <Button size="sm" variant="secondary" onClick={download}><Download size={12} /> Practice workbook for Excel</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {inGroup.map((e, i) => (
            <button type="button" key={e.id} onClick={() => pick(e.id)} title={e.title}
              aria-label={`Exercise ${i + 1}: ${e.title}${solvedSet.has(e.id) ? ', solved' : ''}`}
              className={`w-8 h-8 rounded-lg text-xs font-bold border ${e.id === ex.id ? 'bg-blue-600 text-white border-blue-600' : solvedSet.has(e.id) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {solvedSet.has(e.id) && e.id !== ex.id ? '✓' : i + 1}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Badge type="blue">{DATASETS[ex.dataset].label}</Badge>
          {ex.cell && <Badge type="warning">Answer in {ex.cell}</Badge>}
          <h3 className="font-bold text-slate-800">{ex.title}</h3>
          {solvedSet.has(ex.id) && <CheckCircle2 size={16} className="text-emerald-600" aria-label="solved" />}
        </div>
        <p className="text-sm text-slate-700"><Prose text={fill(ex.prompt, last)} /></p>
        <p className="text-xs text-slate-500 mt-1 font-mono">{DATASETS[ex.dataset].letters} · data in rows 2 to {last}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="success" onClick={check}><CheckCircle2 size={14} /> Check my answer</Button>
          <Button size="sm" variant="secondary" onClick={() => setHint(h => !h)}><Lightbulb size={12} /> {hint ? 'Hide hint' : 'Hint'}</Button>
          <Button size="sm" variant="secondary" onClick={() => setAnswer(a => !a)}><Eye size={12} /> {answer ? 'Hide answer' : 'Show answer'}</Button>
          {!ex.pivot && <Button size="sm" variant="ghost" onClick={() => { reset(); setMessage(null); }}><RotateCcw size={12} /> Reset sheet</Button>}
        </div>
        {hint && <p className="mt-2 text-sm bg-amber-50 text-amber-900 p-2 rounded-lg"><Prose text={fill(ex.hint, last)} chipClassName="bg-amber-100 text-amber-950" /></p>}
        {answer && (ex.formula
          ? <pre className="mt-2 text-xs bg-slate-900 text-blue-100 p-3 rounded-lg whitespace-pre-wrap">{fill(ex.formula, last)}</pre>
          : <p className="mt-2 text-sm bg-slate-50 p-2 rounded-lg">Rows <b>{ex.pivot.rows}</b>{ex.pivot.cols && <> · Columns <b>{ex.pivot.cols}</b></>} · {ex.pivot.agg} of <b>{ex.pivot.value}</b>{ex.pivot.filterField && <> · Filter <b>{ex.pivot.filterField}</b> = {ex.pivot.filterValue}</>}{ex.pivot.percent && <> · as % of grand total</>}</p>)}
        {message && <div role="status" className={`mt-3 px-3 py-2 text-sm rounded-lg ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}><Prose text={message.text} /></div>}
      </Card>
      <Card className="overflow-hidden">
        {ex.pivot ? (
          <div className="p-4"><PivotBuilder rows={rows} config={pivotConfig} setConfig={setPivotConfig} compact /></div>
        ) : (
          <SheetGrid key={ex.dataset} sheet={sheet} version={version} onEdit={(r, c, v) => { edit(r, c, v); setMessage(null); }} target={target} height="55vh" label="Practice sheet" />
        )}
      </Card>
    </div>
  );
};

// ───────────── Screen ─────────────
const ExcelLab = () => {
  const ws = useWorkspace();
  const { userTables } = ws;
  const [tab, setTab] = usePersistentState('excel_tab', 'sheet');
  const [dataset, setDataset] = usePersistentState('excel_dataset', 'orders');
  const [pivotDataset, setPivotDataset] = usePersistentState('excel_pivot_dataset', 'orders');
  const [pivotConfig, setPivotConfig] = usePersistentState('excel_pivot', { rows: 'region', cols: 'status', value: 'amount', agg: 'Sum' });
  const builtins = useMemo(() => builtinTables(ws),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ws.orders, ws.inventory, ws.tasks, ws.sites, ws.lines, ws.volumeHistory, ws.plan, ws.actuals, ws.defects, ws.risks, ws.opTargets, ws.events]);
  const tables = useMemo(() => ({ ...builtins, ...Object.fromEntries(Object.entries(userTables).map(([n, t]) => [n, t.rows || []])) }), [builtins, userTables]);
  const ds = tables[dataset] ? dataset : 'orders';
  const rows = tables[ds];
  const { sheet, version, edit, reset, editCount } = useEditableSheet('excel_sheet_edits_v3', ds, rows);
  const pds = tables[pivotDataset] ? pivotDataset : 'orders';
  const [draft, setDraft] = useState(null);
  const [target, setTarget] = useState(null);
  const dataCols = columnsOf(rows.slice(0, 200)).length;
  const freeCol = indexToCol(dataCols);
  // Starter formulas go in row 2 of the first empty column after the data.
  const addStarter = (formula) => {
    let col = dataCols;
    while (col < 60 && (sheet.getRaw(1, col) !== undefined || sheet.isSpillCell(1, col) || sheet.getRaw(0, col) !== undefined)) col += 1;
    edit(1, col, fill(formula, rows.length + 1));
    setTarget({ row: 1, col, at: Date.now() });
  };

  const exportSheet = () => {
    const cols = Math.max(sheet.maxCol + 1, 1);
    const out = [];
    for (let r = 0; r < sheet.usedRows(); r++) {
      const row = {};
      for (let c = 0; c < cols; c++) row[indexToCol(c)] = displayValue(sheet.value(r, c));
      out.push(row);
    }
    downloadCSV(out, `${ds}_sheet.csv`, Array.from({ length: cols }, (_, c) => indexToCol(c)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'sheet', label: 'Sheet' },
          { value: 'pivot', label: 'Pivot table' },
          { value: 'practice', label: 'Practice' },
          { value: 'lessons', label: 'VBA, Power Query & DAX' },
        ]} />
        <span className="text-xs text-slate-500">Formulas run on a copy, so your workspace data is never changed</span>
      </div>

      {tab === 'sheet' && (
        <div className="flex flex-col xl:flex-row gap-4">
          <Card className="flex-1 overflow-hidden min-w-0">
            <div className="p-3 border-b flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <DatasetPicker value={ds} onChange={setDataset} tables={tables} />
                <span className="text-xs text-slate-500">Headers are in row 1 · type formulas in column {freeCol} or further right</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ds === 'orders' && <span className="text-xs text-slate-500 self-center">Try</span>}
                {ds === 'orders' && STARTERS.map(s => <Button key={s.label} size="sm" variant="ghost" onClick={() => addStarter(s.formula)} title={fill(s.formula, rows.length + 1)}>{s.label}</Button>)}
                <Button size="sm" variant="secondary" onClick={exportSheet}><Download size={12} /> CSV</Button>
                {editCount > 0 && <Button size="sm" variant="ghost" onClick={reset}><RotateCcw size={12} /> Reset ({editCount})</Button>}
              </div>
            </div>
            <SheetGrid key={ds} sheet={sheet} version={version} onEdit={edit} target={target} draft={draft} height="62vh" />
          </Card>
          <FunctionHelp onInsert={(text) => setDraft({ text, at: Date.now() })} />
        </div>
      )}

      {tab === 'pivot' && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Table2 size={16} className="text-blue-600" />
            <DatasetPicker value={pds} onChange={(v) => { setPivotDataset(v); setPivotConfig({ agg: 'Sum' }); }} tables={tables} />
            <span className="text-xs text-slate-500">Pick fields below and the table updates as you go</span>
          </div>
          <PivotBuilder rows={tables[pds]} config={pivotConfig} setConfig={setPivotConfig} />
        </Card>
      )}

      {tab === 'practice' && <Practice tables={tables} />}
      {tab === 'lessons' && <Lessons />}
      {tab !== 'lessons' && tab !== 'practice' && (
        <p className="text-xs text-slate-500 flex items-center gap-1"><BookOpen size={12} /> VBA macros, Power Query and Power Pivot run only in desktop Excel, so they are taught as guided lessons with code to copy</p>
      )}
    </div>
  );
};

export default ExcelLab;
