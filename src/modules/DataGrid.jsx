import React, { useMemo, useState } from 'react';
import { Table, Download, Plus, Trash2, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Columns } from 'lucide-react';
import { Card, Button, TextInput, EmptyState, useToast } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { columnsOf, downloadCSV, today } from '../lib/csv';
import SchemaImportButton from '../components/SchemaImportButton';

const ROWS_PER_PAGE = 50;

const coerceLike = (raw, previous) => {
  if (typeof previous === 'number' || (previous === '' && /^-?\d+(\.\d+)?$/.test(raw.trim()))) {
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(n)) return n;
  }
  return raw;
};

const DataGrid = () => {
  const { orders: data, setOrders: onUpdateData } = useWorkspace();
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null);
  const [editing, setEditing] = useState(null); // { i, col, value }
  const [selected, setSelected] = useState(() => new Set());
  const columns = useMemo(() => columnsOf(data), [data]);

  const view = useMemo(() => {
    let rows = data.map((r, i) => ({ r, i }));
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(({ r }) => columns.some(c => String(r[c] ?? '').toLowerCase().includes(q)));
    if (sort) {
      rows = [...rows].sort((a, b) => {
        const x = a.r[sort.col];
        const y = b.r[sort.col];
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, columns, search, sort]);

  const totalPages = Math.max(1, Math.ceil(view.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = view.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  const commitEdit = () => {
    if (!editing) return;
    const { i, col, value } = editing;
    const prev = data[i][col];
    const next = coerceLike(value, prev ?? '');
    if (next !== prev) onUpdateData(data.map((r, idx) => (idx === i ? { ...r, [col]: next } : r)));
    setEditing(null);
  };

  const addRow = () => {
    const blank = Object.fromEntries(columns.map(c => [c, '']));
    if ('id' in blank) blank.id = `NEW-${Date.now().toString().slice(-6)}`;
    if ('date' in blank) blank.date = today();
    onUpdateData([blank, ...data]);
    setSort(null); setSearch(''); setPage(1);
  };

  const deleteSelected = () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} selected row(s)?`)) return;
    onUpdateData(data.filter((_, i) => !selected.has(i)));
    notify(`Deleted ${selected.size} row(s).`);
    setSelected(new Set());
  };

  const addColumn = () => {
    const name = (window.prompt('New column name') || '').trim();
    if (!name) return;
    if (columns.includes(name)) { notify(`Column '${name}' already exists.`, 'warning'); return; }
    onUpdateData(data.map(r => ({ ...r, [name]: '' })));
  };

  const toggleSort = (col) => setSort(s => (s && s.col === col ? (s.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }));
  const toggleRow = (i) => setSelected(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const allOnPage = pageRows.length > 0 && pageRows.every(({ i }) => selected.has(i));

  return (
    <Card className="flex flex-col shadow-lg h-[calc(100vh-112px)] min-h-[480px]">
      <div className="p-3 bg-slate-100 border-b flex flex-wrap justify-between items-center gap-2">
        <div className="font-bold text-slate-700 flex items-center gap-2"><Table size={16} /> Data Grid · orders</div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <TextInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search all columns" className="pl-8 py-1.5 w-52" aria-label="Search" />
          </div>
          <Button size="sm" variant="secondary" onClick={addRow} disabled={!columns.length}><Plus size={12} /> Row</Button>
          <Button size="sm" variant="secondary" onClick={addColumn}><Columns size={12} /> Column</Button>
          <Button size="sm" variant="danger" onClick={deleteSelected} disabled={!selected.size}><Trash2 size={12} /> Delete ({selected.size})</Button>
          <Button size="sm" variant="success" onClick={() => (data.length ? downloadCSV(view.map(v => v.r), `orders_${today()}.csv`, columns) : notify('No data to export', 'warning'))}>
            <Download size={12} /> Export{search ? ' filtered' : ''}
          </Button>
          <SchemaImportButton size="sm" schemaId="orders" mode="replace">Import (replace)</SchemaImportButton>
          <SchemaImportButton size="sm" variant="secondary" schemaId="orders" mode="append">Append</SchemaImportButton>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        {!data.length ? <EmptyState title="No records">Import a CSV to get started.</EmptyState> : (
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="w-10 border p-2">
                  <input type="checkbox" aria-label="Select page" checked={allOnPage} onChange={() => setSelected(s => { const n = new Set(s); pageRows.forEach(({ i }) => (allOnPage ? n.delete(i) : n.add(i))); return n; })} />
                </th>
                <th className="w-12 border p-2 text-xs text-slate-500">#</th>
                {columns.map(col => (
                  <th key={col} className="border p-2 text-left text-xs font-bold text-slate-700 uppercase whitespace-nowrap">
                    <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-blue-700">
                      {col}{sort && sort.col === col && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ r, i }, idx) => (
                <tr key={i} className={`${selected.has(i) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <td className="border p-2 text-center"><input type="checkbox" aria-label={`Select row ${i + 1}`} checked={selected.has(i)} onChange={() => toggleRow(i)} /></td>
                  <td className="border p-2 text-center text-xs text-slate-500">{(safePage - 1) * ROWS_PER_PAGE + idx + 1}</td>
                  {columns.map(col => (
                    <td key={col} className="border p-0 text-slate-700 whitespace-nowrap" onDoubleClick={() => setEditing({ i, col, value: String(r[col] ?? '') })}>
                      {editing && editing.i === i && editing.col === col ? (
                        <input
                          autoFocus aria-label={`Edit ${col}`}
                          className="w-full px-2 py-1.5 outline-none ring-2 ring-blue-500"
                          value={editing.value}
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                        />
                      ) : (
                        <div className="px-2 py-1.5 min-h-[30px] cursor-text" title="Double-click to edit">{String(r[col] ?? '')}</div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-slate-100 border-t p-2 text-xs flex justify-between items-center">
        <span className="font-medium text-slate-500">
          {view.length === data.length ? `${data.length} records` : `${view.length} of ${data.length} records`} · double-click a cell to edit
        </span>
        <div className="flex gap-2 items-center">
          <button type="button" aria-label="Previous page" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="p-1 hover:bg-slate-200 rounded disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="font-mono">{safePage} / {totalPages}</span>
          <button type="button" aria-label="Next page" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} className="p-1 hover:bg-slate-200 rounded disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      </div>
    </Card>
  );
};

export default DataGrid;
