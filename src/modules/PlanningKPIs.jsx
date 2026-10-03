import React, { useMemo, useState } from 'react';
import { ComposedChart, LineChart, Line, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Download, FileDown, ClipboardCopy, Plus, Target, Activity, Users, Gauge } from 'lucide-react';
import { Card, ChartCard, KPICard, PageHeader, Button, Field, Select, NumberInput, DataTable, StatusPill, Tabs, useToast } from '../components/ui';
import { LineSelect } from '../components/planning';
import { useWorkspace } from '../state/workspace';
import { rollupByPeriod, kpiRollup, pareto } from '../lib/kpis';
import { downloadCSV, downloadFile, today } from '../lib/csv';
import SchemaImportButton from '../components/SchemaImportButton';
import { formatNumber, formatCompact, formatCurrency } from '../lib/format';
import { monthLabel } from '../lib/dates';
import { DEFECT_CATEGORIES } from '../data/seed';
import { SERIES, INK, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT } from '../lib/theme';

const ACTUAL_COLUMNS = ['week_start', 'line_id', 'forecast_volume', 'actual_volume', 'planned_aht', 'actual_aht', 'planned_hc', 'actual_hc', 'planned_shrinkage', 'actual_shrinkage', 'sl_target', 'sl_actual', 'occupancy', 'cost_planned', 'cost_actual'];
const pct = (v, d = 1) => (Number.isFinite(v) ? `${v.toFixed(d)}%` : '—');
const signedPct = (v, d = 1) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}%` : '—');
const signedPts = (v, d = 1) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)} pts` : '—');

const PlanningKPIs = () => {
  const { actuals, defects, setDefects, lines, currency } = useWorkspace();
  const { notify } = useToast();
  const [lineId, setLineId] = useState('all');
  const [period, setPeriod] = useState('weekly');
  const [range, setRange] = useState('13');
  const [newDefect, setNewDefect] = useState({ category: DEFECT_CATEGORIES[0], line_id: lines[0] ? lines[0].id : '', impact_fte: 1, note: '' });

  const weeks = useMemo(() => [...new Set(actuals.map(a => a.week_start))].sort(), [actuals]);
  const inRange = useMemo(() => {
    const keep = new Set(range === 'all' ? weeks : weeks.slice(-Number(range)));
    return actuals.filter(a => keep.has(a.week_start) && (lineId === 'all' || a.line_id === lineId));
  }, [actuals, weeks, range, lineId]);

  const series = useMemo(() => rollupByPeriod(inRange, period).map(r => ({ ...r, label: period === 'monthly' ? monthLabel(r.period) : r.period.slice(5) })), [inRange, period]);
  const overall = useMemo(() => kpiRollup(inRange), [inRange]);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const d = (k) => (last && prev && Number.isFinite(last[k]) && Number.isFinite(prev[k]) ? last[k] - prev[k] : null);

  const firstWeek = inRange.length ? inRange.map(a => a.week_start).sort()[0] : '';
  const scopedDefects = defects.filter(x => (lineId === 'all' || x.line_id === lineId) && (!firstWeek || x.date >= firstWeek));
  const paretoRows = pareto(scopedDefects);

  const wbr = () => {
    const lines_ = [
      `# Weekly planning review, ${today()}`,
      `Scope: ${lineId === 'all' ? 'all plan lines' : lineId} · last ${range === 'all' ? 'all' : range} weeks`,
      '',
      '## Headline KPIs',
      `• Forecast accuracy: WAPE ${pct(overall.wape)}, bias ${signedPct(overall.bias)}${last ? ` (latest ${period === 'monthly' ? 'month' : 'week'}: WAPE ${pct(last.wape)})` : ''}`,
      `• Service level: ${pct(overall.sl)} vs target ${pct(overall.slTarget)}, and ${pct(overall.slAttainment, 0)} of line weeks met target`,
      `• Occupancy ${pct(overall.occupancy)}, shrinkage ${signedPts(overall.shrinkVar)} vs plan, AHT ${signedPct(overall.ahtVar)} vs plan`,
      `• HC plan adherence ${pct(overall.hcAdherence)}, cost ${signedPct(overall.costVar)} vs plan (${formatCurrency(overall.costActual, currency)})`,
      '',
      '## Top defect drivers',
      ...paretoRows.slice(0, 3).map(p => `• ${p.category}: ${p.count} (${pct(p.pct, 0)}, cumulative ${pct(p.cumPct, 0)})`),
      '',
      '## Lines missing SL target in latest week',
      ...(() => {
        const lw = weeks[weeks.length - 1];
        const miss = actuals.filter(a => a.week_start === lw && Number(a.sl_actual) < Number(a.sl_target));
        return miss.length ? miss.map(m => `• ${m.line_id}: SL ${m.sl_actual}% vs ${m.sl_target}% (HC ${m.actual_hc} of ${m.planned_hc})`) : ['• None'];
      })(),
    ];
    const text = lines_.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    downloadFile(text, `planning_review_${today()}.md`, 'text/markdown');
    notify('Weekly review summary copied to the clipboard and downloaded');
  };

  const addDefect = () => {
    setDefects([{ ...newDefect, id: `DEF-${Date.now().toString(36).toUpperCase()}`, date: today(), status: 'Open' }, ...defects]);
    notify('Defect logged');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Planning KPIs"
        subtitle="Weekly and monthly planning performance: forecast accuracy, service level, productivity drift, plan adherence and cost, with root cause tracking"
        actions={(
          <>
            <LineSelect lines={lines} value={lineId} onChange={setLineId} allowAll className="w-56" />
            <Select value={range} onChange={setRange} className="w-36" aria-label="Range" options={[{ value: '8', label: 'Last 8 wks' }, { value: '13', label: 'Last 13 wks' }, { value: '26', label: 'Last 26 wks' }, { value: 'all', label: 'All' }]} />
            <Tabs tabs={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]} value={period} onChange={setPeriod} />
          </>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard info="wape" title="Forecast WAPE" value={pct(overall.wape)} delta={d('wape')} goodWhenUp={false} deltaUnit=" pts" deltaLabel="vs prior" sub={`bias ${signedPct(overall.bias)}`} icon={<Target size={20} className="text-blue-600" />} />
        <KPICard info="serviceLevel" title="Service level" value={pct(overall.sl)} delta={d('sl')} deltaUnit=" pts" deltaLabel="vs prior" status={<StatusPill status={overall.sl >= overall.slTarget ? 'good' : 'warning'}>{pct(overall.slAttainment, 0)} weeks met</StatusPill>} icon={<Activity size={20} className="text-emerald-600" />} />
        <KPICard info="adherence" title="HC plan adherence" value={pct(overall.hcAdherence)} delta={d('hcAdherence')} deltaUnit=" pts" deltaLabel="vs prior" sub={`occupancy ${pct(overall.occupancy)}`} icon={<Users size={20} className="text-violet-600" />} />
        <KPICard info="aht" title="Productivity drift" value={`AHT ${signedPct(overall.ahtVar)}`} sub={`shrinkage ${signedPts(overall.shrinkVar)} · cost ${signedPct(overall.costVar)}`} icon={<Gauge size={20} className="text-amber-600" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Forecast vs actual volume" height={280}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <ComposedChart data={series}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={12} />
              <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v)} width={52} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v, n) => [formatNumber(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actual" name="Actual" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Service level vs target" subtitle="Weighted by volume across lines" height={280}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <LineChart data={series}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} minTickGap={12} />
              <YAxis {...AXIS_PROPS} domain={['dataMin - 5', 100]} tickFormatter={v => `${Math.round(v)}%`} width={44} />
              <Tooltip {...TOOLTIP_PROPS} formatter={(v, n) => [pct(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="slTarget" name="Target" stroke={INK.muted} strokeDasharray="5 4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sl" name="Actual SL" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <div className="px-5 py-3 border-b flex flex-wrap justify-between items-center gap-2">
          <span className="font-bold text-slate-800">{period === 'monthly' ? 'Monthly' : 'Weekly'} KPI report</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="dark" onClick={wbr}><ClipboardCopy size={12} /> Generate review summary</Button>
            <Button size="sm" variant="success" onClick={() => downloadCSV(series.map(({ label, ...r }) => r), `planning_kpis_${period}_${today()}.csv`)}><Download size={12} /> KPI CSV</Button>
            <SchemaImportButton size="sm" schemaId="actuals">Import actuals</SchemaImportButton>
            <Button size="sm" variant="secondary" onClick={() => downloadCSV(actuals.slice(-4), 'actuals_template.csv', ACTUAL_COLUMNS)}><FileDown size={12} /> Template</Button>
          </div>
        </div>
        <DataTable
          rows={series.map(r => ({ ...r, id: r.period }))}
          initialSort={{ key: 'period', dir: 'desc' }}
          columns={[
            { key: 'period', label: period === 'monthly' ? 'Month' : 'Week', format: v => (period === 'monthly' ? monthLabel(v) : v) },
            { key: 'actual', label: 'Actual vol', align: 'right', format: v => formatNumber(v) },
            { key: 'wape', label: 'WAPE', align: 'right', render: r => <span className={r.wape > 10 ? 'text-rose-700 font-semibold' : ''}>{pct(r.wape)}</span> },
            { key: 'bias', label: 'Bias', align: 'right', format: v => signedPct(v) },
            { key: 'sl', label: 'SL', align: 'right', render: r => <span className={r.sl < r.slTarget ? 'text-rose-700 font-semibold' : ''}>{pct(r.sl)}</span> },
            { key: 'slAttainment', label: 'Weeks met', align: 'right', format: v => pct(v, 0) },
            { key: 'occupancy', label: 'Occ.', align: 'right', format: v => pct(v) },
            { key: 'ahtVar', label: 'AHT vs plan', align: 'right', format: v => signedPct(v) },
            { key: 'shrinkVar', label: 'Shrinkage Δ', align: 'right', format: v => signedPts(v) },
            { key: 'hcAdherence', label: 'HC adherence', align: 'right', format: v => pct(v) },
            { key: 'costVar', label: 'Cost vs plan', align: 'right', format: v => signedPct(v) },
            { key: 'cpc', label: 'Cost/contact', align: 'right', format: v => (Number.isFinite(v) ? formatCurrency(v, currency, { maximumFractionDigits: 2 }) : '—') },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Defect Pareto: root causes" subtitle={`${scopedDefects.length} planning defects in range; fix the top drivers first`} height={300}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={paretoRows} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="category" {...AXIS_PROPS} width={150} />
              <ReferenceLine x={0} stroke={INK.axis} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v, n, item) => [`${v} (${pct(item.payload.pct, 0)}; cumulative ${pct(item.payload.cumPct, 0)})`, 'Defects']} />
              <Bar dataKey="count" name="Defects" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: INK.secondary, formatter: v => v }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card>
          <div className="px-5 py-3 border-b font-bold text-slate-800">Defect log</div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-end bg-slate-50 border-b">
            <Field label="Root cause" className="col-span-2"><Select value={newDefect.category} onChange={v => setNewDefect({ ...newDefect, category: v })} options={DEFECT_CATEGORIES} /></Field>
            <Field label="Line" className="col-span-2 md:col-span-2"><Select value={newDefect.line_id} onChange={v => setNewDefect({ ...newDefect, line_id: v })} options={lines.map(l => ({ value: l.id, label: l.id }))} /></Field>
            <Field label="FTE impact"><NumberInput value={newDefect.impact_fte} min={0} onChange={v => setNewDefect({ ...newDefect, impact_fte: v })} /></Field>
            <Button onClick={addDefect}><Plus size={14} /> Log</Button>
          </div>
          <DataTable
            maxHeight={300}
            rows={scopedDefects}
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'line_id', label: 'Line' },
              { key: 'category', label: 'Root cause' },
              { key: 'impact_fte', label: 'FTE', align: 'right' },
              { key: 'status', label: 'Status', render: x => <Select value={x.status} onChange={v => setDefects(defects.map(y => (y.id === x.id ? { ...y, status: v } : y)))} options={['Open', 'Mitigated', 'Root cause fixed']} className="py-1 text-xs w-40" aria-label="Defect status" /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default PlanningKPIs;
