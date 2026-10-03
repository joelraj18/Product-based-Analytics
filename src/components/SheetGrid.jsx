import React, { useEffect, useRef, useState } from 'react';
import { indexToCol, refName } from '../lib/excel/parser';
import { isErr, isArr, formatNumber } from '../lib/excel/values';

// What a cell shows: numbers trimmed to 4 decimals, booleans in capitals.
export const displayValue = (v) => {
  if (v === null || v === undefined) return '';
  if (isErr(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : formatNumber(Math.round(v * 10000) / 10000);
  return String(v);
};

// Typed text becomes a number, boolean or text, like Excel.
export const parseInput = (text) => {
  const s = String(text);
  if (s.startsWith('=')) return s;
  const t = s.trim();
  if (t === '') return '';
  if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return Number(t);
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return s;
};

const rawText = (raw) => (raw === undefined || raw === null ? '' : typeof raw === 'boolean' ? (raw ? 'TRUE' : 'FALSE') : String(raw));

// Spreadsheet grid with a formula bar. The parent owns the Sheet and calls
// onEdit(row, col, raw) to change a cell; `version` forces a redraw.
const SheetGrid = ({ sheet, version, onEdit, maxRows = 600, minCols = 12, target, draft, height = '60vh', label = 'Spreadsheet' }) => {
  const [sel, setSel] = useState(target || { row: 1, col: Math.min(sheet.maxCol + 1, 25) });
  const [text, setText] = useState('');
  const barRef = useRef(null);
  const gridRef = useRef(null);
  const cols = Math.max(minCols, sheet.maxCol + 4);
  const rows = Math.min(Math.max(sheet.usedRows() + 15, 30), maxRows);
  const targetKey = target ? `${target.row},${target.col},${target.at || ''}` : null;

  useEffect(() => { if (target) setSel({ row: target.row, col: target.col }); }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setText(rawText(sheet.getRaw(sel.row, sel.col))); }, [sel, sheet, version]);
  // A draft (from the function list) goes into the formula bar of the selected cell.
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    if (barRef.current) barRef.current.focus();
  }, [draft]);
  // Keep the selected cell in view, but not on first render, so the sheet
  // opens at column A instead of scrolled to the starting cell.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const el = gridRef.current && gridRef.current.querySelector(`[data-cell="${sel.row},${sel.col}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [sel]);

  const move = (dr, dc) => setSel(s => ({ row: Math.max(0, Math.min(rows - 1, s.row + dr)), col: Math.max(0, Math.min(cols - 1, s.col + dc)) }));
  const commit = (dr = 1, dc = 0) => {
    const before = rawText(sheet.getRaw(sel.row, sel.col));
    if (text !== before) onEdit(sel.row, sel.col, parseInput(text));
    move(dr, dc);
    if (gridRef.current) gridRef.current.focus();
  };

  const onGridKey = (e) => {
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); move(...arrows[e.key]); return; }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); if (barRef.current) barRef.current.focus(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onEdit(sel.row, sel.col, ''); return; }
    if (e.key === 'Tab') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setText(e.key);
      if (barRef.current) barRef.current.focus();
    }
  };

  const selValue = sheet.value(sel.row, sel.col);
  const spill = sheet.spillOrigin(sel.row, sel.col);

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-2 border-b bg-slate-50 px-2 py-1.5">
        <span className="font-mono text-xs font-bold text-slate-600 w-14 text-center bg-white border rounded py-1" aria-label="Selected cell">{refName(sel.row, sel.col)}</span>
        <span className="text-slate-400 font-serif italic text-sm" aria-hidden="true">fx</span>
        <input
          ref={barRef}
          aria-label="Formula bar"
          className="flex-1 font-mono text-sm px-2 py-1 border rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={text}
          spellCheck={false}
          placeholder="Type a value or a formula such as =SUM(C2:C10)"
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(e.shiftKey ? -1 : 1, 0); }
            if (e.key === 'Tab') { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); }
            if (e.key === 'Escape') { setText(rawText(sheet.getRaw(sel.row, sel.col))); if (gridRef.current) gridRef.current.focus(); }
          }}
        />
        <span className="hidden md:inline text-xs text-slate-500 max-w-[14rem] truncate" title={displayValue(selValue)}>
          = <span className={isErr(selValue) ? 'text-rose-600 font-semibold' : 'text-slate-800'}>{displayValue(selValue)}</span>
          {spill && <span className="ml-1 text-blue-700">· spills {spill[0]} × {spill[1]}</span>}
        </span>
      </div>
      <div
        ref={gridRef}
        tabIndex={0}
        role="grid"
        aria-label={label}
        onKeyDown={onGridKey}
        className="overflow-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300"
        style={{ maxHeight: height, scrollPaddingLeft: '2.75rem', scrollPaddingTop: '1.75rem' }}
      >
        <table className="border-collapse text-xs font-mono">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-100 border w-10 min-w-[2.5rem]" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className={`bg-slate-100 border px-2 py-1 font-semibold min-w-[6.5rem] ${c === sel.col ? 'text-blue-700 bg-blue-100' : 'text-slate-500'}`}>{indexToCol(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th className={`sticky left-0 z-10 border px-1 font-semibold text-right ${r === sel.row ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const v = sheet.value(r, c);
                  const raw = sheet.getRaw(r, c);
                  const formula = typeof raw === 'string' && raw.startsWith('=');
                  const spilled = raw === undefined && sheet.isSpillCell(r, c);
                  const origin = formula && isArr(sheet.result(r, c));
                  const selected = r === sel.row && c === sel.col;
                  const isTarget = target && r === target.row && c === target.col;
                  return (
                    <td
                      key={c}
                      data-cell={`${r},${c}`}
                      role="gridcell"
                      aria-selected={selected}
                      onMouseDown={() => setSel({ row: r, col: c })}
                      onDoubleClick={() => barRef.current && barRef.current.focus()}
                      title={formula ? raw : undefined}
                      className={[
                        'border px-2 py-0.5 max-w-[14rem] truncate cursor-cell',
                        r === 0 ? 'font-semibold bg-slate-50 text-slate-700' : 'text-slate-800',
                        typeof v === 'number' ? 'text-right tabular-nums' : '',
                        isErr(v) ? 'text-rose-600 font-semibold' : '',
                        formula ? 'bg-emerald-50' : '',
                        spilled ? 'bg-blue-50' : '',
                        origin ? 'outline outline-1 outline-blue-500 -outline-offset-1' : '',
                        isTarget && !selected ? 'ring-2 ring-inset ring-amber-400' : '',
                        selected ? 'ring-2 ring-inset ring-blue-600' : '',
                      ].join(' ')}
                    >{displayValue(v)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet.usedRows() > maxRows && <div className="text-xs text-slate-500 px-2 py-1 border-t">Showing the first {maxRows} rows · formulas still use every row</div>}
    </div>
  );
};

export default SheetGrid;
