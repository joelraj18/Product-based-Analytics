import React, { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Download, Wand2, Lock, Plus, Trash2, Users, UserPlus, Clock, AlertTriangle } from 'lucide-react';
import { Card, ChartCard, KPICard, PageHeader, Button, Field, Select, TextInput, NumberInput, StatusPill, EmptyState, useToast } from '../components/ui';
import { LineSelect, shortWeek } from '../components/planning';
import { useWorkspace } from '../state/workspace';
import { planToRows } from '../lib/planEngine';
import { productiveHoursPerFTE, DEFAULT_LINE_PARAMS } from '../lib/capacity';
import { lineStatus } from '../lib/planHealth';
import { downloadCSV, today } from '../lib/csv';
import { formatNumber, formatCurrency } from '../lib/format';
import { SERIES, INK, STATUS, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT } from '../lib/theme';

const ASSUMPTIONS = [
  { group: 'Productivity', fields: [
    ['aht', 'AHT', 'sec', 1], ['npt', 'NPT', '%', 0.5], ['shrinkage', 'Shrinkage', '%', 0.5], ['occupancy', 'Occupancy', '%', 1], ['hoursPerWeek', 'Paid hrs / FTE', 'hrs', 0.5],
  ] },
  { group: 'Supply', fields: [
    ['currentHC', 'Current HC', 'FTE', 1], ['attritionMonthly', 'Attrition', '%/mo', 0.1], ['trainingWeeks', 'Training', 'wks', 1], ['rampWeeks', 'Ramp / nesting', 'wks', 1],
    ['rampStart', 'Ramp start productivity', '%', 5], ['tempContractWeeks', 'Temp stay after ramp', 'wks', 1], ['maxOtPct', 'Max OT', '% hrs', 1], ['bufferPct', 'Plan buffer', '%', 0.5],
  ] },
  { group: 'Cost & service', fields: [
    ['costPerHour', 'Loaded cost / hr', '', 1], ['costPerUnit', 'Vendor cost / unit', '', 0.5], ['otMultiplier', 'OT multiplier', '×', 0.05], ['hireCost', 'Cost per hire', '', 100],
    ['slTarget', 'SL target', '%', 1], ['slSeconds', 'SL threshold', 'sec', 1],
  ] },
];

const toWeekMap = (weeks, arr) => Object.fromEntries(weeks.map((w, i) => [w, Number(arr[i]) || 0]));

const CapacityPlanner = () => {
  const { plan, lines, setLines, sites, hiresPlan, setHiresPlan, currency } = useWorkspace();
  const { notify } = useToast();
  const [lineId, setLineId] = useState(lines[0] ? lines[0].id : '');
  const [adding, setAdding] = useState(null);
  const p = plan.plans.find(x => x.line.id === lineId) || plan.plans[0];
  const line = p ? lines.find(l => l.id === p.line.id) : null;

  const rows = useMemo(() => (p ? p.weeks.map((w, i) => ({
    ...p.sim[i],
    week: w,
    volume: p.volumes[i],
    cost: p.costs[i].total,
  })) : []), [p]);

  if (!p || !line) {
    return <Card><EmptyState title="No plan lines">Add a plan line to start capacity planning</EmptyState></Card>;
  }

  const updateLine = (patch) => setLines(lines.map(l => (l.id === line.id ? { ...l, ...patch } : l)));
  const saved = hiresPlan[line.id];

  const setWeekHires = (kind, i, value) => {
    const base = saved || { perm: toWeekMap(p.weeks, p.hires), temp: toWeekMap(p.weeks, p.temps) };
    setHiresPlan({ ...hiresPlan, [line.id]: { ...base, [kind]: { ...base[kind], [p.weeks[i]]: Math.max(0, Math.round(value)) } } });
  };
  const lockPlan = () => {
    setHiresPlan({ ...hiresPlan, [line.id]: { perm: toWeekMap(p.weeks, p.hires), temp: toWeekMap(p.weeks, p.temps) } });
    notify('Hiring plan locked, so it will no longer change when assumptions change');
  };
  const useRecommendation = () => {
    const { [line.id]: _, ...rest } = hiresPlan;
    setHiresPlan(rest);
    notify('Using the recommended hiring plan');
  };

  const addLine = () => {
    const id = adding.id.trim().toUpperCase().replace(/\s+/g, '-');
    if (!id || !adding.name.trim()) { notify('A line needs an id and a name', 'warning'); return; }
    if (lines.some(l => l.id === id)) { notify(`Line \`${id}\` already exists`, 'warning'); return; }
    setLines([...lines, { ...DEFAULT_LINE_PARAMS, id, name: adding.name.trim(), siteId: adding.siteId || (sites[0] && sites[0].id), type: adding.type }]);
    setLineId(id);
    setAdding(null);
    notify(`Added \`${id}\`\nImport its daily volume history in Demand Forecast`, 'info');
  };
  const deleteLine = () => {
    if (!window.confirm(`Delete plan line “${line.name}”?\nIts history stays in the dataset`)) return;
    const remaining = lines.filter(l => l.id !== line.id);
    setLines(remaining);
    const { [line.id]: _, ...rest } = hiresPlan;
    setHiresPlan(rest);
    setLineId(remaining[0] ? remaining[0].id : '');
  };

  const st = lineStatus(p);
  const prodHrs = productiveHoursPerFTE(p.line);
  const lead = p.line.trainingWeeks + p.line.rampWeeks;
  const totalCost = p.costs.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Capacity & Headcount Plan"
        subtitle={'Required FTE = volume × AHT ÷ 3600 ÷ occupancy ÷ (paid hrs × (1 − shrinkage) × (1 − NPT))\nSupply rolls forward with attrition, hiring classes, training and ramp'}
        actions={(
          <>
            <LineSelect lines={lines} value={line.id} onChange={setLineId} />
            <Button variant="secondary" onClick={() => setAdding(adding ? null : { id: '', name: '', siteId: sites[0] ? sites[0].id : '', type: 'realtime' })}><Plus size={16} /> Line</Button>
            <Button variant="success" onClick={() => downloadCSV(planToRows([p]), `hc_plan_${line.id}_${today()}.csv`)}><Download size={16} /> CSV</Button>
          </>
        )}
      />

      {adding && (
        <Card className="p-4 bg-blue-50/50 border-blue-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <Field label="Line id"><TextInput value={adding.id} onChange={v => setAdding({ ...adding, id: v })} placeholder="Like SELLER CHAT" /></Field>
          <Field label="Name" className="md:col-span-2"><TextInput value={adding.name} onChange={v => setAdding({ ...adding, name: v })} placeholder="Seller Support · Chat" /></Field>
          <Field label="Site"><Select value={adding.siteId} onChange={v => setAdding({ ...adding, siteId: v })} options={sites.map(s => ({ value: s.id, label: s.name }))} /></Field>
          <div className="flex gap-2">
            <Select value={adding.type} onChange={v => setAdding({ ...adding, type: v })} options={[{ value: 'realtime', label: 'Real time' }, { value: 'deferred', label: 'Deferred' }]} aria-label="Queue type" />
            <Button onClick={addLine}>Add</Button>
          </div>
        </Card>
      )}

      {p.error ? (
        <Card className="p-6 flex items-center gap-3 text-amber-800 bg-amber-50 border-amber-200"><AlertTriangle size={20} /> <span>{p.error}<br />Import daily history for <code>{line.id}</code> in Demand Forecast</span></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard info="requiredFte" title="Required FTE · peak" value={`${formatNumber(p.sim[0].required, 1)} · ${formatNumber(p.summary.peakRequired, 1)}`} sub="this week · horizon peak" icon={<Users size={20} className="text-blue-600" />} />
            <KPICard info="leadTime" title="Hires: perm + temp" value={`${p.summary.totalHires} + ${p.summary.totalTemps}`} sub={saved ? 'locked plan' : 'recommended plan'} icon={<UserPlus size={20} className="text-violet-600" />} />
            <KPICard info="overtime" title="OT hours" value={formatNumber(p.summary.totalOtHours)} sub={`cap ${p.line.maxOtPct}% of tenured hrs`} icon={<Clock size={20} className="text-amber-600" />} />
            <KPICard info="gap" title="Coverage" value={st.label} status={<StatusPill status={st.status}>{st.status === 'good' ? 'Ready' : st.status === 'warning' ? 'Watch' : 'Action'}</StatusPill>} sub={`${formatNumber(prodHrs, 1)} productive hrs/FTE/wk · lead ${lead} wk`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Required vs supply (FTE)" subtitle="Effective FTE counts trainees at 0 and nesting hires at ramp productivity" height={280}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
                <LineChart data={rows} margin={{ right: 12 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="week" {...AXIS_PROPS} tickFormatter={shortWeek} minTickGap={16} />
                  <YAxis {...AXIS_PROPS} width={44} />
                  <Tooltip {...TOOLTIP_PROPS} labelFormatter={v => `Week of ${v}`} formatter={(v, n) => [formatNumber(v, 1), n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="required" name="Required" stroke={SERIES[0]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="effective" name="Effective" stroke={SERIES[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalHC" name="Paid HC" stroke={SERIES[2]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Over / (under) staffing (FTE)" subtitle="Effective − required, before overtime" height={280}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
                <BarChart data={rows} margin={{ right: 12 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="week" {...AXIS_PROPS} tickFormatter={shortWeek} minTickGap={16} />
                  <YAxis {...AXIS_PROPS} width={44} />
                  <ReferenceLine y={0} stroke={INK.axis} />
                  <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} labelFormatter={v => `Week of ${v}`} formatter={(v) => [formatNumber(v, 1), 'Gap FTE']} />
                  <Bar dataKey="gap" name="Gap FTE" radius={[2, 2, 2, 2]}>
                    {rows.map(r => <Cell key={r.week} fill={r.gap >= 0 ? SERIES[0] : STATUS.critical} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Planning assumptions · {line.name}</h3>
            <p className="text-xs text-slate-500">Edits recalculate the forecast driven plan instantly on every screen</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={line.siteId} onChange={v => updateLine({ siteId: v })} options={sites.map(s => ({ value: s.id, label: s.name }))} className="w-40" aria-label="Site" />
            <Select value={p.line.type} onChange={v => updateLine({ type: v })} options={[{ value: 'realtime', label: 'Real time (Erlang)' }, { value: 'deferred', label: 'Deferred or back office' }]} className="w-48" aria-label="Queue type" />
            <Select value={p.line.costModel} onChange={v => updateLine({ costModel: v })} options={[{ value: 'hourly', label: 'In house (per hour)' }, { value: 'perUnit', label: 'Vendor (per unit)' }]} className="w-48" aria-label="Cost model" />
            <Button variant="danger" size="sm" onClick={deleteLine}><Trash2 size={14} /> Delete line</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {ASSUMPTIONS.map(g => (
            <div key={g.group}>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">{g.group}</div>
              <div className="grid grid-cols-2 gap-3">
                {g.fields.map(([key, label, unit, step]) => (
                  <Field key={key} label={label} hint={key.startsWith('cost') || key === 'hireCost' ? currency : unit}>
                    <NumberInput value={p.line[key]} min={0} step={step} onChange={v => updateLine({ [key]: v })} />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {!p.error && (
        <Card>
          <div className="px-5 py-3 border-b flex flex-wrap justify-between items-center gap-2">
            <div>
              <span className="font-bold text-slate-800">Weekly plan</span>
              <span className="ml-2">{saved ? <StatusPill status="info">Locked hiring plan</StatusPill> : <StatusPill status="good">Recommended hiring</StatusPill>}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={useRecommendation} disabled={!saved}><Wand2 size={12} /> Use recommendation</Button>
              <Button size="sm" variant="secondary" onClick={lockPlan}><Lock size={12} /> Lock current plan</Button>
            </div>
          </div>
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 text-xs uppercase text-slate-600">
                <tr>
                  {['Week', 'Volume', 'Required', 'Tenured', 'Training', 'Nesting', 'Temp HC', 'Paid HC', 'Effective', 'Gap', 'Perm hires', 'Temp hires', 'OT hrs', 'Short FTE', 'Cost'].map(h => (
                    <th key={h} className={`px-3 py-2 border-b whitespace-nowrap ${h === 'Week' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {rows.map((r, i) => (
                  <tr key={r.week} className={r.uncoveredFTE > 1 ? 'bg-rose-50' : r.otHours > 0 ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.week}{i < lead && <span className="ml-1 text-[10px] text-slate-400" title="Inside hiring lead time">LT</span>}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.volume)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{formatNumber(r.required, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.tenured, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.inTraining, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.nesting, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.tempHC, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.totalHC, 1)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.effective, 1)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${r.gap < 0 ? 'text-rose-700' : 'text-slate-700'}`}>{r.gap >= 0 ? '+' : ''}{formatNumber(r.gap, 1)}</td>
                    <td className="px-1 py-1"><NumberInput value={r.hires} min={0} step={1} onChange={v => setWeekHires('perm', i, v)} className="w-16 py-1 text-right" aria-label={`Permanent hires week ${r.week}`} /></td>
                    <td className="px-1 py-1"><NumberInput value={r.temps} min={0} step={1} onChange={v => setWeekHires('temp', i, v)} className="w-16 py-1 text-right" aria-label={`Temp hires week ${r.week}`} /></td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(r.otHours)}</td>
                    <td className="px-3 py-1.5 text-right">{r.uncoveredFTE > 0.05 ? formatNumber(r.uncoveredFTE, 1) : '—'}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(r.cost, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold text-sm">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{formatNumber(rows.reduce((s, r) => s + r.volume, 0))}</td>
                  <td colSpan={8} />
                  <td className="px-3 py-2 text-right">{p.summary.totalHires}</td>
                  <td className="px-3 py-2 text-right">{p.summary.totalTemps}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(p.summary.totalOtHours)}</td>
                  <td />
                  <td className="px-3 py-2 text-right">{formatCurrency(totalCost, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-5 py-2 text-xs text-slate-500 border-t">Rows: red means demand is not covered even with max OT · amber means OT is used · LT means inside the hiring lead time of {lead} weeks</div>
        </Card>
      )}
    </div>
  );
};

export default CapacityPlanner;
