import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { InfoTip, Prose } from './help';

export const Card = ({ children, className = '', ...rest }) => (
  <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-soft ${className}`} {...rest}>
    {children}
  </div>
);

export const Badge = ({ children, type = 'default', className = '' }) => {
  const styles = {
    default: 'bg-beige-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-800',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-rose-50 text-rose-800',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-violet-50 text-violet-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles[type] || styles.default} ${className}`}>
      {children}
    </span>
  );
};

// Status is never color alone: icon + label + color.
const STATUS_META = {
  good: { type: 'success', Icon: CheckCircle },
  warning: { type: 'warning', Icon: AlertTriangle },
  critical: { type: 'danger', Icon: AlertCircle },
  info: { type: 'blue', Icon: Info },
};
export const StatusPill = ({ status = 'info', children }) => {
  const meta = STATUS_META[status] || STATUS_META.info;
  return <Badge type={meta.type}><meta.Icon size={12} aria-hidden="true" />{children}</Badge>;
};

export const PageHeader = ({ title, subtitle, actions, hideTitle = false }) => (
  <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
    <div>
      {/* The shell shows the screen name as the big page title, so only show
          this title when it adds something (for example "Variable Cost Budget vs OP"). */}
      <h2 className={hideTitle ? 'sr-only' : 'text-xl font-semibold tracking-tight text-slate-900'}>{title}</h2>
      {subtitle && <p className="text-[15px] text-slate-500 mt-1 max-w-3xl leading-relaxed"><Prose text={subtitle} /></p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 items-center">{actions}</div>}
  </div>
);

export const KPICard = ({ title, value, sub, delta, deltaUnit = '%', goodWhenUp = true, deltaLabel = 'vs prior', icon, onClick, status, info }) => {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(Number(delta));
  // Round first so a tiny negative never renders as a red "-0.0".
  const shown = hasDelta ? Math.round(Number(delta) * 10) / 10 : 0;
  const up = shown >= 0;
  const good = shown === 0 || up === goodWhenUp;
  return (
    <div className={`relative text-left w-full bg-white rounded-2xl border border-black/[0.06] shadow-soft p-5 flex flex-col justify-between h-full ${onClick ? 'hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200' : ''}`}>
      {onClick && (
        // Stretched button keeps the whole card clickable while the ⓘ tip
        // stays a separate control (buttons can't nest).
        <button type="button" onClick={onClick} aria-label={`${title}: open details`} className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
      )}
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
            <span>{title}</span>
            {info && (typeof info === 'string' ? <InfoTip term={info} /> : info)}
          </p>
          <div className="text-[1.75rem] leading-tight font-semibold tracking-tight text-slate-900 mt-2 truncate">{value}</div>
        </div>
        {icon && <div className="p-2.5 bg-beige-100 rounded-full shrink-0">{icon}</div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs min-h-[20px]">
        {hasDelta && (
          <span className={`${good ? 'text-emerald-800 bg-emerald-50' : 'text-rose-700 bg-rose-50'} px-2 py-0.5 rounded font-bold flex items-center gap-1`}>
            {up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{`${shown > 0 ? '+' : ''}${shown.toFixed(1)}${deltaUnit}`}
          </span>
        )}
        {hasDelta && <span className="text-slate-400">{deltaLabel}</span>}
        {status}
        {sub && <span className="text-slate-500">{sub}</span>}
      </div>
    </div>
  );
};

export const ChartCard = ({ title, subtitle, actions, children, height = 300, className = '' }) => (
  <Card className={`p-5 flex flex-col ${className}`}>
    <div className="flex justify-between items-start gap-3 mb-3">
      <div>
        <h3 className="font-semibold text-lg tracking-tight text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
    <div style={{ height }} className="min-h-0 w-full">{children}</div>
  </Card>
);

export const Field = ({ label, hint, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="text-[13px] font-medium text-slate-600 flex justify-between gap-2">
      <span>{label}</span>{hint && <span className="normal-case font-normal text-slate-400">{hint}</span>}
    </span>
    <div className="mt-1">{children}</div>
  </label>
);

const inputBase = 'px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
// Callers may pass their own width (w-40, w-64…); otherwise fill the parent.
const inputCls = (className = '') => `${/(^|\s)w-/.test(className) ? '' : 'w-full'} ${inputBase} ${className}`;

export const Select = ({ value, onChange, options, placeholder, className = '', ...rest }) => (
  <select className={inputCls(className)} value={value} onChange={e => onChange(e.target.value)} {...rest}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map(o => {
      const opt = typeof o === 'object' ? o : { value: o, label: o };
      return <option key={opt.value} value={opt.value}>{opt.label}</option>;
    })}
  </select>
);

export const TextInput = ({ value, onChange, className = '', ...rest }) => (
  <input className={inputCls(className)} value={value} onChange={e => onChange(e.target.value)} {...rest} />
);

// Keeps a local string so users can type freely; commits a finite number.
export const NumberInput = ({ value, onChange, min, max, step = 'any', className = '', ...rest }) => {
  const [draft, setDraft] = useState(null);
  const commit = (raw) => {
    setDraft(null);
    let v = Number(raw);
    if (raw === '' || !Number.isFinite(v)) return;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
  };
  return (
    <input
      type="number"
      className={inputCls(className)}
      value={draft ?? (Number.isFinite(Number(value)) ? value : '')}
      min={min} max={max} step={step}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw !== '' && Number.isFinite(Number(raw))) onChange(Number(raw));
      }}
      onBlur={e => commit(e.target.value)}
      {...rest}
    />
  );
};

export const Button = ({ variant = 'primary', size = 'md', className = '', children, ...rest }) => {
  const v = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-white border border-slate-300 hover:border-slate-400 hover:bg-beige-50 text-slate-800',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    danger: 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50',
    ghost: 'text-blue-600 hover:bg-blue-50',
    dark: 'bg-slate-900 hover:bg-black text-white',
    // Warm pair for beige surfaces: espresso on cream, no blue.
    warm: 'bg-beige-900 hover:bg-beige-800 text-beige-50',
    warmOutline: 'bg-beige-50/70 border border-beige-400 hover:bg-white hover:border-beige-500 text-beige-900',
  }[variant];
  const s = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-5 py-2 text-sm';
  return (
    <button type="button" className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${className}`} {...rest}>
      {children}
    </button>
  );
};

export const FileButton = ({ accept, onFile, children, variant = 'primary', size = 'md' }) => {
  const v = variant === 'secondary' ? 'bg-white border border-slate-300 hover:border-slate-400 hover:bg-beige-50 text-slate-800' : 'bg-blue-600 hover:bg-blue-700 text-white';
  const s = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-5 py-2 text-sm';
  return (
    <label className={`inline-flex items-center gap-2 rounded-full font-medium cursor-pointer transition-colors ${v} ${s}`}>
      {children}
      <input
        type="file" accept={accept} className="hidden"
        // Reset so choosing the same file again still fires onChange.
        onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f); }}
      />
    </label>
  );
};

export const EmptyState = ({ title = 'Nothing here yet', children, icon }) => (
  <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center text-slate-400 p-6">
    {icon || <Inbox size={40} className="mb-3 opacity-40" />}
    <p className="font-semibold text-slate-500">{title}</p>
    {children && <div className="text-sm mt-1">{children}</div>}
  </div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-black/[0.08] w-full" role="tablist">
    {tabs.map(t => {
      const opt = typeof t === 'object' ? t : { value: t, label: t };
      return (
        <button
          key={opt.value} type="button" role="tab" aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`-mb-px pb-2.5 pt-1 text-[15px] border-b-2 transition-colors ${value === opt.value ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// Sortable table. columns: [{ key, label, format?, align?, render? }]
const formatCount = (n) => n.toLocaleString('en-IN');

// One collator, created once: localeCompare builds a new one per call,
// which takes seconds when sorting 100,000 rows.
export const textCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const compareCells = (x, y) => {
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  const nx = Number(x);
  const ny = Number(y);
  if (x !== '' && y !== '' && x !== null && y !== null && Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
  return textCollator.compare(String(x ?? ''), String(y ?? ''));
};

// Sortable table. Long tables are paged (pageSize rows at a time), so a
// 30,000 row result never puts 30,000 rows in the page.
export const DataTable = ({ columns, rows, maxHeight = 420, emptyText = 'No rows', rowClassName, initialSort, pageSize = 100 }) => {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      const cmp = compareCells(a[key], b[key]);
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  // Back to page 1 when the table changes size or order (callers often
  // build rows inline, so the array itself is new on every render).
  useEffect(() => { setPage(0); }, [rows.length, sort]);
  const visible = rows.length > pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;
  const toggle = (key) => setSort(s => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  if (!rows.length) return <EmptyState title={emptyText} />;
  return (
    <div>
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full text-sm">
        <thead className="bg-beige-50 sticky top-0 z-10">
          <tr>
            {columns.map(c => (
              <th key={c.key} className={`px-3 py-2.5 border-b border-black/[0.06] text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                <button type="button" className="inline-flex items-center gap-1 hover:text-slate-900" onClick={() => toggle(c.key)}>
                  {c.label}
                  {sort && sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((r, i) => (
            <tr key={r.id ?? r.key ?? i} className={`hover:bg-blue-50/50 ${rowClassName ? rowClassName(r) : ''}`}>
              {columns.map(c => (
                <td key={c.key} className={`px-3 py-2 whitespace-nowrap text-slate-700 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {c.render ? c.render(r) : c.format ? c.format(r[c.key], r) : String(r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {pages > 1 && (
      <nav className="flex items-center justify-between gap-3 px-3 py-2 border-t border-black/[0.06] text-xs text-slate-500" aria-label="Table pages">
        <span>Rows {formatCount(current * pageSize + 1)} to {formatCount(Math.min(rows.length, (current + 1) * pageSize))} of {formatCount(rows.length)}</span>
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30"><ChevronLeft size={14} /></button>
          <span className="tabular-nums">Page {current + 1} of {formatCount(pages)}</span>
          <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30"><ChevronRight size={14} /></button>
        </span>
      </nav>
    )}
    </div>
  );
};

// ---------- Toasts (replace blocking alert()) ----------
const ToastContext = createContext({ notify: () => {} });

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]" aria-live="polite">
        {toasts.map(t => {
          const meta = { success: STATUS_META.good, error: STATUS_META.critical, warning: STATUS_META.warning, info: STATUS_META.info }[t.type] || STATUS_META.info;
          const color = { success: 'border-l-emerald-500', error: 'border-l-rose-500', warning: 'border-l-amber-500', info: 'border-l-blue-500' }[t.type] || 'border-l-blue-500';
          return (
            <div key={t.id} role="status" className={`bg-white border border-slate-200 border-l-4 ${color} shadow-lg rounded-lg p-3 flex gap-2 items-start text-sm text-slate-700`}>
              <meta.Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1"><Prose text={t.message} /></div>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
