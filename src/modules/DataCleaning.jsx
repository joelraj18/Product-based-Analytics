import React, { useMemo, useState } from 'react';
import {
  Sparkles, Rows3, CalendarClock, Calculator, Trash2, Brush, Undo2, BarChart3, Copy, Type, Scissors, Pencil,
} from 'lucide-react';
import { Card, Button, Field, Select, TextInput, KPICard, DataTable, PageHeader, useToast } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { columnsOf } from '../lib/csv';
import {
  toNumber, isMissing, mean, median, mode, skewness, describeSkew, iqrFences, numericValues,
} from '../lib/stats';
import { parseDate, isoDate } from '../lib/dates';
import { formatNumber } from '../lib/format';

const Section = ({ icon, title, children, accent = 'border-l-blue-500' }) => (
  <Card className={`p-5 border-l-4 ${accent}`}>
    <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b pb-2">{icon} {title}</div>
    <div className="space-y-3">{children}</div>
  </Card>
);

const profileColumn = (rows, col) => {
  const values = rows.map(r => r[col]);
  const missing = values.filter(isMissing).length;
  const present = values.filter(v => !isMissing(v));
  const nums = present.map(toNumber).filter(Number.isFinite);
  const numericShare = present.length ? nums.length / present.length : 0;
  const type = present.length === 0 ? 'empty' : numericShare > 0.8 ? 'numeric' : present.filter(v => parseDate(v)).length / present.length > 0.8 && present.some(v => /\d{4}-\d{2}/.test(String(v))) ? 'date' : 'text';
  return {
    column: col,
    type,
    missing,
    missing_pct: rows.length ? (100 * missing) / rows.length : 0,
    unique: new Set(present.map(String)).size,
    non_numeric: type === 'numeric' ? present.length - nums.length : 0,
    min: type === 'numeric' && nums.length ? Math.min(...nums) : '',
    max: type === 'numeric' && nums.length ? Math.max(...nums) : '',
    mean: type === 'numeric' && nums.length ? mean(nums) : '',
  };
};

const toTitle = (s) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const DataCleaning = () => {
  const { orders: data, setOrders } = useWorkspace();
  const { notify } = useToast();
  const [undoStack, setUndoStack] = useState([]);
  const columns = useMemo(() => columnsOf(data), [data]);
  const profile = useMemo(() => columns.map(c => profileColumn(data, c)), [data, columns]);
  const numericCols = profile.filter(p => p.type === 'numeric').map(p => p.column);
  const firstNumeric = numericCols[0] || columns[0] || '';

  const [numCol, setNumCol] = useState('');
  const [catCol, setCatCol] = useState('');
  const [catFill, setCatFill] = useState('');
  const [genValues, setGenValues] = useState('Pending, Shipped, Delivered');
  const [dateCol, setDateCol] = useState('');
  const [startDate, setStartDate] = useState(() => isoDate(new Date(Date.now() - 365 * 86400000)));
  const [endDate, setEndDate] = useState(() => isoDate(new Date()));
  const [dedupeCol, setDedupeCol] = useState('');
  const [caseCol, setCaseCol] = useState('');
  const [caseMode, setCaseMode] = useState('title');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [dropCol, setDropCol] = useState('');
  const [skewResult, setSkewResult] = useState(null);

  const nc = columns.includes(numCol) ? numCol : firstNumeric;
  const cc = columns.includes(catCol) ? catCol : (columns.find(c => /status|category|region/i.test(c)) || columns[0] || '');
  const dc = dateCol;

  const totalCells = data.length * columns.length;
  const missingCells = profile.reduce((s, p) => s + p.missing, 0);
  const health = totalCells ? Math.round(100 * (1 - missingCells / totalCells)) : 100;

  const apply = (next, message) => {
    setUndoStack(s => [...s.slice(-4), data]);
    setOrders(next);
    notify(message);
  };
  const undo = () => {
    if (!undoStack.length) return;
    setOrders(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
    notify('Reverted the last operation', 'info');
  };

  // ---- operations ----
  const trimAll = () => {
    let changed = 0;
    const next = data.map(row => {
      const out = {};
      Object.entries(row).forEach(([k, v]) => {
        const t = typeof v === 'string' ? v.trim().replace(/\s{2,}/g, ' ') : v;
        if (t !== v) changed++;
        out[k] = t;
      });
      return out;
    });
    apply(next, `Trimmed whitespace in ${changed} cell(s)`);
  };

  const imputeNumeric = (method) => {
    if (!nc) return;
    const vals = numericValues(data, nc);
    if (!vals.length) { notify(`No numeric values in \`${nc}\``, 'warning'); return; }
    const fill = method === 'mean' ? Number(mean(vals).toFixed(2)) : method === 'median' ? median(vals) : 0;
    let filled = 0;
    let cleaned = 0;
    const next = data.map(row => {
      const n = toNumber(row[nc]);
      if (!Number.isFinite(n)) { filled++; return { ...row, [nc]: fill }; }
      if (n !== row[nc]) cleaned++;
      return { ...row, [nc]: n };
    });
    apply(next, `\`${nc}\`: converted ${cleaned} formatted value(s) to numbers\nFilled ${filled} missing or invalid value(s) with the ${method} (${fill})`);
  };

  const checkSkew = () => {
    const vals = numericValues(data, nc);
    if (vals.length < 3) { setSkewResult('Not enough numeric data'); return; }
    const sk = skewness(vals);
    const { lower, upper } = iqrFences(vals);
    const outliers = vals.filter(v => v < lower || v > upper).length;
    setSkewResult(`Skew ${sk.toFixed(2)} · ${describeSkew(sk)} · ${outliers} IQR outlier(s) outside [${formatNumber(lower, 1)}, ${formatNumber(upper, 1)}]`);
  };

  const capOutliers = () => {
    const vals = numericValues(data, nc);
    if (vals.length < 4) { notify('Not enough numeric data', 'warning'); return; }
    const { lower, upper } = iqrFences(vals);
    let capped = 0;
    const next = data.map(row => {
      const n = toNumber(row[nc]);
      if (!Number.isFinite(n)) return row;
      const c = Math.min(upper, Math.max(lower, n));
      if (c !== n) capped++;
      return { ...row, [nc]: Number(c.toFixed(2)) };
    });
    apply(next, `Capped ${capped} outlier(s) in \`${nc}\` to the IQR fences`);
  };

  const fillCategorical = (method) => {
    if (!cc) return;
    const present = data.map(r => r[cc]).filter(v => !isMissing(v));
    const fill = method === 'mode' ? mode(present.map(String)) : catFill.trim();
    if (!fill) { notify(method === 'mode' ? 'This column is entirely empty' : 'Enter a fill value', 'warning'); return; }
    let filled = 0;
    const next = data.map(row => (isMissing(row[cc]) ? (filled++, { ...row, [cc]: fill }) : row));
    apply(next, `Filled ${filled} empty \`${cc}\` cell(s) with “${fill}”`);
  };

  const generateCategory = () => {
    const opts = genValues.split(',').map(s => s.trim()).filter(Boolean);
    const target = cc || 'status';
    if (!opts.length) { notify('Enter at least one value', 'warning'); return; }
    if (!window.confirm(`Overwrite every value in “${target}” with random picks from: ${opts.join(', ')}?\nUse this only for test data`)) return;
    apply(data.map(row => ({ ...row, [target]: opts[Math.floor(Math.random() * opts.length)] })), `Generated random \`${target}\` values`);
  };

  const fillDates = () => {
    const col = dc.trim();
    if (!col) { notify('Choose or type a date column', 'warning'); return; }
    const a = parseDate(startDate);
    const b = parseDate(endDate);
    if (!a || !b) { notify('Pick a valid date range', 'warning'); return; }
    const min = Math.min(a.getTime(), b.getTime());
    const max = Math.max(a.getTime(), b.getTime());
    let filled = 0;
    const next = data.map(row => {
      if (!isMissing(row[col])) return row;
      filled++;
      return { ...row, [col]: isoDate(new Date(min + Math.random() * (max - min))) };
    });
    apply(next, `Filled ${filled} missing date(s) in \`${col}\``);
  };

  const normalizeDates = () => {
    const col = dc.trim();
    if (!columns.includes(col)) { notify('Choose an existing date column', 'warning'); return; }
    let fixed = 0;
    let bad = 0;
    const next = data.map(row => {
      if (isMissing(row[col])) return row;
      const d = parseDate(row[col]);
      if (!d) { bad++; return row; }
      const iso = isoDate(d);
      if (iso !== row[col]) fixed++;
      return { ...row, [col]: iso };
    });
    apply(next, `Normalized ${fixed} date(s) in \`${col}\` to year month day format${bad ? `\n${bad} value(s) could not be read and were left unchanged` : ''}`);
  };

  const dedupe = () => {
    const seen = new Set();
    const next = data.filter(row => {
      const key = dedupeCol ? String(row[dedupeCol] ?? '') : JSON.stringify(columns.map(c => row[c]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    apply(next, `Removed ${data.length - next.length} duplicate row(s)${dedupeCol ? ` by \`${dedupeCol}\`` : ''}`);
  };

  const changeCase = () => {
    const col = caseCol || cc;
    if (!col) return;
    const fn = caseMode === 'upper' ? s => s.toUpperCase() : caseMode === 'lower' ? s => s.toLowerCase() : toTitle;
    apply(data.map(row => (typeof row[col] === 'string' ? { ...row, [col]: fn(row[col]) } : row)), `Standardized case in \`${col}\``);
  };

  const rename = () => {
    const to = renameTo.trim();
    if (!renameFrom || !to) { notify('Pick a column and a new name', 'warning'); return; }
    if (columns.includes(to)) { notify(`\`${to}\` already exists`, 'warning'); return; }
    apply(data.map(row => {
      const out = {};
      Object.entries(row).forEach(([k, v]) => { out[k === renameFrom ? to : k] = v; });
      return out;
    }), `Renamed '${renameFrom}' → '${to}'.`);
    setRenameFrom(''); setRenameTo('');
  };

  const drop = () => {
    if (!dropCol) return;
    if (!window.confirm(`Delete the '${dropCol}' column from all ${data.length} rows?`)) return;
    apply(data.map(row => { const { [dropCol]: _, ...rest } = row; return rest; }), `Removed column \`${dropCol}\``);
    setDropCol('');
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Data Cleaning & Profiling"
        subtitle="Profile the orders dataset and fix quality issues before analysis, and undo any of the last 5 operations"
        actions={<Button variant="secondary" onClick={undo} disabled={!undoStack.length}><Undo2 size={16} /> Undo ({undoStack.length})</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Data health" value={`${health}%`} sub="cells with a value" icon={<Sparkles size={20} className="text-emerald-600" />} />
        <KPICard title="Rows" value={formatNumber(data.length)} sub={`${columns.length} columns`} icon={<Rows3 size={20} className="text-blue-600" />} />
        <KPICard title="Missing cells" value={formatNumber(missingCells)} sub={`${profile.filter(p => p.missing).length} column(s) affected`} icon={<BarChart3 size={20} className="text-amber-600" />} />
      </div>

      <Card>
        <div className="px-5 py-3 border-b font-bold text-slate-800">Column profile</div>
        <DataTable
          maxHeight={320}
          rows={profile.map(p => ({ ...p, id: p.column }))}
          columns={[
            { key: 'column', label: 'Column' },
            { key: 'type', label: 'Type' },
            { key: 'missing', label: 'Missing', align: 'right' },
            { key: 'missing_pct', label: 'Missing %', align: 'right', format: v => `${v.toFixed(1)}%` },
            { key: 'non_numeric', label: 'Not numeric', align: 'right' },
            { key: 'unique', label: 'Unique', align: 'right' },
            { key: 'min', label: 'Min', align: 'right', format: v => (v === '' ? '' : formatNumber(v, 2)) },
            { key: 'max', label: 'Max', align: 'right', format: v => (v === '' ? '' : formatNumber(v, 2)) },
            { key: 'mean', label: 'Mean', align: 'right', format: v => (v === '' ? '' : formatNumber(v, 2)) },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section icon={<Calculator size={18} />} title="Numeric columns" accent="border-l-indigo-500">
          <Field label="Column"><Select value={nc} onChange={setNumCol} options={columns} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" onClick={() => imputeNumeric('mean')}>Fill with mean</Button>
            <Button size="sm" variant="secondary" onClick={() => imputeNumeric('median')}>Fill with median</Button>
            <Button size="sm" variant="secondary" onClick={() => imputeNumeric('zero')}>Fill with 0</Button>
          </div>
          <p className="text-xs text-slate-500">Strips currency symbols and thousands separators, so “₹1,299” becomes 1299, and treats zero as a real value</p>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Button size="sm" variant="secondary" onClick={checkSkew}><BarChart3 size={14} /> Check distribution</Button>
            <Button size="sm" variant="secondary" onClick={capOutliers}><Scissors size={14} /> Cap outliers (IQR)</Button>
          </div>
          {skewResult && <div className="text-xs font-mono bg-slate-100 p-2 rounded text-slate-700 border">{skewResult}</div>}
        </Section>

        <Section icon={<Type size={18} />} title="Categorical columns" accent="border-l-violet-500">
          <Field label="Column"><Select value={cc} onChange={setCatCol} options={columns} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={() => fillCategorical('mode')}>Fill blanks with mode</Button>
            <div className="flex gap-2">
              <TextInput value={catFill} onChange={setCatFill} placeholder="Value" className="py-1 text-xs" aria-label="Fill value" />
              <Button size="sm" variant="secondary" onClick={() => fillCategorical('value')}>Fill</Button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 pt-2 border-t items-center">
            <Select value={caseCol || cc} onChange={setCaseCol} options={columns} aria-label="Case column" />
            <Select value={caseMode} onChange={setCaseMode} options={[{ value: 'title', label: 'Title Case' }, { value: 'upper', label: 'UPPER' }, { value: 'lower', label: 'lower' }]} aria-label="Case mode" />
            <Button size="sm" variant="secondary" onClick={changeCase}>Apply</Button>
          </div>
          <div className="pt-2 border-t">
            <Field label="Generate test values" hint="overwrites column">
              <div className="flex gap-2">
                <TextInput value={genValues} onChange={setGenValues} className="text-xs" aria-label="Values to generate" />
                <Button size="sm" variant="secondary" onClick={generateCategory}>Generate</Button>
              </div>
            </Field>
          </div>
        </Section>

        <Section icon={<CalendarClock size={18} />} title="Dates">
          <Field label="Date column" hint="pick or type a new one">
            <TextInput value={dc} onChange={setDateCol} placeholder="e.g. delivery_date" list="date-cols" />
            <datalist id="date-cols">{columns.map(c => <option key={c} value={c} />)}</datalist>
          </Field>
          <Button size="sm" variant="secondary" onClick={normalizeDates} className="w-full">Normalize to year month day</Button>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <input type="date" aria-label="Start date" className="p-2 border border-slate-300 rounded-lg text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <input type="date" aria-label="End date" className="p-2 border border-slate-300 rounded-lg text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Button size="sm" variant="secondary" onClick={fillDates} className="w-full"><Sparkles size={14} /> Fill missing dates randomly in range</Button>
        </Section>

        <Section icon={<Brush size={18} />} title="Structure" accent="border-l-slate-500">
          <div className="flex items-center justify-between gap-3">
            <div><div className="font-semibold text-sm">Trim whitespace</div><div className="text-xs text-slate-500">Leading/trailing and repeated spaces in every cell</div></div>
            <Button size="sm" variant="secondary" onClick={trimAll}>Run</Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 pt-2 border-t">
            <Select value={dedupeCol} onChange={setDedupeCol} options={[{ value: '', label: 'Duplicates: all columns match' }, ...columns.map(c => ({ value: c, label: `Duplicates by ${c}` }))]} aria-label="Duplicate key" />
            <Button size="sm" variant="secondary" onClick={dedupe}><Copy size={14} /> Remove</Button>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 pt-2 border-t">
            <Select value={renameFrom} onChange={setRenameFrom} options={columns} placeholder="Rename column…" aria-label="Column to rename" />
            <TextInput value={renameTo} onChange={setRenameTo} placeholder="New name" aria-label="New column name" />
            <Button size="sm" variant="secondary" onClick={rename}><Pencil size={14} /></Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 pt-2 border-t">
            <Select value={dropCol} onChange={setDropCol} options={columns} placeholder="Remove column…" aria-label="Column to remove" />
            <Button size="sm" variant="danger" onClick={drop} disabled={!dropCol}><Trash2 size={14} /> Drop</Button>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default DataCleaning;
