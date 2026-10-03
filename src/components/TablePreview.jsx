import React from 'react';
import { Table } from 'lucide-react';
import { describeTable, joinColumns } from '../lib/sqlTables';
import { formatNumber } from '../lib/format';

const JOINS = joinColumns();

const show = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
};

// A table's columns in order, with a type hint and one example row, so you
// can write SQL without guessing names. Column names insert into the editor.
const TablePreview = ({ name, rows, onPickTable, onInsertColumn, badge }) => {
  const cols = describeTable(rows);
  const joins = JOINS[name] || new Set();
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border-b">
        <button type="button" onClick={() => onPickTable && onPickTable(name)} className="flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline" title={`Preview ${name}`}>
          <Table size={12} aria-hidden="true" /><code className="font-mono">{name}</code>
        </button>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">{badge}{formatNumber(rows.length)} rows</span>
      </div>
      {cols.length ? (
        <div className="overflow-x-auto">
          <table className="text-[11px] whitespace-nowrap">
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.name} className="px-2 pt-1.5 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => onInsertColumn && onInsertColumn(c.name)}
                      title={`Insert ${c.name}`}
                      className={`font-mono font-semibold hover:text-blue-700 ${joins.has(c.name) ? 'text-blue-700' : 'text-slate-800'}`}
                    >
                      {joins.has(c.name) ? '🔑 ' : ''}{c.name}
                    </button>
                  </th>
                ))}
              </tr>
              <tr>{cols.map(c => <th key={c.name} className="px-2 text-left font-normal text-[10px] text-slate-400">{c.type}</th>)}</tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                {cols.map(c => <td key={c.name} className="px-2 py-1 font-mono text-slate-600">{show(c.example)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      ) : <div className="px-2.5 py-2 text-[11px] text-slate-400">Empty table</div>}
    </div>
  );
};

export default TablePreview;
