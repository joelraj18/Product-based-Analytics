import React, { useMemo, useState } from 'react';
import alasql from 'alasql';
import { Database, Table, Play, Download, History, Trash2 } from 'lucide-react';
import { Card, Button, DataTable, EmptyState } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { columnsOf, downloadCSV } from '../lib/csv';
import { planToRows } from '../lib/planEngine';

const EXAMPLES = [
  { label: 'Revenue by region', sql: 'SELECT region, COUNT(*) AS orders, SUM(amount) AS revenue\nFROM orders\nGROUP BY region\nORDER BY revenue DESC' },
  { label: 'Orders ↔ inventory by category', sql: 'SELECT o.category, COUNT(*) AS orders, SUM(o.amount) AS revenue, inv.skus, inv.stock\nFROM orders o\nJOIN (SELECT category, COUNT(*) AS skus, SUM(stock) AS stock\n      FROM inventory GROUP BY category) AS inv\n  ON o.category = inv.category\nGROUP BY o.category, inv.skus, inv.stock\nORDER BY revenue DESC' },
  { label: 'Headcount gap by plan line', sql: 'SELECT line_id, MIN(gap_fte) AS worst_gap_fte, SUM(hires) AS perm_hires,\n  SUM(temp_hires) AS temp_hires, ROUND(SUM(ot_hours)) AS ot_hours\nFROM capacity_plan\nGROUP BY line_id\nORDER BY worst_gap_fte' },
  { label: 'Forecast accuracy (WAPE) by line', sql: 'SELECT line_id,\n  ROUND(100 * SUM(ABS(actual_volume - forecast_volume)) / SUM(actual_volume), 2) AS wape_pct,\n  ROUND(100 * (SUM(forecast_volume) - SUM(actual_volume)) / SUM(actual_volume), 2) AS bias_pct\nFROM actuals\nGROUP BY line_id' },
  { label: 'SL misses', sql: 'SELECT week_start, line_id, sl_target, sl_actual, actual_hc, planned_hc\nFROM actuals\nWHERE sl_actual < sl_target\nORDER BY week_start DESC' },
  { label: 'Defect Pareto', sql: 'SELECT category, COUNT(*) AS defects, ROUND(SUM(impact_fte), 1) AS fte_impact\nFROM defects\nGROUP BY category\nORDER BY defects DESC' },
];

const MAX_RENDER = 1000;

const SqlLab = () => {
  const ws = useWorkspace();
  const { setSqlHistory } = ws;
  const [query, setQuery] = useState(EXAMPLES[0].sql);
  const [results, setResults] = useState(null);
  const [message, setMessage] = useState(null);

  const tables = useMemo(() => ({
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
  }), [ws.orders, ws.inventory, ws.tasks, ws.sites, ws.lines, ws.volumeHistory, ws.plan, ws.actuals, ws.defects, ws.risks, ws.opTargets]);

  const history = Array.isArray(ws.sqlHistory) ? ws.sqlHistory : [];

  const runQuery = () => {
    const sql = query.trim();
    if (!sql) return;
    const started = performance.now();
    try {
      // Fresh in-memory database per run so queries can't mutate app state.
      const db = new alasql.Database();
      Object.entries(tables).forEach(([name, rows]) => {
        db.exec(`CREATE TABLE ${name}`);
        db.tables[name].data = rows.map(r => ({ ...r }));
      });
      const res = db.exec(sql);
      const last = Array.isArray(res) && res.length && Array.isArray(res[res.length - 1]) && /;\s*\S/.test(sql) ? res[res.length - 1] : res;
      const rows = Array.isArray(last) ? last.map(r => (r !== null && typeof r === 'object' ? r : { value: r })) : [{ result: last }];
      setResults(rows);
      const ms = Math.round(performance.now() - started);
      setMessage({ ok: true, text: `${rows.length} row${rows.length === 1 ? '' : 's'} in ${ms} ms` });
      setSqlHistory(h => [{ query: sql, time: new Date().toISOString(), rows: rows.length }, ...(Array.isArray(h) ? h : []).filter(x => x.query !== sql)].slice(0, 25));
    } catch (e) {
      setMessage({ ok: false, text: `SQL error: ${e.message}` });
    }
  };

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery(); }
  };

  const insert = (text) => setQuery(q => `${q}${q && !/\s$/.test(q) ? ' ' : ''}${text}`);
  const resultCols = results ? columnsOf(results) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-112px)]">
      <Card className="lg:w-72 flex flex-col overflow-hidden shrink-0 max-h-80 lg:max-h-none">
        <div className="p-3 bg-slate-100 border-b font-bold text-slate-700 flex items-center gap-2 text-sm"><Database size={14} /> Tables</div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {Object.entries(tables).map(([name, rows]) => (
            <details key={name} className="group">
              <summary className="text-xs font-bold text-blue-800 cursor-pointer flex items-center gap-1 list-none">
                <Table size={12} />
                <button type="button" className="hover:underline" onClick={(e) => { e.preventDefault(); setQuery(`SELECT * FROM ${name} LIMIT 100`); }}>{name}</button>
                <span className="text-slate-400 font-normal">({rows.length})</span>
              </summary>
              <div className="pl-3 mt-1 border-l-2 border-slate-100 space-y-0.5">
                {columnsOf(rows.slice(0, 50)).map(col => (
                  <button type="button" key={col} onClick={() => insert(col)} className="w-full text-xs text-slate-600 hover:text-blue-700 hover:bg-slate-50 px-1 rounded flex justify-between">
                    <span>{col}</span><span className="text-[10px] text-slate-400">{typeof rows[0]?.[col]}</span>
                  </button>
                ))}
              </div>
            </details>
          ))}
          <div className="border-t pt-3">
            <div className="text-xs font-bold text-slate-700 uppercase mb-2">Examples</div>
            <div className="space-y-1">
              {EXAMPLES.map(ex => (
                <button type="button" key={ex.label} onClick={() => setQuery(ex.sql)} className="block w-full text-left text-xs text-blue-700 hover:underline">{ex.label}</button>
              ))}
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
                  <button type="button" key={h.time + h.query} onClick={() => setQuery(h.query)} title={h.query} className="block w-full text-left text-[11px] font-mono text-slate-600 hover:bg-slate-50 rounded px-1 truncate">
                    {h.query.replace(/\s+/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
        <Card className="flex flex-col h-64 lg:h-[45%] overflow-hidden">
          <div className="p-2 bg-slate-50 border-b flex flex-wrap justify-between items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase px-1">SQL editor <span className="normal-case font-normal text-slate-400">· Ctrl/⌘ + Enter to run</span></span>
            <Button size="sm" onClick={runQuery}><Play size={14} /> Run query</Button>
          </div>
          <textarea
            aria-label="SQL query"
            className="flex-1 p-4 font-mono text-sm bg-slate-900 text-blue-100 resize-none focus:outline-none leading-relaxed"
            value={query} spellCheck={false}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="SELECT * FROM orders LIMIT 10"
          />
          {message && (
            <div role="status" className={`px-4 py-2 text-xs border-t font-mono ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>{message.text}</div>
          )}
        </Card>

        <Card className="flex-1 overflow-hidden flex flex-col min-h-[240px]">
          {results && results.length > 0 ? (
            <>
              <div className="px-3 py-2 border-b flex justify-between items-center text-xs text-slate-500">
                <span>{results.length > MAX_RENDER ? `Showing first ${MAX_RENDER} of ${results.length} rows` : `${results.length} rows`}</span>
                <Button size="sm" variant="secondary" onClick={() => downloadCSV(results, 'query_results.csv', resultCols)}><Download size={12} /> Export CSV</Button>
              </div>
              <div className="flex-1 min-h-0">
                <DataTable
                  columns={resultCols.map(c => ({ key: c, label: c, format: v => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')) }))}
                  rows={results.slice(0, MAX_RENDER)}
                  maxHeight="100%"
                />
              </div>
            </>
          ) : (
            <EmptyState title={results ? 'Query returned no rows' : 'Run a query to view results'} icon={<Database size={40} className="mb-3 opacity-30" />}>
              Supports JOINs, GROUP BY, sub-queries and aggregate functions across all workspace tables.
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SqlLab;
