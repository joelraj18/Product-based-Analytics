import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, ReferenceLine, LabelList,
} from 'recharts';
import { Download, Users, Filter, Activity, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { Card, Button, Tabs, Badge, Select, NumberInput, Field, DataTable, EmptyState, KPICard, ChartCard, StatusPill } from '../components/ui';
import { InfoTip, Prose } from '../components/help';
import { useWorkspace } from '../state/workspace';
import usePersistentState from '../hooks/usePersistentState';
import { seedOrders } from '../data/seed';
import { columnsOf, downloadCSV } from '../lib/csv';
import { monthLabel } from '../lib/dates';
import { formatCurrency, formatCompact, formatNumber } from '../lib/format';
import { SERIES, STATUS, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT, seqColor } from '../lib/theme';
import { normalizeOrders, lastCompleteMonth, addMonths, hasCustomers } from '../lib/product/orders';
import { monthStats, attributeChange, monthlySeries, KPI_DICTIONARY } from '../lib/product/metrics';
import { buildFunnel, funnelBySegment } from '../lib/product/funnel';
import { buildCohorts, repeatStats } from '../lib/product/cohorts';
import { buildRfm } from '../lib/product/rfm';
import { proportionTest, welchTest, sampleSize, srmCheck } from '../lib/product/experiment';
import { detectAnomalies, weeklyTotals, dailyTotals } from '../lib/product/anomaly';

const pct = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${(v * 100).toFixed(d)}%`);
const delta = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

// ───────────── Metric tree ─────────────
const TreeNode = ({ label, value, change, good = true, info, term, strong }) => {
  const up = change !== null && change >= 0;
  const ok = change === null || Math.abs(change) < 0.05 || up === good;
  return (
    <div className={`rounded-2xl px-4 py-3 text-left ${strong ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-black/[0.06] shadow-soft'}`}>
      <div className={`text-xs font-medium flex items-center gap-1 ${strong ? 'text-slate-300' : 'text-slate-500'}`}>{label}{(info || term) && <InfoTip text={info} term={term} label={label} />}</div>
      <div className="text-xl font-semibold tracking-tight mt-0.5">{value}</div>
      {change !== null && (
        <div className={`text-xs mt-0.5 font-medium ${strong ? (ok ? 'text-emerald-300' : 'text-rose-300') : ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {up ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs last month
        </div>
      )}
    </div>
  );
};

const MetricTree = ({ orders, currency }) => {
  const last = lastCompleteMonth(orders);
  const cur = monthStats(orders, last);
  const prev = monthStats(orders, addMonths(last, -1));
  const parts = prev.net ? attributeChange(cur, prev) : [];
  const series = monthlySeries(orders, last, 12);
  const money = (v) => formatCurrency(v, currency);
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
          <h3 className="text-xl font-semibold tracking-tight">North Star and its drivers <span className="text-slate-400">· {monthLabel(last)} vs {monthLabel(addMonths(last, -1))}</span></h3>
          <span className="text-xs text-slate-500">Uses the last complete month, so a partial month never looks like a drop</span>
        </div>
        <div className="max-w-xs mx-auto"><TreeNode strong label="Net revenue · North Star" value={money(cur.net)} change={delta(cur.net, prev.net)} info={'Revenue from orders that were not cancelled or returned\nIt equals the product of the four drivers below'} /></div>
        <p className="text-center text-sm text-slate-500 my-3">= active customers × orders per customer × average order value × keep rate</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TreeNode label="Active customers" value={formatNumber(cur.customers)} change={delta(cur.customers, prev.customers)} />
          <TreeNode label="Orders per customer" value={cur.ordersPerCustomer?.toFixed(2)} change={delta(cur.ordersPerCustomer, prev.ordersPerCustomer)} />
          <TreeNode label="Average order value" value={money(cur.aov)} change={delta(cur.aov, prev.aov)} term="aov" />
          <TreeNode label="Keep rate" value={pct(cur.keepRate)} change={delta(cur.keepRate, prev.keepRate)} info="Share of gross revenue not lost to cancellations or returns" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <TreeNode label="New customers" value={formatNumber(cur.newCustomers)} change={delta(cur.newCustomers, prev.newCustomers)} />
          <TreeNode label="Returning share" value={pct(cur.returningShare)} change={delta(cur.returningShare, prev.returningShare)} />
          <TreeNode label="Cancel rate · guardrail" value={pct(cur.cancelRate)} change={delta(cur.cancelRate, prev.cancelRate)} good={false} />
          <TreeNode label="Return rate · guardrail" value={pct(cur.returnRate)} change={delta(cur.returnRate, prev.returnRate)} good={false} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="What drove the change" subtitle={`Net revenue moved ${money(cur.net - prev.net)}; each bar is one driver’s share, and the bars add up to the total`} height={240}>
          {parts.length ? (
            <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
              <BarChart data={parts.map(p => ({ ...p, value: Math.round(p.contribution) }))} layout="vertical" margin={{ left: 20, right: 70 }}>
                <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
                <XAxis type="number" {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} />
                <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={130} />
                <ReferenceLine x={0} stroke="#a8a39b" />
                <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f4f2ee' }} formatter={(v) => [money(v), 'Contribution']} />
                <Bar dataKey="value" fill={SERIES[0]} radius={4} barSize={18}>
                  <LabelList dataKey="value" position="right" formatter={v => formatCompact(v, currency)} style={{ fontSize: 11, fill: '#4f4d49' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="Not enough history" />}
        </ChartCard>
        <ChartCard title="Net revenue, last 12 months" subtitle="Complete months only" height={240}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <LineChart data={series.map(m => ({ name: monthLabel(m.month), net: Math.round(m.net) }))}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} width={60} />
              <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [money(v), 'Net revenue']} />
              <Line type="monotone" dataKey="net" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-lg font-semibold tracking-tight">KPI dictionary</h3>
          <p className="text-sm text-slate-500">One agreed definition per metric, so every team computes it the same way</p>
        </div>
        <DataTable
          maxHeight={420}
          rows={KPI_DICTIONARY.map(k => {
            const v = cur[k.key];
            const breach = k.limit !== undefined && v > k.limit;
            return { ...k, current: v, previous: prev[k.key], breach };
          })}
          columns={[
            { key: 'name', label: 'Metric', render: r => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: 'role', label: 'Role', render: r => <Badge type={r.role === 'North Star' ? 'blue' : r.role === 'Guardrail' ? 'warning' : 'default'}>{r.role}</Badge> },
            { key: 'definition', label: 'Definition', render: r => <span className="whitespace-normal block min-w-[220px]">{r.definition}</span> },
            { key: 'formula', label: 'Formula', render: r => <code className="text-xs bg-beige-100 px-1.5 py-0.5 rounded">{r.formula}</code> },
            { key: 'current', label: monthLabel(last), align: 'right', render: r => (['net', 'aov'].includes(r.key) ? money(r.current) : ['customers', 'newCustomers'].includes(r.key) ? formatNumber(r.current) : r.key === 'ordersPerCustomer' ? r.current?.toFixed(2) : pct(r.current)) },
            { key: 'status', label: 'Status', render: r => (r.limit === undefined ? <span className="text-slate-400 text-xs">·</span> : r.breach ? <StatusPill status="critical">Above {pct(r.limit, 0)}</StatusPill> : <StatusPill status="good">Within {pct(r.limit, 0)}</StatusPill>) },
          ]}
        />
      </Card>
    </div>
  );
};

// ───────────── Funnel ─────────────
const FunnelView = ({ orders, currency }) => {
  const [maturity, setMaturity] = usePersistentState('pa_funnel_maturity', 14);
  const [segment, setSegment] = usePersistentState('pa_funnel_segment', 'region');
  const steps = buildFunnel(orders, { maturityDays: maturity });
  const fields = columnsOf(orders.slice(0, 50).map(o => o.raw)).filter(c => {
    const n = new Set(orders.map(o => o.raw[c])).size;
    return n > 1 && n <= 12;
  });
  const seg = fields.includes(segment) ? segment : fields[0];
  const bySeg = seg ? funnelBySegment(orders, o => String(o.raw[seg] ?? ''), { maturityDays: maturity }) : [];
  const worst = steps.slice(1).reduce((w, s) => (s.stepRate !== null && (!w || s.stepRate < w.stepRate) ? s : w), null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Maturity window" hint="younger orders are still in flight" className="w-80">
          <Select value={String(maturity)} onChange={v => setMaturity(Number(v))} options={[{ value: '0', label: 'Include every order' }, { value: '7', label: 'Older than 7 days' }, { value: '14', label: 'Older than 14 days' }, { value: '30', label: 'Older than 30 days' }]} />
        </Field>
        {worst && <p className="text-sm text-slate-600 pb-2">Biggest leak: <b>{worst.leak}</b> loses {pct(1 - worst.stepRate)} of orders at the <b>{worst.label}</b> step</p>}
      </div>
      <Card className="p-6">
        <h3 className="text-lg font-semibold tracking-tight mb-4">Order funnel · {formatNumber(steps[0].count)} orders</h3>
        <div className="space-y-3" role="list">
          {steps.map((s, i) => (
            <div key={s.key} role="listitem" className="grid grid-cols-[7rem_1fr_9rem] sm:grid-cols-[9rem_1fr_13rem] items-center gap-3">
              <span className="text-sm font-medium text-slate-700">{s.label}</span>
              <div className="h-9 bg-beige-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full flex items-center justify-end pr-3 text-white text-xs font-semibold transition-all" style={{ width: `${Math.max(4, 100 * (s.overallRate || 0))}%`, background: SERIES[0] }}>
                  {formatNumber(s.count)}
                </div>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {i === 0 ? formatCurrency(s.value, currency) : <>{pct(s.stepRate)} of previous · <span className="text-rose-700">−{formatNumber(s.lost)} {s.leak}</span></>}
              </span>
            </div>
          ))}
        </div>
      </Card>
      {seg && (
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Funnel by segment</h3>
              <p className="text-sm text-slate-500">Step conversion for each value, so a weak segment stands out</p>
            </div>
            <Select aria-label="Segment" value={seg} onChange={setSegment} options={fields} className="w-48" />
          </div>
          <DataTable
            rows={bySeg.map(b => ({ key: b.segment, segment: b.segment, steps: b.steps }))}
            columns={[
              { key: 'segment', label: seg, render: r => <span className="font-medium">{r.segment}</span> },
              ...steps.map((s, i) => ({
                key: s.key, label: i === 0 ? 'Orders' : s.label, align: 'right',
                render: r => {
                  const st = r.steps[i];
                  if (i === 0) return formatNumber(st.count);
                  const overall = steps[i].stepRate;
                  const gap = st.stepRate !== null && overall !== null ? st.stepRate - overall : 0;
                  return <span className={gap < -0.05 ? 'text-rose-700 font-semibold' : ''}>{pct(st.stepRate)}</span>;
                },
              })),
              { key: 'end', label: 'Placed to kept', align: 'right', render: r => <b>{pct(r.steps[4].overallRate)}</b> },
            ]}
          />
          <p className="px-5 py-3 text-xs text-slate-500 border-t">Red marks a step more than 5 points below the overall rate</p>
        </Card>
      )}
    </div>
  );
};

// ───────────── Cohorts ─────────────
const CohortView = ({ orders, currency }) => {
  const [mode, setMode] = usePersistentState('pa_cohort_mode', 'rate');
  const { cohorts, maxOffset, curve } = useMemo(() => buildCohorts(orders), [orders]);
  const rep = repeatStats(orders);
  const cols = Math.min(maxOffset, 12);
  const maxRev = Math.max(1, ...cohorts.flatMap(c => c.values.slice(1).map(v => v.revenuePerCustomer)));
  const m1 = curve[1] ? curve[1].rate : null;
  const m3 = curve[3] ? curve[3].rate : null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Customers" value={formatNumber(rep.customers)} info="cohort" />
        <KPICard title="Repeat purchase rate" value={pct(rep.repeatRate)} sub="ordered 2 or more times" info="retention" />
        <KPICard title="Month 1 retention" value={pct(m1)} sub="ordered again next month" />
        <KPICard title="Month 3 retention" value={pct(m3)} sub={`orders per customer ${rep.ordersPerCustomer?.toFixed(2)}`} />
      </div>
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Monthly cohorts</h3>
            <p className="text-sm text-slate-500">Rows are the month of a customer’s first order; columns are months since then</p>
          </div>
          <Tabs value={mode} onChange={setMode} tabs={[{ value: 'rate', label: 'Retention %' }, { value: 'revenue', label: 'Revenue per customer' }]} />
        </div>
        <div className="overflow-auto px-5 pb-5">
          <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th className="text-left font-medium text-slate-500 pr-3">Cohort</th>
                <th className="text-right font-medium text-slate-500 pr-2">Size</th>
                {Array.from({ length: cols + 1 }, (_, k) => <th key={k} className="font-medium text-slate-500 w-14">M{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {cohorts.map(c => (
                <tr key={c.cohort}>
                  <td className="pr-3 whitespace-nowrap text-slate-700">{monthLabel(c.cohort)}</td>
                  <td className="pr-2 text-right tabular-nums text-slate-500">{c.size}</td>
                  {Array.from({ length: cols + 1 }, (_, k) => {
                    const v = c.values[k];
                    if (!v) return <td key={k} />;
                    const val = mode === 'rate' ? v.rate : v.revenuePerCustomer;
                    const bg = mode === 'rate' ? seqColor(k === 0 ? 1 : v.rate * 2.5, 1) : seqColor(k === 0 ? 0 : v.revenuePerCustomer, maxRev);
                    const dark = mode === 'rate' ? (k === 0 || v.rate > 0.2) : v.revenuePerCustomer / maxRev > 0.45;
                    return (
                      <td key={k} title={`${monthLabel(c.cohort)} · month ${k}: ${v.active} of ${c.size} customers · ${formatCurrency(v.revenue, currency)}`}
                        className={`w-14 h-8 text-center rounded tabular-nums ${dark ? 'text-white' : 'text-slate-800'}`} style={{ background: bg }}>
                        {mode === 'rate' ? pct(val, 0) : formatCompact(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ChartCard title="Average retention curve" subtitle="Size weighted across cohorts old enough to reach each month" height={240}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
          <LineChart data={curve.slice(1, cols + 1).map(p => ({ name: `M${p.offset}`, rate: Math.round(p.rate * 1000) / 10 }))}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} unit="%" width={44} />
            <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${v}%`, 'Customers active']} />
            <Line type="monotone" dataKey="rate" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ───────────── RFM and CLV ─────────────
const CustomersView = ({ orders, currency }) => {
  const [margin, setMargin] = usePersistentState('pa_margin', 30);
  const [life, setLife] = usePersistentState('pa_lifespan', 3);
  const r = useMemo(() => buildRfm(orders, { margin: margin / 100, lifespanYears: life }), [orders, margin, life]);
  const [segFilter, setSegFilter] = useState('');
  const list = segFilter ? r.customers.filter(c => c.segment === segFilter) : r.customers;
  const s = r.summary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Predicted CLV" value={formatCurrency(s.clv, currency)} sub={`AOV × ${s.ordersPerYear.toFixed(1)} orders a year × ${margin}% margin × ${life} yrs`} info="clv" />
        <KPICard title="Net AOV" value={formatCurrency(s.aov, currency)} info="aov" />
        <KPICard title="Top 20% of customers" value={pct(s.top20Share)} sub="of net revenue" />
        <KPICard title="Champions" value={formatNumber((r.segments.find(x => x.name === 'Champions') || {}).customers || 0)} sub="best recency and frequency" info="rfm" />
      </div>
      <Card className="p-5 flex flex-wrap gap-4 items-end">
        <Field label="Gross margin %" className="w-40"><NumberInput value={margin} onChange={setMargin} min={1} max={100} /></Field>
        <Field label="Expected lifespan (years)" className="w-48"><NumberInput value={life} onChange={setLife} min={0.5} max={20} step={0.5} /></Field>
        <p className="text-xs text-slate-500 max-w-md pb-2">CLV here is a simple, explainable estimate<br />A cohort based or probabilistic model would refine it once there is more history</p>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <ChartCard title="Customers by segment" subtitle="Click a bar to list its customers" height={300} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={r.segments.map(x => ({ name: x.name, value: x.customers }))} layout="vertical" margin={{ left: 10, right: 36 }}>
              <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={120} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f4f2ee' }} formatter={(v) => [formatNumber(v), 'Customers']} />
              <Bar dataKey="value" fill={SERIES[0]} radius={4} barSize={16} style={{ cursor: 'pointer' }} onClick={(_, i) => r.segments[i] && setSegFilter(f => (f === r.segments[i].name ? '' : r.segments[i].name))}>
                <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#4f4d49' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card className="lg:col-span-3 overflow-hidden">
          <div className="px-5 pt-5 pb-3"><h3 className="text-lg font-semibold tracking-tight">Segment playbook</h3></div>
          <DataTable
            maxHeight={300}
            rows={r.segments.map(x => ({ ...x, key: x.name }))}
            columns={[
              { key: 'name', label: 'Segment', render: x => <span className="font-medium">{x.name}</span> },
              { key: 'rule', label: 'Rule' },
              { key: 'customers', label: 'Customers', align: 'right' },
              { key: 'spendShare', label: 'Revenue share', align: 'right', format: v => pct(v) },
              { key: 'action', label: 'Action', render: x => <span className="whitespace-normal block min-w-[180px]">{x.action}</span> },
            ]}
          />
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight">Customers {segFilter && <Badge type="blue">{segFilter} <button type="button" aria-label="Clear segment filter" onClick={() => setSegFilter('')}>✕</button></Badge>}</h3>
          <Button size="sm" variant="secondary" onClick={() => downloadCSV(list, 'rfm_customers.csv')}><Download size={12} /> Export CSV</Button>
        </div>
        <DataTable
          maxHeight={420}
          rows={list.map(c => ({ ...c, key: c.customer_id }))}
          columns={[
            { key: 'customer_id', label: 'Customer' },
            { key: 'segment', label: 'Segment' },
            { key: 'rfm', label: 'RFM', align: 'right' },
            { key: 'recency_days', label: 'Days since last', align: 'right' },
            { key: 'orders', label: 'Orders', align: 'right' },
            { key: 'net_spend', label: 'Net spend', align: 'right', format: v => formatCurrency(v, currency) },
            { key: 'clv', label: 'CLV', align: 'right', format: v => formatCurrency(v, currency) },
          ]}
        />
      </Card>
    </div>
  );
};

// ───────────── A/B test ─────────────
const Verdict = ({ ok, children }) => (
  <div className={`flex items-start gap-2 rounded-2xl p-4 text-sm ${ok ? 'bg-emerald-50 text-emerald-900' : 'bg-beige-100 text-slate-800'}`}>
    {ok ? <CheckCircle2 size={18} className="text-emerald-700 shrink-0" aria-hidden="true" /> : <XCircle size={18} className="text-slate-500 shrink-0" aria-hidden="true" />}
    <span><Prose text={children} /></span>
  </div>
);

// Confidence interval drawn against zero, so "does it cross zero" is visible.
const CiBar = ({ lo, hi, est, fmt }) => {
  const span = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(est)) * 1.25 || 1;
  const x = (v) => 50 + (v / span) * 50;
  return (
    <div className="mt-2">
      <div className="relative h-10" role="img" aria-label={`Confidence interval from ${fmt(lo)} to ${fmt(hi)}`}>
        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-300" />
        <div className="absolute top-1 bottom-1 w-px bg-slate-500" style={{ left: `${x(0)}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full" style={{ left: `${x(lo)}%`, width: `${x(hi) - x(lo)}%`, background: SERIES[0], opacity: 0.35 }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full ring-2 ring-white" style={{ left: `${x(est)}%`, background: SERIES[0] }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-500 tabular-nums"><span>{fmt(lo)}</span><span>0</span><span>{fmt(hi)}</span></div>
    </div>
  );
};

const ExperimentView = () => {
  const [ab, setAb] = usePersistentState('pa_ab', { nA: 10000, xA: 1000, nB: 10000, xB: 1100, alpha: 0.05, split: 50 });
  const [cont, setCont] = usePersistentState('pa_ab_cont', { meanA: 820, sdA: 640, nA: 4000, meanB: 851, sdB: 690, nB: 4000 });
  const [plan, setPlan] = usePersistentState('pa_ab_plan', { baseline: 10, mde: 10, alpha: 5, power: 80, daily: 4000 });
  const set = (setter) => (k) => (v) => setter(s => ({ ...s, [k]: v }));
  const a = set(setAb);
  const c = set(setCont);
  const p = set(setPlan);
  const valid = ab.nA > 0 && ab.nB > 0 && ab.xA >= 0 && ab.xB >= 0 && ab.xA <= ab.nA && ab.xB <= ab.nB;
  const r = valid ? proportionTest({ nA: ab.nA, xA: ab.xA, nB: ab.nB, xB: ab.xB, alpha: ab.alpha }) : null;
  const srm = valid ? srmCheck({ nA: ab.nA, nB: ab.nB, splitA: ab.split / 100 }) : null;
  const w = cont.nA > 1 && cont.nB > 1 ? welchTest(cont) : null;
  const n = plan.baseline > 0 && plan.baseline < 100 && plan.mde > 0 ? sampleSize({ baseline: plan.baseline / 100, mde: plan.mde / 100, alpha: plan.alpha / 100, power: plan.power / 100 }) : null;
  const pp = (v) => `${(v * 100).toFixed(2)} pts`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">Conversion test <InfoTip term="pvalue" /></h3>
            <p className="text-sm text-slate-500">Two proportion z test, for metrics like checkout conversion</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Control users"><NumberInput value={ab.nA} onChange={a('nA')} min={1} step={1} /></Field>
            <Field label="Control conversions"><NumberInput value={ab.xA} onChange={a('xA')} min={0} step={1} /></Field>
            <Field label="Variant users"><NumberInput value={ab.nB} onChange={a('nB')} min={1} step={1} /></Field>
            <Field label="Variant conversions"><NumberInput value={ab.xB} onChange={a('xB')} min={0} step={1} /></Field>
            <Field label="Significance level"><Select value={String(ab.alpha)} onChange={v => a('alpha')(Number(v))} options={[{ value: '0.1', label: '10%' }, { value: '0.05', label: '5%' }, { value: '0.01', label: '1%' }]} /></Field>
            <Field label="Planned control share %"><NumberInput value={ab.split} onChange={a('split')} min={1} max={99} /></Field>
          </div>
          {r ? (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-beige-50 p-3"><div className="text-xs text-slate-500">Control</div><div className="text-lg font-semibold">{pct(r.pA, 2)}</div></div>
                <div className="rounded-2xl bg-beige-50 p-3"><div className="text-xs text-slate-500">Variant</div><div className="text-lg font-semibold">{pct(r.pB, 2)}</div></div>
                <div className="rounded-2xl bg-beige-50 p-3"><div className="text-xs text-slate-500">Relative uplift</div><div className="text-lg font-semibold">{r.uplift === null ? '–' : `${r.uplift >= 0 ? '+' : ''}${(r.uplift * 100).toFixed(1)}%`}</div></div>
              </div>
              <div className="text-sm text-slate-600 tabular-nums">z = {r.z.toFixed(3)} · p value = {r.p < 0.0001 ? '< 0.0001' : r.p.toFixed(4)} · {100 * (1 - ab.alpha)}% CI for the difference</div>
              <CiBar lo={r.ci[0]} hi={r.ci[1]} est={r.diff} fmt={pp} />
              <Verdict ok={r.significant && !srm.mismatch}>
                {srm.mismatch
                  ? `Do not trust this result yet\nThe split is ${pct(srm.observedA)} control against a planned ${ab.split}%, a sample ratio mismatch (p ${srm.p < 0.0001 ? '< 0.0001' : srm.p.toFixed(4)}), so check assignment and logging first`
                  : r.significant
                    ? `Significant at ${ab.alpha * 100}%\nThe variant ${r.diff > 0 ? 'beats' : 'is worse than'} control by ${pp(Math.abs(r.diff))}, and the interval does not cross zero`
                    : `Not significant at ${ab.alpha * 100}%\nThe interval crosses zero, so the data cannot rule out no effect; do not ship on this result alone`}
              </Verdict>
            </>
          ) : <EmptyState title="Conversions must be between 0 and users" />}
        </Card>

        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">Sample size planner <InfoTip term="mde" /></h3>
              <p className="text-sm text-slate-500">How many users each arm needs before you start</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Baseline rate %"><NumberInput value={plan.baseline} onChange={p('baseline')} min={0.1} max={99} /></Field>
              <Field label="Relative MDE %"><NumberInput value={plan.mde} onChange={p('mde')} min={0.5} max={500} /></Field>
              <Field label="Daily users"><NumberInput value={plan.daily} onChange={p('daily')} min={1} step={1} /></Field>
              <Field label="Significance %"><NumberInput value={plan.alpha} onChange={p('alpha')} min={0.1} max={20} /></Field>
              <Field label="Power %"><NumberInput value={plan.power} onChange={p('power')} min={50} max={99} /></Field>
            </div>
            {n && (
              <div className="rounded-2xl bg-slate-900 text-white p-4">
                <div className="text-3xl font-semibold tracking-tight">{formatNumber(n)} <span className="text-base font-normal text-slate-300">users per arm</span></div>
                <div className="text-sm text-slate-300 mt-1">{formatNumber(2 * n)} in total · about {Math.ceil((2 * n) / plan.daily)} days at {formatNumber(plan.daily)} users a day · run whole weeks to cover weekday effects</div>
              </div>
            )}
          </Card>
          <Card className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Continuous metric</h3>
              <p className="text-sm text-slate-500">Welch t test, for revenue per user or time on task, from each arm’s mean, standard deviation and size</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Control mean"><NumberInput value={cont.meanA} onChange={c('meanA')} /></Field>
              <Field label="Control SD"><NumberInput value={cont.sdA} onChange={c('sdA')} min={0} /></Field>
              <Field label="Control n"><NumberInput value={cont.nA} onChange={c('nA')} min={2} step={1} /></Field>
              <Field label="Variant mean"><NumberInput value={cont.meanB} onChange={c('meanB')} /></Field>
              <Field label="Variant SD"><NumberInput value={cont.sdB} onChange={c('sdB')} min={0} /></Field>
              <Field label="Variant n"><NumberInput value={cont.nB} onChange={c('nB')} min={2} step={1} /></Field>
            </div>
            {w && (
              <>
                <div className="text-sm text-slate-600 tabular-nums">Difference {w.diff.toFixed(2)} ({w.uplift === null ? '–' : `${(w.uplift * 100).toFixed(1)}%`}) · t = {w.t.toFixed(3)} · df = {w.df.toFixed(0)} · p value = {w.p < 0.0001 ? '< 0.0001' : w.p.toFixed(4)}</div>
                <Verdict ok={w.significant}>{w.significant ? 'Significant at 5%' : 'Not significant at 5%\nHeavy tailed metrics like revenue often need more users, capping outliers or a bootstrap'}</Verdict>
              </>
            )}
          </Card>
        </div>
      </div>
      <Card className="p-5 text-sm text-slate-600 bg-beige-50">
        <h4 className="font-semibold text-slate-900 mb-1">Checklist before you call a test</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fix the sample size and the primary metric before launch, and do not stop early when p dips below the line</li>
          <li>Check sample ratio mismatch first; if the split is off, the result is not trustworthy</li>
          <li>Watch guardrails such as cancel rate and latency, not only the primary metric</li>
          <li>Many metrics or segments raise false positives, so adjust (for example Bonferroni) or treat them as exploratory</li>
          <li>Practical significance matters: a real but tiny lift may not pay for itself</li>
        </ul>
      </Card>
    </div>
  );
};

// ───────────── Anomalies ─────────────
export const AnomalyChart = ({ points, format, height = 260 }) => (
  <ResponsiveContainer width="100%" height={height} initialDimension={CHART_INIT}>
    <ComposedChart data={points.map(p => ({ ...p, band: p.low !== undefined && p.low !== null ? [Math.max(0, p.low), p.high] : null, alert: p.flag ? p.value : null }))}>
      <CartesianGrid {...GRID_PROPS} />
      <XAxis dataKey="key" {...AXIS_PROPS} minTickGap={24} />
      <YAxis {...AXIS_PROPS} tickFormatter={format} width={60} />
      <Tooltip {...TOOLTIP_PROPS} formatter={(v, name) => (name === 'band' ? [`${format(v[0])} to ${format(v[1])}`, 'Expected range'] : [format(v), name === 'alert' ? 'Anomaly' : 'Actual'])} />
      <Area dataKey="band" stroke="none" fill={SERIES[0]} fillOpacity={0.12} isAnimationActive={false} />
      <Line dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
      <Scatter dataKey="alert" fill={STATUS.critical} shape="circle" isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer>
);

const AnomalyView = ({ orders, currency, volumeHistory, lines }) => {
  const [metric, setMetric] = usePersistentState('pa_anom_metric', 'revenue');
  const [threshold, setThreshold] = usePersistentState('pa_anom_threshold', 2.5);
  const [windowN, setWindowN] = usePersistentState('pa_anom_window', 8);
  const lineIds = [...new Set((volumeHistory || []).map(v => v.line_id))];
  const options = [
    { value: 'revenue', label: 'Weekly net revenue' },
    { value: 'orders', label: 'Weekly orders' },
    ...lineIds.map(id => ({ value: `line:${id}`, label: `Daily contacts · ${(lines.find(l => l.id === id) || {}).name || id}` })),
  ];
  const isLine = metric.startsWith('line:');
  const series = metric === 'orders'
    ? weeklyTotals(orders, () => 1)
    : isLine ? dailyTotals(volumeHistory, 'date', 'volume', r => r.line_id === metric.slice(5)).slice(-180)
      : weeklyTotals(orders, o => (o.bucket === 'cancelled' || o.bucket === 'returned' ? 0 : o.amount));
  const points = detectAnomalies(series, { window: isLine ? Math.max(windowN, 14) : windowN, threshold });
  const alerts = points.filter(p => p.flag).reverse();
  const fmt = metric === 'revenue' ? (v) => formatCompact(v, currency) : (v) => formatCompact(v);
  return (
    <div className="space-y-6">
      <Card className="p-5 flex flex-wrap items-end gap-4">
        <Field label="Metric" className="w-72"><Select value={metric} onChange={setMetric} options={options} /></Field>
        <Field label="Threshold (|z|)" className="w-36"><Select value={String(threshold)} onChange={v => setThreshold(Number(v))} options={['2', '2.5', '3']} /></Field>
        <Field label="Baseline window" className="w-40"><Select value={String(windowN)} onChange={v => setWindowN(Number(v))} options={[{ value: '4', label: '4 periods' }, { value: '8', label: '8 periods' }, { value: '12', label: '12 periods' }]} /></Field>
        <p className="text-xs text-slate-500 max-w-sm pb-2">Each point is compared with the mean and spread of the periods before it {isLine ? '(at least 14 days for daily data, so weekdays are covered)' : ''}</p>
      </Card>
      <ChartCard title={options.find(o => o.value === metric)?.label || 'Metric'} subtitle="Shaded band is the expected range; red dots are anomalies" height={280}>
        <AnomalyChart points={points} format={fmt} height="100%" />
      </ChartCard>
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3"><h3 className="text-lg font-semibold tracking-tight">Alerts · {alerts.length}</h3></div>
        {alerts.length ? (
          <DataTable
            rows={alerts.map(p => ({ ...p, key: p.key }))}
            columns={[
              { key: 'key', label: isLine ? 'Day' : 'Week of' },
              { key: 'flag', label: 'Type', render: p => <StatusPill status={p.flag === 'spike' ? 'warning' : 'critical'}>{p.flag === 'spike' ? 'Spike' : 'Drop'}</StatusPill> },
              { key: 'value', label: 'Actual', align: 'right', format: fmt },
              { key: 'mean', label: 'Expected', align: 'right', format: fmt },
              { key: 'z', label: 'z score', align: 'right', format: v => v.toFixed(2) },
            ]}
          />
        ) : <EmptyState title="No anomalies at this threshold" icon={<Activity size={36} className="mb-2 opacity-30" />}>Lower the threshold to see smaller swings</EmptyState>}
      </Card>
    </div>
  );
};

// ───────────── Screen ─────────────
const ProductAnalytics = () => {
  const ws = useWorkspace();
  const { orders: rawOrders, setOrders, dashboardConfig, currency, volumeHistory, lines } = ws;
  const [tab, setTab] = usePersistentState('pa_tab', 'tree');
  const [customerCol, setCustomerCol] = usePersistentState('pa_customer_col', 'customer_id');
  const columns = useMemo(() => columnsOf(rawOrders.slice(0, 200)), [rawOrders]);
  const map = {
    date: dashboardConfig.dateCol || 'date',
    amount: dashboardConfig.valCol || 'amount',
    status: dashboardConfig.statusCol || 'status',
    customer: columns.includes(customerCol) ? customerCol : columns.find(c => /customer|user|buyer|client/i.test(c)) || customerCol,
  };
  const orders = useMemo(() => normalizeOrders(rawOrders, map),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawOrders, map.date, map.amount, map.status, map.customer]);
  const withCustomers = hasCustomers(orders);
  const needsCustomers = ['cohorts', 'customers', 'tree'].includes(tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'tree', label: 'Metric tree' },
          { value: 'funnel', label: 'Funnel' },
          { value: 'cohorts', label: 'Cohorts & retention' },
          { value: 'customers', label: 'RFM & CLV' },
          { value: 'ab', label: 'A/B testing' },
          { value: 'anomalies', label: 'Anomalies' },
        ]} />
      </div>
      {tab !== 'ab' && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Filter size={12} /> {formatNumber(orders.length)} orders</span>
        <span>· customer column</span>
        <Select aria-label="Customer column" value={map.customer} onChange={setCustomerCol} options={columns} className="w-40 !py-1 text-xs" />
        <span>· date, amount and status follow the Sales Dashboard mapping</span>
      </div>}

      {tab !== 'ab' && !orders.length && <EmptyState title="No orders with valid dates">Check the column mapping on the Sales Dashboard</EmptyState>}
      {orders.length > 0 && needsCustomers && !withCustomers ? (
        <Card className="p-8 text-center space-y-3">
          <Users size={36} className="mx-auto text-slate-300" />
          <h3 className="text-lg font-semibold">This view needs a customer column</h3>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">Pick the column that identifies the buyer above, or load the demo orders, which now include <code className="bg-beige-100 px-1 rounded">customer_id</code></p>
          <Button onClick={() => setOrders(seedOrders())}><RotateCcw size={14} /> Load demo orders with customers</Button>
        </Card>
      ) : (
        <>
          {tab === 'tree' && orders.length > 0 && <MetricTree orders={orders} currency={currency} />}
          {tab === 'funnel' && orders.length > 0 && <FunnelView orders={orders} currency={currency} />}
          {tab === 'cohorts' && orders.length > 0 && <CohortView orders={orders} currency={currency} />}
          {tab === 'customers' && orders.length > 0 && <CustomersView orders={orders} currency={currency} />}
          {tab === 'anomalies' && orders.length > 0 && <AnomalyView orders={orders} currency={currency} volumeHistory={volumeHistory} lines={lines} />}
        </>
      )}
      {tab === 'ab' && <ExperimentView />}
    </div>
  );
};

export default ProductAnalytics;
