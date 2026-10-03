import React, { useMemo, useState } from 'react';
import { Database, Play, Download, History, Trash2, Lightbulb, CheckCircle2, Eye, Upload, Link2 } from 'lucide-react';
import { Card, Button, DataTable, EmptyState, Tabs, Badge, useToast } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { Prose } from '../components/help';
import usePersistentState from '../hooks/usePersistentState';
import { columnsOf, downloadCSV } from '../lib/csv';
import { builtinTables, RELATIONSHIPS } from '../lib/sqlTables';
import TablePreview from '../components/TablePreview';
import SchemaDiagram, { SchemaReferenceButton } from '../components/SchemaDiagram';
import { runSql, sameResult } from '../lib/sqlRunner';
import { PRACTICE, LEVELS } from '../content/sqlPractice';

const EXAMPLES = [
  { label: 'Revenue by region', sql: 'SELECT region, COUNT(*) AS orders, SUM(amount) AS revenue\nFROM orders\nGROUP BY region\nORDER BY revenue DESC' },
  { label: 'Orders ↔ inventory by category', sql: 'SELECT o.category, COUNT(*) AS orders, SUM(o.amount) AS revenue, inv.skus, inv.stock\nFROM orders o\nJOIN (SELECT category, COUNT(*) AS skus, SUM(stock) AS stock\n      FROM inventory GROUP BY category) AS inv\n  ON o.category = inv.category\nGROUP BY o.category, inv.skus, inv.stock\nORDER BY revenue DESC' },
  { label: 'Headcount gap by plan line', sql: 'SELECT line_id, MIN(gap_fte) AS worst_gap_fte, SUM(hires) AS perm_hires,\n  SUM(temp_hires) AS temp_hires, ROUND(SUM(ot_hours)) AS ot_hours\nFROM capacity_plan\nGROUP BY line_id\nORDER BY worst_gap_fte' },
  { label: 'Forecast accuracy (WAPE) by line', sql: 'SELECT line_id,\n  ROUND(100 * SUM(ABS(actual_volume - forecast_volume)) / SUM(actual_volume), 2) AS wape_pct,\n  ROUND(100 * (SUM(forecast_volume) - SUM(actual_volume)) / SUM(actual_volume), 2) AS bias_pct\nFROM actuals\nGROUP BY line_id' },
  { label: 'SL misses', sql: 'SELECT week_start, line_id, sl_target, sl_actual, actual_hc, planned_hc\nFROM actuals\nWHERE sl_actual < sl_target\nORDER BY week_start DESC' },
  { label: 'Defect Pareto', sql: 'SELECT category, COUNT(*) AS defects, ROUND(SUM(impact_fte), 1) AS fte_impact\nFROM defects\nGROUP BY category\nORDER BY defects DESC' },
];

const MAX_RENDER = 1000;

const Results = ({ results, message }) => {
  const cols = results ? columnsOf(results) : [];
  return (
    <Card className="flex-1 overflow-hidden flex flex-col min-h-[240px]">
      {message && (
        <div role="status" className={`px-4 py-2 text-xs border-b font-mono ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}><Prose text={message.text} /></div>
      )}
      {results && results.length > 0 ? (
        <>
          <div className="px-3 py-2 border-b flex justify-between items-center text-xs text-slate-500">
            <span>{results.length > MAX_RENDER ? `Showing first ${MAX_RENDER} of ${results.length} rows` : `${results.length} rows`}</span>
            <Button size="sm" variant="secondary" onClick={() => downloadCSV(results, 'query_results.csv', cols)}><Download size={12} /> Export CSV</Button>
          </div>
          <div className="flex-1 min-h-0">
            <DataTable
              columns={cols.map(c => ({ key: c, label: c, format: v => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')) }))}
              rows={results.slice(0, MAX_RENDER)}
              maxHeight="100%"
            />
          </div>
        </>
      ) : (
        <EmptyState title={results ? 'Query returned no rows' : 'Run a query to view results'} icon={<Database size={40} className="mb-3 opacity-30" />}>
          Supports SELECT, WHERE, GROUP BY, HAVING, JOIN, subqueries, CASE and aggregate functions
        </EmptyState>
      )}
    </Card>
  );
};

const Editor = ({ query, setQuery, onRun, children, tables, uploaded }) => (
  <Card className="flex flex-col h-56 lg:h-64 overflow-hidden">
    <div className="p-2 bg-slate-50 border-b flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs font-bold text-slate-500 uppercase px-1">SQL editor <span className="normal-case font-normal text-slate-400">· Ctrl/⌘ + Enter to run</span></span>
      <div className="flex flex-wrap gap-2">{tables && <SchemaReferenceButton tables={tables} uploaded={uploaded} />}{children}<Button size="sm" onClick={onRun}><Play size={14} /> Run query</Button></div>
    </div>
    <textarea
      aria-label="SQL query"
      className="flex-1 p-4 font-mono text-sm bg-slate-900 text-blue-100 resize-none focus:outline-none leading-relaxed"
      value={query} spellCheck={false}
      onChange={e => setQuery(e.target.value)}
      onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); } }}
      placeholder="SELECT * FROM orders LIMIT 10"
    />
  </Card>
);

const SqlLab = ({ onNavigate }) => {
  const ws = useWorkspace();
  const { setSqlHistory, userTables } = ws;
  const { notify } = useToast();
  const [tab, setTab] = usePersistentState('sql_tab', 'query');
  const [query, setQuery] = usePersistentState('sql_query', EXAMPLES[0].sql);
  const [results, setResults] = useState(null);
  const [message, setMessage] = useState(null);
  const [exerciseId, setExerciseId] = usePersistentState('sql_exercise', PRACTICE[0].id);
  const [solved, setSolved] = usePersistentState('sql_solved', []);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [practiceQuery, setPracticeQuery] = usePersistentState('sql_practice_query', '');

  const builtins = useMemo(() => builtinTables(ws),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ws.orders, ws.inventory, ws.tasks, ws.sites, ws.lines, ws.volumeHistory, ws.plan, ws.actuals, ws.defects, ws.risks, ws.opTargets, ws.events]);
  const uploaded = useMemo(() => Object.fromEntries(Object.entries(userTables).map(([n, t]) => [n, t.rows || []])), [userTables]);
  const tables = useMemo(() => ({ ...builtins, ...uploaded }), [builtins, uploaded]);
  const history = Array.isArray(ws.sqlHistory) ? ws.sqlHistory : [];
  const exercise = PRACTICE.find(p => p.id === exerciseId) || PRACTICE[0];
  const solvedSet = new Set((Array.isArray(solved) ? solved : []).filter(id => PRACTICE.some(p => p.id === id)));
  const levelOf = (id) => (PRACTICE.find(p => p.id === id) || PRACTICE[0]).level;
  const [level, setLevel] = useState(() => levelOf(exerciseId));
  const inLevel = PRACTICE.filter(p => p.level === level);

  const execute = (sql) => {
    const started = performance.now();
    const rows = runSql(sql, tables);
    return { rows, ms: Math.round(performance.now() - started) };
  };

  const runQuery = () => {
    const sql = query.trim();
    if (!sql) return;
    try {
      const { rows, ms } = execute(sql);
      setResults(rows);
      setMessage({ ok: true, text: `${rows.length} row${rows.length === 1 ? '' : 's'} in ${ms} ms` });
      setSqlHistory(h => [{ query: sql, time: new Date().toISOString(), rows: rows.length }, ...(Array.isArray(h) ? h : []).filter(x => x.query !== sql)].slice(0, 25));
    } catch (e) {
      setResults(null);
      setMessage({ ok: false, text: `SQL error: ${e.message}` });
    }
  };

  const runPractice = (check) => {
    const sql = practiceQuery.trim();
    if (!sql) { setMessage({ ok: false, text: 'Write a query first' }); return; }
    try {
      const { rows } = execute(sql);
      setResults(rows);
      if (!check) { setMessage({ ok: true, text: `${rows.length} rows` }); return; }
      const expected = execute(exercise.solution).rows;
      if (sameResult(rows, expected, exercise.ordered)) {
        setMessage({ ok: true, text: `✓ Correct! ${rows.length} rows match the expected answer` });
        if (!solvedSet.has(exercise.id)) setSolved([...solvedSet, exercise.id]);
      } else {
        const why = rows.length !== expected.length
          ? `expected ${expected.length} row(s), got ${rows.length}`
          : Object.keys(rows[0] || {}).length !== Object.keys(expected[0] || {}).length
            ? `expected ${Object.keys(expected[0] || {}).length} column(s), got ${Object.keys(rows[0] || {}).length}`
            : exercise.ordered ? 'values or their order differ' : 'some values differ';
        setMessage({ ok: false, text: `Not quite, ${why}\nTry the hint` });
      }
    } catch (e) {
      setResults(null);
      setMessage({ ok: false, text: `SQL error: ${e.message}` });
    }
  };

  const pickExercise = (id) => {
    setExerciseId(id); setLevel(levelOf(id)); setShowHint(false); setShowSolution(false); setResults(null); setMessage(null); setPracticeQuery('');
  };
  const nextUnsolved = () => {
    const start = PRACTICE.findIndex(p => p.id === exercise.id);
    const next = [...PRACTICE.slice(start + 1), ...PRACTICE.slice(0, start + 1)].find(p => !solvedSet.has(p.id));
    if (next) pickExercise(next.id);
  };

  const insert = (text) => {
    const add = (q) => `${q}${q && !/\s$/.test(q) ? ' ' : ''}${text}`;
    if (tab === 'practice') setPracticeQuery(add); else setQuery(add);
  };

  const pickTable = (name) => {
    const q = `SELECT * FROM ${name} LIMIT 100`;
    if (tab === 'practice') setPracticeQuery(q); else { setTab('query'); setQuery(q); }
  };

  const TableList = (
    <div className="flex-1 overflow-auto p-3 space-y-3">
      {[['Built in tables', builtins], ['Your uploaded tables', uploaded]].map(([group, list]) => (
        <div key={group}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{group}</div>
          {Object.keys(list).length === 0 && (
            <button type="button" onClick={() => onNavigate && onNavigate('upload')} className="text-xs text-blue-700 hover:underline flex items-center gap-1"><Upload size={12} /> Upload a CSV/Excel file</button>
          )}
          <div className="space-y-2">
            {Object.entries(list).map(([name, rows]) => (
              <TablePreview
                key={name}
                name={name}
                rows={rows}
                onPickTable={pickTable}
                onInsertColumn={insert}
              />
            ))}
          </div>
        </div>
      ))}
      {tab === 'query' && (
        <>
          <div className="border-t pt-3">
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">Examples</div>
            <div className="space-y-1">
              {EXAMPLES.map(ex => <button type="button" key={ex.label} onClick={() => setQuery(ex.sql)} className="block w-full text-left text-xs text-blue-700 hover:underline">{ex.label}</button>)}
            </div>
          </div>
          {history.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1"><History size={12} /> History</span>
                <button type="button" aria-label="Clear history" onClick={() => setSqlHistory([])} className="text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
              </div>
              <div className="space-y-1">
                {history.map(h => (
                  <button type="button" key={h.time + h.query} onClick={() => setQuery(h.query)} title={h.query} className="block w-full text-left text-[11px] font-mono text-slate-600 hover:bg-slate-50 rounded px-1 truncate">{h.query.replace(/\s+/g, ' ')}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={(t) => { setTab(t); setResults(null); setMessage(null); }}
          tabs={[{ value: 'query', label: 'Query' }, { value: 'practice', label: `Practice (${solvedSet.size}/${PRACTICE.length})` }, { value: 'schema', label: 'Schema' }]}
        />
        <span className="text-xs text-slate-500">{Object.keys(tables).length} tables · queries run on a copy, so your data is never changed</span>
      </div>

      {tab === 'schema' ? (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><Link2 size={16} /> How the tables connect</h3>
            <p className="text-sm text-slate-500 mb-3">🔑 marks join columns, and each line joins two tables, for example <code className="bg-slate-100 px-1 rounded">FROM capacity_plan c JOIN plan_lines l ON c.line_id = l.id</code></p>
            <SchemaDiagram tables={tables} uploaded={uploaded} maxHeight="70vh" />
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 text-sm mt-4">
              {RELATIONSHIPS.map(([a, b, why]) => (
                <li key={a + b} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-50 border">
                  <code className="text-blue-800">{a}</code><span className="text-slate-400">→</span><code className="text-blue-800">{b}</code>
                  <span className="text-xs text-slate-500 w-full">{why}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {Object.entries(tables).map(([name, rows]) => (
              <TablePreview
                key={name}
                name={name}
                rows={rows}
                badge={uploaded[name] ? <Badge type="purple">uploaded</Badge> : null}
                onPickTable={(n) => { setTab('query'); setQuery(`SELECT * FROM ${n} LIMIT 100`); }}
                onInsertColumn={(c) => { setTab('query'); setQuery(q => `${q}${q && !/\s$/.test(q) ? ' ' : ''}${c}`); }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-170px)]">
          <Card className="lg:w-96 flex flex-col overflow-hidden shrink-0 max-h-96 lg:max-h-none">
            <div className="p-3 bg-slate-100 border-b font-bold text-slate-700 flex items-center gap-2 text-sm"><Database size={14} /> Tables <span className="font-normal text-xs text-slate-500">· click a column to insert it</span></div>
            {TableList}
          </Card>

          <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
            {tab === 'practice' && (
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap gap-1" role="tablist" aria-label="Practice level">
                    {LEVELS.map(l => {
                      const all = PRACTICE.filter(p => p.level === l.id);
                      const done = all.filter(p => solvedSet.has(p.id)).length;
                      return (
                        <button
                          type="button" key={l.id} role="tab" aria-selected={level === l.id}
                          onClick={() => { setLevel(l.id); if (exercise.level !== l.id) pickExercise(all[0].id); }}
                          title={l.blurb}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${level === l.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        >
                          {l.label} <span className={level === l.id ? 'text-slate-300' : 'text-slate-400'}>{done}/{all.length}</span>
                          <span className="block h-1 mt-1 rounded bg-slate-200 overflow-hidden"><span className="block h-full bg-emerald-500" style={{ width: `${(100 * done) / all.length}%` }} /></span>
                        </button>
                      );
                    })}
                  </div>
                  <Button size="sm" variant="secondary" onClick={nextUnsolved} disabled={solvedSet.size === PRACTICE.length}>Next unsolved →</Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {inLevel.map((p, i) => (
                    <button
                      type="button" key={p.id} onClick={() => pickExercise(p.id)}
                      title={`${p.topic}: ${p.title}`}
                      aria-label={`Exercise ${i + 1}: ${p.title}${solvedSet.has(p.id) ? ', solved' : ''}`}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border ${p.id === exercise.id ? 'bg-blue-600 text-white border-blue-600' : solvedSet.has(p.id) ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >{solvedSet.has(p.id) && p.id !== exercise.id ? '✓' : i + 1}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge type={exercise.level === 'Beginner' ? 'success' : exercise.level === 'Intermediate' ? 'blue' : exercise.level === 'Advanced' ? 'warning' : 'purple'}>{(LEVELS.find(l => l.id === exercise.level) || {}).label}</Badge>
                  <Badge>{exercise.topic}</Badge>
                  <h3 className="font-bold text-slate-800">{exercise.title}</h3>
                  {solvedSet.has(exercise.id) && <CheckCircle2 size={16} className="text-emerald-600" aria-label="solved" />}
                </div>
                <p className="text-sm text-slate-700"><Prose text={exercise.prompt} /></p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => setShowHint(h => !h)}><Lightbulb size={12} /> {showHint ? 'Hide hint' : 'Hint'}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowSolution(s => !s)}><Eye size={12} /> {showSolution ? 'Hide solution' : 'Show solution'}</Button>
                </div>
                {showHint && <p className="mt-2 text-sm bg-amber-50 text-amber-900 p-2 rounded-lg"><Prose text={exercise.hint} chipClassName="bg-amber-100 text-amber-950" /></p>}
                {showSolution && <pre className="mt-2 text-xs bg-slate-900 text-blue-100 p-3 rounded-lg whitespace-pre-wrap">{exercise.solution}</pre>}
              </Card>
            )}
            {tab === 'practice' ? (
              <Editor query={practiceQuery} setQuery={setPracticeQuery} onRun={() => runPractice(false)} tables={tables} uploaded={uploaded}>
                <Button size="sm" variant="success" onClick={() => runPractice(true)}><CheckCircle2 size={14} /> Check my answer</Button>
              </Editor>
            ) : (
              <Editor query={query} setQuery={setQuery} onRun={runQuery} tables={tables} uploaded={uploaded}>
                {!query.trim() && <Button size="sm" variant="ghost" onClick={() => notify('Pick an example on the left or click a table name', 'info')}>Need an idea?</Button>}
              </Editor>
            )}
            <Results results={results} message={message} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SqlLab;
