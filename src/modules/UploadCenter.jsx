import React, { useMemo, useRef, useState } from 'react';
import {
  UploadCloud, FileSpreadsheet, Database, CheckCircle2, XCircle, AlertTriangle, Download, Trash2, Play, ArrowRight, FileDown,
} from 'lucide-react';
import { Card, PageHeader, Button, Field, Select, TextInput, DataTable, Badge, StatusPill, useToast } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { readTable, gridToTable, inferType, ACCEPT, MAX_BYTES } from '../lib/fileImport';
import { SCHEMAS, SCHEMA_BY_ID, validate, suggestSchema, templateCSV } from '../lib/schemas';
import { applyImport, TARGETS } from '../lib/importMerge';
import { explainProblems } from '../lib/importFile';
import { BUILTIN_TABLES, sanitizeTableName } from '../lib/sqlTables';
import { downloadFile, downloadCSV, columnsOf, today } from '../lib/csv';
import { save } from '../lib/storage';
import { formatNumber } from '../lib/format';

const TYPE_LABEL = { date: 'date (YYYY-MM-DD)', month: 'month (YYYY-MM)', number: 'number', text: 'text' };
const OPEN_SCREEN = { volume_history: 'forecast', plan_lines: 'capacity', actuals: 'kpis', op_targets: 'budget', events: 'forecast', defects: 'kpis', risks: 'scenarios', orders: 'dashboard' };

const Step = ({ n, title, children }) => (
  <Card className="p-5">
    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">{n}</span>{title}
    </h3>
    {children}
  </Card>
);

const ColumnReference = ({ ws }) => (
  <Card id="column-reference">
    <div className="px-5 py-3 border-b">
      <h3 className="font-bold text-slate-800">Column reference — exact column names each feature needs</h3>
      <p className="text-xs text-slate-500 mt-1">Headers are matched ignoring case and spaces (“Line ID” = <code>line_id</code>). Extra columns are allowed. Download a template, fill it in Excel or Google Sheets, and upload it above.</p>
    </div>
    <div className="divide-y">
      {SCHEMAS.map(s => {
        const [key] = TARGETS[s.id];
        const current = Array.isArray(ws[key]) ? ws[key] : [];
        return (
          <details key={s.id} className="group">
            <summary className="px-5 py-3 cursor-pointer flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
              <span>
                <span className="font-semibold text-slate-800">{s.label}</span>
                <span className="ml-2 text-xs text-slate-500">→ {s.usedBy.join(', ')}</span>
              </span>
              <span className="text-xs font-mono text-slate-600">{s.required.map(c => c.name).join(', ')}</span>
            </summary>
            <div className="px-5 pb-4 space-y-3">
              <p className="text-sm text-slate-600">{s.description}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>{['Column', 'Required', 'Type', 'Meaning', 'Example'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...s.required.map(c => ({ ...c, req: true })), ...s.optional.map(c => ({ ...c, req: false }))].map(c => (
                      <tr key={c.name}>
                        <td className="px-3 py-1.5 font-mono text-xs">{c.name}</td>
                        <td className="px-3 py-1.5">{c.req ? <Badge type="danger">required</Badge> : <Badge>optional</Badge>}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">{TYPE_LABEL[c.type]}</td>
                        <td className="px-3 py-1.5 text-slate-700">{c.description}</td>
                        <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{String(c.example)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadFile(templateCSV(s), `template_${s.id}.csv`)}><FileDown size={12} /> Template (CSV)</Button>
                {current.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => downloadCSV(current, `${s.id}_${today()}.csv`)}><Download size={12} /> Current data ({formatNumber(current.length)} rows)</Button>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  </Card>
);

const UploadCenter = ({ onNavigate }) => {
  const ws = useWorkspace();
  const { userTables, saveUserTable, deleteUserTable } = ws;
  const { notify } = useToast();
  const [parsed, setParsed] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRows, setHeaderRows] = useState({});
  const [dest, setDest] = useState('sql');
  const [tableName, setTableName] = useState('');
  const [modes, setModes] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(null);
  const inputRef = useRef(null);

  const sheet = parsed ? parsed.sheets[sheetIdx] : null;
  const headerRow = sheet ? (headerRows[sheetIdx] ?? sheet.headerRow) : 0;
  const table = useMemo(() => (sheet ? gridToTable(sheet.grid, headerRow) : null), [sheet, headerRow]);
  const schema = dest !== 'sql' ? SCHEMA_BY_ID[dest] : null;
  const check = useMemo(() => (schema && table ? validate(schema, table.columns, table.rows) : null), [schema, table]);
  const sqlName = sanitizeTableName(tableName);
  const sqlReserved = BUILTIN_TABLES.includes(sqlName);
  const sqlExists = Boolean(userTables[sqlName]);

  const pickSheet = (i, p = parsed) => {
    setSheetIdx(i);
    const sh = p.sheets[i];
    const t = gridToTable(sh.grid, sh.headerRow);
    const suggestion = suggestSchema(t.columns);
    setDest(suggestion || 'sql');
    setTableName(sanitizeTableName(p.sheets.length > 1 ? `${p.fileName}_${sh.name}` : p.fileName));
  };

  const loadFile = async (file) => {
    if (!file) return;
    setError(''); setDone(null); setBusy(true);
    try {
      const p = await readTable(file);
      setParsed(p);
      setHeaderRows({});
      pickSheet(0, p);
    } catch (e) {
      setParsed(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const importSql = async () => {
    if (!table || !table.rows.length) return;
    try {
      setBusy(true);
      await saveUserTable(sqlName, {
        rows: table.rows, columns: table.columns, source: `${parsed.fileName}${parsed.sheets.length > 1 ? ` › ${sheet.name}` : ''}`,
        uploadedAt: new Date().toISOString(),
      });
      setDone({ kind: 'sql', name: sqlName, rows: table.rows.length });
      notify(`Saved ${formatNumber(table.rows.length)} rows as SQL table "${sqlName}".`);
    } catch (e) {
      notify(`Could not save the table: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const importFeature = () => {
    if (!check || !check.ok) return;
    const mode = modes[dest] || schema.modes[0].id;
    const result = applyImport(ws, dest, mode, check.rows);
    setDone({ kind: 'feature', schemaId: dest, rows: check.rows.length, warnings: result.warnings });
    notify(`Imported ${formatNumber(check.rows.length)} rows into ${schema.label}.`, result.warnings.length ? 'warning' : 'success');
  };

  const openInSql = (name) => {
    save('sql_query', `SELECT * FROM ${name} LIMIT 100`);
    save('sql_tab', 'query');
    onNavigate('sql');
  };

  const tableRows = Object.entries(userTables).map(([name, t]) => ({
    id: name, name, rows: (t.rows || []).length, columns: (t.columns || columnsOf(t.rows || [])).length, source: t.source || '', uploadedAt: (t.uploadedAt || '').slice(0, 16).replace('T', ' '),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Upload Data"
        subtitle="Bring your own CSV, TSV, JSON or Excel (.xlsx) files. Any file can become a SQL table for practice; planning screens need the exact columns listed in the Column reference."
        actions={<Button variant="secondary" onClick={() => document.getElementById('column-reference')?.scrollIntoView({ behavior: 'smooth' })}>Column reference</Button>}
      />

      <Step n={1} title="Choose a file">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a file: drop it here or press Enter to browse"
          onClick={() => inputRef.current && inputRef.current.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current && inputRef.current.click(); } }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
        >
          <UploadCloud size={36} className="mx-auto text-blue-600 mb-2" aria-hidden="true" />
          <p className="font-semibold text-slate-700">{busy ? 'Reading file…' : 'Drop a file here, or click to browse'}</p>
          <p className="text-xs text-slate-500 mt-1">.csv · .tsv · .txt · .json · .xlsx — up to {MAX_BYTES / 1048576} MB. Files never leave your browser.</p>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" data-testid="upload-input" onChange={e => { const f = e.target.files[0]; e.target.value = ''; loadFile(f); }} />
        </div>
        {error && <div role="alert" className="mt-3 p-3 rounded-lg bg-rose-50 text-rose-800 text-sm flex gap-2"><XCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
      </Step>

      {parsed && table && (
        <>
          <Step n={2} title="Check the preview">
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm text-slate-700"><FileSpreadsheet size={16} /> <b>{parsed.fileName}</b></div>
              {parsed.sheets.length > 1 && (
                <Field label="Sheet" className="w-56">
                  <Select value={String(sheetIdx)} onChange={v => pickSheet(Number(v))} options={parsed.sheets.map((s, i) => ({ value: String(i), label: s.name }))} />
                </Field>
              )}
              <Field label="Header row" hint="row with column names" className="w-44">
                <Select value={String(headerRow)} onChange={v => setHeaderRows({ ...headerRows, [sheetIdx]: Number(v) })} options={sheet.grid.slice(0, 10).map((_, i) => ({ value: String(i), label: `Row ${i + 1}` }))} />
              </Field>
              <span className="text-sm text-slate-500">{formatNumber(table.rows.length)} rows · {table.columns.length} columns</span>
            </div>
            <div className="overflow-auto max-h-80 border rounded-lg">
              <table className="text-sm min-w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {table.columns.map(c => (
                      <th key={c} className="px-3 py-2 text-left border-b whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{c}</div>
                        <div className="text-[10px] font-normal text-slate-400">{inferType(table.rows, c)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {table.rows.slice(0, 20).map((r, i) => (
                    <tr key={i}>{table.columns.map(c => <td key={c} className="px-3 py-1.5 whitespace-nowrap text-slate-700">{String(r[c] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {table.rows.length > 20 && <p className="text-xs text-slate-400 mt-1">Showing the first 20 rows.</p>}
          </Step>

          <Step n={3} title="Choose where it goes">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6">
              <fieldset className="space-y-2">
                <legend className="sr-only">Destination</legend>
                <label className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${dest === 'sql' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="dest" checked={dest === 'sql'} onChange={() => setDest('sql')} className="mt-1" />
                  <span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1"><Database size={14} /> SQL table — any file</span>
                    <span className="block text-xs text-slate-500">Query it in SQL Lab, join it with other tables, practise SQL.</span>
                  </span>
                </label>
                <div className="text-xs font-bold uppercase text-slate-500 pt-2">Or feed a planning feature (exact columns required)</div>
                {SCHEMAS.map(s => {
                  const v = table ? validate(s, table.columns, []) : null;
                  const fits = v && !v.missing.length;
                  return (
                    <label key={s.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${dest === s.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="dest" checked={dest === s.id} onChange={() => setDest(s.id)} className="mt-1" />
                      <span className="flex-1">
                        <span className="font-semibold text-slate-800 flex items-center gap-2">{s.label} {fits ? <StatusPill status="good">columns match</StatusPill> : null}</span>
                        <span className="block text-xs text-slate-500">→ {s.usedBy.slice(0, 3).join(', ')}{s.usedBy.length > 3 ? '…' : ''}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="space-y-4">
                {dest === 'sql' ? (
                  <>
                    <Field label="Table name" hint="letters, numbers and _ only">
                      <TextInput value={tableName} onChange={setTableName} placeholder="my_table" />
                    </Field>
                    <p className="text-sm text-slate-600">Will be saved as <code className="bg-slate-100 px-1 rounded">{sqlName}</code> with {formatNumber(table.rows.length)} rows and these columns: <span className="font-mono text-xs">{table.columns.join(', ')}</span></p>
                    {sqlReserved && <div role="alert" className="p-3 rounded-lg bg-rose-50 text-rose-800 text-sm">“{sqlName}” is a built-in table name. Choose another name, e.g. <code>my_{sqlName}</code>.</div>}
                    {sqlExists && !sqlReserved && <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />A table named “{sqlName}” already exists and will be replaced.</div>}
                    <Button onClick={importSql} disabled={busy || sqlReserved || !table.rows.length}><Database size={16} /> Save as SQL table</Button>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="font-semibold text-slate-800">{schema.label}</div>
                      <p className="text-sm text-slate-600 mt-1">{schema.description}</p>
                    </div>
                    <ul className="space-y-1 text-sm" aria-label="Column checklist">
                      {schema.required.map(c => {
                        const ok = c.name in check.matched;
                        return (
                          <li key={c.name} className="flex items-start gap-2">
                            {ok ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" aria-label="found" /> : <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" aria-label="missing" />}
                            <span><code className="font-semibold">{c.name}</code> <span className="text-slate-500">— {TYPE_LABEL[c.type]}, {c.description}</span>
                              {ok && check.matched[c.name] !== c.name && <span className="text-xs text-slate-500"> (from your column “{check.matched[c.name]}”)</span>}
                              {!ok && <span className="block text-xs text-rose-700">Missing — rename one of your columns to “{c.name}” or add it.</span>}
                            </span>
                          </li>
                        );
                      })}
                      {schema.optional.filter(c => c.name in check.matched).length > 0 && (
                        <li className="text-xs text-slate-500 pl-6">Optional columns found: {schema.optional.filter(c => c.name in check.matched).map(c => c.name).join(', ')}</li>
                      )}
                    </ul>
                    {check.missing.length === 0 && (check.issues.length > 0 || check.skipped > 0) && (
                      <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm whitespace-pre-line flex gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />{explainProblems(dest, check)}
                      </div>
                    )}
                    <Field label="How to import">
                      <Select value={modes[dest] || schema.modes[0].id} onChange={v => setModes({ ...modes, [dest]: v })} options={schema.modes.map(m => ({ value: m.id, label: m.label }))} />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={importFeature} disabled={!check.ok}><Play size={16} /> Import {check.ok ? `${formatNumber(check.rows.length)} rows` : ''}</Button>
                      <Button variant="secondary" onClick={() => downloadFile(templateCSV(schema), `template_${schema.id}.csv`)}><FileDown size={16} /> Template</Button>
                    </div>
                    {!check.ok && check.missing.length > 0 && <p className="text-xs text-rose-700">Import is disabled until every required column is present.</p>}
                  </>
                )}
                {done && (
                  <div role="status" className="p-3 rounded-lg bg-emerald-50 text-emerald-900 text-sm space-y-2">
                    <div className="flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                      {done.kind === 'sql' ? `Saved ${formatNumber(done.rows)} rows as “${done.name}”.` : `Imported ${formatNumber(done.rows)} rows into ${SCHEMA_BY_ID[done.schemaId].label}.`}
                    </div>
                    {done.warnings && done.warnings.map(w => <div key={w} className="text-amber-900">{w}</div>)}
                    <Button size="sm" variant="secondary" onClick={() => (done.kind === 'sql' ? openInSql(done.name) : onNavigate(OPEN_SCREEN[done.schemaId]))}>
                      {done.kind === 'sql' ? 'Open in SQL Lab' : `Open ${SCHEMA_BY_ID[done.schemaId].usedBy[0]}`} <ArrowRight size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Step>
        </>
      )}

      <Card>
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Your uploaded SQL tables</h3>
          <span className="text-xs text-slate-500">Stored in this browser (IndexedDB) · included in Settings → backup</span>
        </div>
        <DataTable
          rows={tableRows}
          emptyText="No uploaded tables yet — upload any file above as a SQL table."
          columns={[
            { key: 'name', label: 'Table', render: r => <code className="font-semibold">{r.name}</code> },
            { key: 'rows', label: 'Rows', align: 'right', format: v => formatNumber(v) },
            { key: 'columns', label: 'Columns', align: 'right' },
            { key: 'source', label: 'From file' },
            { key: 'uploadedAt', label: 'Uploaded' },
            {
              key: 'actions', label: '', render: r => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openInSql(r.name)}><Database size={12} /> Query</Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadCSV(userTables[r.name].rows, `${r.name}.csv`, userTables[r.name].columns)} aria-label={`Download ${r.name}`}><Download size={12} /></Button>
                  <Button size="sm" variant="danger" onClick={() => { if (window.confirm(`Delete table ${r.name}?`)) deleteUserTable(r.name); }} aria-label={`Delete ${r.name}`}><Trash2 size={12} /></Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <ColumnReference ws={ws} />
    </div>
  );
};

export default UploadCenter;
