import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RELATIONSHIPS, describeTable, joinColumns } from '../lib/sqlTables';

const W = 200;          // box width
const HEAD = 26;        // header height
const ROW = 18;         // column row height
const GAP_X = 70;
const GAP_Y = 22;
const MAX_ROWS = 8;     // columns shown per box before "+N more"

// Hand placed so plan_lines sits in the middle with its children around it.
const LAYOUT = [
  ['volume_history', 'capacity_plan', 'actuals'],
  ['sites', 'plan_lines'],
  ['defects', 'risks', 'events'],
  ['orders', 'inventory', 'op_targets', 'tasks'],
];

const JOINS = joinColumns();

// Join columns first, then the rest in table order, capped.
const visibleColumns = (name, rows) => {
  const all = describeTable(rows).map(c => c.name);
  const keys = all.filter(c => (JOINS[name] || new Set()).has(c));
  const rest = all.filter(c => !keys.includes(c));
  const shown = [...keys, ...rest].slice(0, MAX_ROWS);
  return { shown, hidden: Math.max(0, all.length - shown.length), keys: new Set(keys) };
};

export const layoutSchema = (tables) => {
  const names = Object.keys(tables);
  const cols = LAYOUT.map(c => c.filter(n => names.includes(n)));
  const placed = new Set(cols.flat());
  const extra = names.filter(n => !placed.has(n));
  // Uploaded or unknown tables go in extra columns of up to 4.
  for (let i = 0; i < extra.length; i += 4) cols.push(extra.slice(i, i + 4));
  const boxes = {};
  let width = 0;
  let height = 0;
  cols.forEach((col, ci) => {
    let y = 0;
    col.forEach(name => {
      const v = visibleColumns(name, tables[name] || []);
      const h = HEAD + (v.shown.length + (v.hidden ? 1 : 0)) * ROW + 8;
      boxes[name] = { name, x: ci * (W + GAP_X), y, w: W, h, ...v };
      y += h + GAP_Y;
      height = Math.max(height, y);
    });
    width = Math.max(width, ci * (W + GAP_X) + W);
  });
  const anchor = (table, column) => {
    const b = boxes[table];
    if (!b) return null;
    const i = b.shown.indexOf(column);
    const cy = b.y + HEAD + (i >= 0 ? i : 0) * ROW + ROW / 2 + 2;
    return { b, cy };
  };
  const edges = RELATIONSHIPS.map(([a, bRef, why]) => {
    const [ta, ca] = a.split('.');
    const [tb, cb] = bRef.split('.');
    const s = anchor(ta, ca);
    const t = anchor(tb, cb);
    if (!s || !t) return null;
    let d;
    if (s.b.x === t.b.x) {
      // Same column: loop out on the left side.
      const x = s.b.x;
      d = `M ${x} ${s.cy} C ${x - 45} ${s.cy}, ${x - 45} ${t.cy}, ${x} ${t.cy}`;
    } else {
      const leftToRight = s.b.x < t.b.x;
      const x1 = leftToRight ? s.b.x + W : s.b.x;
      const x2 = leftToRight ? t.b.x : t.b.x + W;
      const mid = (x1 + x2) / 2;
      d = `M ${x1} ${s.cy} C ${mid} ${s.cy}, ${mid} ${t.cy}, ${x2} ${t.cy}`;
    }
    return { key: `${a}-${bRef}`, d, label: `${a} → ${bRef}: ${why}` };
  }).filter(Boolean);
  return { boxes: Object.values(boxes), edges, width: width + 60, height };
};

// Entity relationship style picture of the workspace tables.
const SchemaDiagram = ({ tables, uploaded = {}, maxHeight }) => {
  const { boxes, edges, width, height } = useMemo(() => layoutSchema(tables), [tables]);
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <svg
        viewBox={`-50 -10 ${width} ${height + 20}`}
        width={width}
        height={height + 20}
        role="img"
        aria-label="Diagram of how the tables connect"
        className="font-sans"
      >
        <g fill="none" stroke="#2a78d6" strokeWidth="1.5" opacity="0.75">
          {edges.map(e => <path key={e.key} d={e.d} data-edge={e.key}><title>{e.label}</title></path>)}
        </g>
        {boxes.map(b => (
          <g key={b.name} data-table={b.name} transform={`translate(${b.x},${b.y})`}>
            <rect width={b.w} height={b.h} rx="8" fill="#ffffff" stroke={uploaded[b.name] ? '#4a3aa7' : '#c3c2b7'} />
            <rect width={b.w} height={HEAD} rx="8" fill={uploaded[b.name] ? '#ede9fe' : '#eef4fd'} />
            <rect y={HEAD - 8} width={b.w} height="8" fill={uploaded[b.name] ? '#ede9fe' : '#eef4fd'} />
            <text x="10" y="17" fontSize="12" fontWeight="700" fill="#0b0b0b" fontFamily="ui-monospace, SF Mono, Menlo, monospace">{b.name}</text>
            {b.shown.map((c, i) => (
              <text
                key={c}
                x="10"
                y={HEAD + i * ROW + 13}
                fontSize="11"
                fill={b.keys.has(c) ? '#1c5cab' : '#52514e'}
                fontWeight={b.keys.has(c) ? 700 : 400}
                fontFamily="ui-monospace, SF Mono, Menlo, monospace"
              >
                {b.keys.has(c) ? '🔑 ' : ''}{c}
              </text>
            ))}
            {b.hidden > 0 && <text x="10" y={HEAD + b.shown.length * ROW + 13} fontSize="10" fill="#898781">+{b.hidden} more columns</text>}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default SchemaDiagram;

// "Schema reference" button: hover to peek at the diagram, click to pin it
// open, Esc or ✕ to close. The popover is rendered into document.body with
// fixed positioning, so no card or scroll area around the button can clip it.
export const SchemaReferenceButton = ({ tables, uploaded }) => {
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const btnRef = React.useRef(null);
  const closeTimer = React.useRef(null);

  const place = React.useCallback(() => {
    const r = btnRef.current && btnRef.current.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(window.innerWidth - 24, 1080);
    const left = Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12));
    const below = window.innerHeight - r.bottom - 20;
    // Open below the button, or above it when there is more room there.
    const up = below < 320 && r.top > below;
    setPos({ left, width, top: up ? null : r.bottom + 8, bottom: up ? window.innerHeight - r.top + 8 : null, maxHeight: Math.max(240, (up ? r.top : window.innerHeight - r.bottom) - 24) });
  }, []);

  const show = () => { clearTimeout(closeTimer.current); place(); setOpen(true); };
  // A short delay lets the pointer travel from the button into the popover.
  const hideSoon = () => { if (!pinned) closeTimer.current = setTimeout(() => setOpen(false), 160); };
  const close = () => { clearTimeout(closeTimer.current); setPinned(false); setOpen(false); };

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setPinned(false); setOpen(false); } };
    const onMove = () => place();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);
  React.useEffect(() => () => clearTimeout(closeTimer.current), []);

  const popover = open && pos && (
    <div
      role="dialog"
      aria-label="Schema reference"
      onMouseEnter={() => clearTimeout(closeTimer.current)}
      onMouseLeave={hideSoon}
      className="fixed z-[60] bg-white border border-black/10 rounded-2xl shadow-lift p-3 flex flex-col"
      style={{ left: pos.left, width: pos.width, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, maxHeight: pos.maxHeight }}
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs text-slate-500">🔑 marks join columns · lines show how tables connect · {pinned ? 'pinned, press Esc to close' : 'click the button to pin'}</span>
        <button type="button" aria-label="Close schema reference" onClick={close} className="text-slate-400 hover:text-slate-700 px-1">✕</button>
      </div>
      <div className="min-h-0 overflow-auto">
        <SchemaDiagram tables={tables} uploaded={uploaded} maxHeight={`${Math.max(200, pos.maxHeight - 60)}px`} />
      </div>
    </div>
  );

  return (
    <span className="inline-flex" onMouseEnter={show} onMouseLeave={hideSoon}>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => { if (pinned) close(); else { setPinned(true); show(); } }}
        onFocus={show}
        className={`inline-flex items-center gap-1.5 rounded-full font-medium px-3 py-1.5 text-xs border transition-colors ${pinned ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-beige-50'}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><path d="M10 6.5h4a2 2 0 0 1 2 2V14" /></svg>
        Schema reference
      </button>
      {popover && createPortal(popover, document.body)}
    </span>
  );
};
