import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Settings, ArrowLeft, Banknote, CheckCircle, Clock, Package, Download } from 'lucide-react';
import { Card, KPICard, ChartCard, Field, Select, Button, DataTable, EmptyState, PageHeader } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { columnsOf, downloadCSV } from '../lib/csv';
import { toNumber, pctChange, sum } from '../lib/stats';
import { parseDate, monthKey, monthLabel } from '../lib/dates';
import { formatCurrency, formatCompact, formatNumber } from '../lib/format';
import { SERIES, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, clickedRow, CHART_INIT } from '../lib/theme';

const isDone = (v) => /ship|deliver|done|complete/i.test(String(v ?? ''));
const isPending = (v) => /pending|open|process/i.test(String(v ?? ''));

const ConfigPanel = ({ columns, config, setConfig }) => (
  <Card className="mb-6 p-4 border-blue-200 bg-blue-50/50">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {[['dateCol', 'Date column'], ['valCol', 'Value column'], ['statusCol', 'Status column'], ['catCol', 'Category column']].map(([key, label]) => (
        <Field key={key} label={label}>
          <Select value={config[key]} onChange={v => setConfig({ ...config, [key]: v })} options={columns} placeholder="— none —" />
        </Field>
      ))}
    </div>
  </Card>
);

const Dashboard = () => {
  const { orders: data, dashboardConfig: config, setDashboardConfig: setConfig, currency } = useWorkspace();
  const [drillDown, setDrillDown] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [showConfig, setShowConfig] = useState(false);
  const columns = useMemo(() => columnsOf(data), [data]);
  const val = (r) => { const n = toNumber(r[config.valCol]); return Number.isFinite(n) ? n : 0; };

  const processed = useMemo(() => data.map(row => {
    const d = parseDate(row[config.dateCol]);
    return { ...row, _month: d ? monthKey(d) : 'Unknown' };
  }), [data, config.dateCol]);

  const months = useMemo(() => [...new Set(processed.map(d => d._month))].filter(m => m !== 'Unknown').sort(), [processed]);
  const month = selectedMonth !== 'All' && !months.includes(selectedMonth) ? 'All' : selectedMonth;
  const filtered = useMemo(() => (month === 'All' ? processed : processed.filter(d => d._month === month)), [processed, month]);

  const trend = useMemo(() => {
    const agg = {};
    processed.forEach(d => {
      if (d._month === 'Unknown') return;
      const m = agg[d._month] || (agg[d._month] = { key: d._month, name: monthLabel(d._month), value: 0, orders: 0 });
      m.value += val(d);
      m.orders += 1;
    });
    return Object.values(agg).sort((a, b) => a.key.localeCompare(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processed, config.valCol]);

  const statusDist = useMemo(() => {
    const counts = {};
    filtered.forEach(r => { const k = String(r[config.statusCol] ?? '').trim() || '(blank)'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered, config.statusCol]);

  const byCategory = useMemo(() => {
    if (!config.catCol) return [];
    const agg = {};
    filtered.forEach(r => { const k = String(r[config.catCol] ?? '').trim() || '(blank)'; agg[k] = (agg[k] || 0) + val(r); });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, config.catCol, config.valCol]);

  const metrics = useMemo(() => {
    const slice = (m) => processed.filter(d => d._month === m);
    const calc = (rows) => ({
      rev: sum(rows.map(val)),
      done: rows.filter(r => isDone(r[config.statusCol])).length,
      pending: rows.filter(r => isPending(r[config.statusCol])).length,
      count: rows.length,
    });
    const cur = calc(filtered);
    const base = month === 'All' ? months[months.length - 1] : month;
    const prevMonth = months[months.indexOf(base) - 1];
    let growth = {};
    if (base && prevMonth) {
      const a = calc(slice(base));
      const b = calc(slice(prevMonth));
      growth = { rev: pctChange(a.rev, b.rev), done: pctChange(a.done, b.done), pending: pctChange(a.pending, b.pending), aov: pctChange(a.count ? a.rev / a.count : 0, b.count ? b.rev / b.count : 0) };
    }
    return { ...cur, aov: cur.count ? cur.rev / cur.count : 0, growth, compare: base && prevMonth ? `${monthLabel(base)} vs ${monthLabel(prevMonth)}` : 'no prior month' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, processed, months, month, config.statusCol, config.valCol]);

  if (!data.length) {
    return <Card><EmptyState title="No data loaded">Import a CSV in Data Grid to populate the dashboard.</EmptyState></Card>;
  }

  if (drillDown) {
    let rows = filtered;
    let title = 'All records';
    if (drillDown === 'revenue') { rows = [...filtered].sort((a, b) => val(b) - val(a)); title = 'Records by value'; }
    if (drillDown === 'done') { rows = filtered.filter(r => isDone(r[config.statusCol])); title = 'Shipped / delivered'; }
    if (drillDown === 'pending') { rows = filtered.filter(r => isPending(r[config.statusCol])); title = 'Pending'; }
    if (drillDown === 'top') { rows = [...filtered].sort((a, b) => val(b) - val(a)).slice(0, 50); title = 'Top 50 by value'; }
    if (drillDown.startsWith('month:')) { const m = drillDown.slice(6); rows = processed.filter(r => r._month === m); title = monthLabel(m); }
    if (drillDown.startsWith('cat:')) { const c = drillDown.slice(4); rows = filtered.filter(r => (String(r[config.catCol] ?? '').trim() || '(blank)') === c); title = `${config.catCol}: ${c}`; }
    if (drillDown.startsWith('status:')) { const s = drillDown.slice(7); rows = filtered.filter(r => (String(r[config.statusCol] ?? '').trim() || '(blank)') === s); title = `${config.statusCol}: ${s}`; }
    const clean = rows.map(({ _month, ...r }) => r);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <Button variant="dark" onClick={() => setDrillDown(null)}><ArrowLeft size={16} /> Back to dashboard</Button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-500">{title} · {rows.length} records</span>
            <Button variant="secondary" size="sm" onClick={() => downloadCSV(clean, `drilldown_${drillDown.replace(/[^a-z0-9]+/gi, '_')}.csv`, columns)}><Download size={14} /> CSV</Button>
          </div>
        </div>
        <Card className="border-t-4 border-t-blue-500">
          <DataTable columns={columns.map(c => ({ key: c, label: c }))} rows={clean} maxHeight="70vh" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Sales & Fulfilment Overview"
        subtitle="Works on any order-level dataset — map your columns with the gear icon. Click a tile, bar or month to drill into records."
        actions={(
          <>
            <Select value={month} onChange={setSelectedMonth} options={[{ value: 'All', label: 'All months' }, ...months.map(m => ({ value: m, label: monthLabel(m) }))]} className="w-40" aria-label="Month filter" />
            <Button variant="secondary" onClick={() => setShowConfig(s => !s)} aria-label="Configure columns" aria-expanded={showConfig}><Settings size={16} /></Button>
          </>
        )}
      />
      {showConfig && <ConfigPanel columns={columns} config={config} setConfig={setConfig} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total value" value={formatCurrency(metrics.rev, currency)} delta={metrics.growth.rev} deltaLabel={metrics.compare} icon={<Banknote className="text-emerald-600" size={20} />} onClick={() => setDrillDown('revenue')} />
        <KPICard title="Shipped / delivered" value={formatNumber(metrics.done)} delta={metrics.growth.done} deltaLabel={metrics.compare} icon={<CheckCircle className="text-blue-600" size={20} />} onClick={() => setDrillDown('done')} />
        <KPICard title="Pending" value={formatNumber(metrics.pending)} delta={metrics.growth.pending} goodWhenUp={false} deltaLabel={metrics.compare} icon={<Clock className="text-amber-600" size={20} />} onClick={() => setDrillDown('pending')} />
        <KPICard title="Avg order value" value={formatCurrency(metrics.aov, currency)} delta={metrics.growth.aov} deltaLabel={metrics.compare} sub="click: top 50" icon={<Package className="text-indigo-600" size={20} />} onClick={() => setDrillDown('top')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Value trend by month" subtitle="All months; click a point to drill in" className="lg:col-span-2">
          {trend.length ? (
            <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
              <AreaChart data={trend} onClick={(e) => { const row = clickedRow(e, trend); if (row) setDrillDown(`month:${row.key}`); }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SERIES[0]} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={SERIES[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="name" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} width={60} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [formatCurrency(v, currency), 'Value']} />
                <Area type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} fill="url(#colorRev)" activeDot={{ r: 5 }} style={{ cursor: 'pointer' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No valid dates">Check the date column mapping.</EmptyState>}
        </ChartCard>
        <ChartCard title="Status distribution" subtitle={month === 'All' ? 'All months' : monthLabel(month)}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={statusDist} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={80} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v) => [formatNumber(v), 'Records']} />
              <Bar dataKey="value" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={16} style={{ cursor: 'pointer' }} onClick={(_, i) => statusDist[i] && setDrillDown(`status:${statusDist[i].name}`)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {config.catCol && (
        <ChartCard title={`Value by ${config.catCol}`} subtitle="Top 10; click a bar to drill in" height={260}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={byCategory}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} width={60} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v) => [formatCurrency(v, currency), 'Value']} />
              <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={48} style={{ cursor: 'pointer' }} onClick={(_, i) => byCategory[i] && setDrillDown(`cat:${byCategory[i].name}`)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
};

export default Dashboard;
