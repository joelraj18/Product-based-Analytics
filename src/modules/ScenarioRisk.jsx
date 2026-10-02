import React, { useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RotateCcw, Plus, Trash2, Flag } from 'lucide-react';
import { Card, ChartCard, PageHeader, Button, Field, Select, TextInput, NumberInput, StatusPill, DataTable } from '../components/ui';
import { shortWeek } from '../components/planning';
import { useWorkspace } from '../state/workspace';
import usePersistentState from '../hooks/usePersistentState';
import { buildPlan, peakWeeks } from '../lib/planEngine';
import { formatNumber, formatCompact, formatCurrency } from '../lib/format';
import { SERIES, INK, STATUS, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT } from '../lib/theme';

const LEVERS = [
  { key: 'volumePct', label: 'Volume', unit: '%', min: -30, max: 50, step: 1, tornado: 10 },
  { key: 'ahtPct', label: 'AHT', unit: '%', min: -20, max: 30, step: 1, tornado: 10 },
  { key: 'shrinkagePts', label: 'Shrinkage', unit: 'pts', min: -10, max: 15, step: 0.5, tornado: 3 },
  { key: 'attritionPts', label: 'Attrition', unit: 'pts/mo', min: -3, max: 6, step: 0.25, tornado: 1 },
];
const ZERO = { volumePct: 0, ahtPct: 0, shrinkagePts: 0, attritionPts: 0 };
const RISK_STATUSES = ['Open', 'Monitoring', 'Mitigated', 'Closed'];
const DEFAULT_CHECKLIST = [
  { id: 'c1', text: 'Peak forecast signed off with Program and Finance', done: false },
  { id: 'c2', text: 'Seasonal hiring classes scheduled with Talent Acquisition', done: false },
  { id: 'c3', text: 'Training seats and trainers booked for peak classes', done: false },
  { id: 'c4', text: 'Leave blackout / restricted-leave windows published', done: false },
  { id: 'c5', text: 'OT budget and vendor overflow pre-approved', done: false },
  { id: 'c6', text: 'Real-time escalation path and daily stand-up agreed', done: false },
];

const summarize = (pl) => {
  const t = pl.totals;
  return {
    peakReq: Math.max(0, ...t.map(r => r.required)),
    shortWeeks: t.filter(r => r.uncoveredFTE > 1).length,
    shortFteWeeks: t.reduce((s, r) => s + r.uncoveredFTE, 0),
    ot: t.reduce((s, r) => s + r.otHours, 0),
    cost: t.reduce((s, r) => s + r.cost, 0),
    hires: t.reduce((s, r) => s + r.hires, 0),
    temps: t.reduce((s, r) => s + r.temps, 0),
  };
};

const riskLevel = (score) => (score >= 15 ? 'critical' : score >= 8 ? 'warning' : 'good');

const ScenarioRisk = () => {
  const ws = useWorkspace();
  const { plan, lines, volumeHistory, settings, events, scenario, setScenario, risks, setRisks, currency } = ws;
  const [checklist, setChecklist] = usePersistentState('peak_checklist', DEFAULT_CHECKLIST);
  const [newRisk, setNewRisk] = useState({ title: '', lineId: 'all', likelihood: 3, impact: 3, owner: '', mitigation: '' });
  const sc = { ...ZERO, ...scenario };

  // Current hiring plan frozen, so the scenario shows risk to today's plan.
  const frozenHires = useMemo(() => Object.fromEntries(plan.plans.filter(p => p.weeks.length).map(p => [p.line.id, {
    perm: Object.fromEntries(p.weeks.map((w, i) => [w, p.hires[i]])),
    temp: Object.fromEntries(p.weeks.map((w, i) => [w, p.temps[i]])),
  }])), [plan]);

  const base = { lines, history: volumeHistory, settings, events };
  const scenarioPlan = useMemo(() => buildPlan({ ...base, hiresPlan: frozenHires, scenario: sc }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, volumeHistory, settings.horizonWeeks, settings.forecastMethod, events, frozenHires, sc.volumePct, sc.ahtPct, sc.shrinkagePts, sc.attritionPts]);
  const scenarioRecommended = useMemo(() => buildPlan({ ...base, hiresPlan: {}, scenario: sc }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, volumeHistory, settings.horizonWeeks, settings.forecastMethod, events, sc.volumePct, sc.ahtPct, sc.shrinkagePts, sc.attritionPts]);

  const tornado = useMemo(() => {
    const ref = summarize(buildPlan({ ...base, hiresPlan: {} })).cost;
    return LEVERS.map(l => {
      const lo = summarize(buildPlan({ ...base, hiresPlan: {}, scenario: { [l.key]: -l.tornado } })).cost - ref;
      const hi = summarize(buildPlan({ ...base, hiresPlan: {}, scenario: { [l.key]: l.tornado } })).cost - ref;
      return { driver: `${l.label} ±${l.tornado}${l.unit === '%' ? '%' : ` ${l.unit}`}`, low: lo, high: hi, span: Math.abs(hi - lo) };
    }).sort((a, b) => b.span - a.span);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, volumeHistory, settings.horizonWeeks, settings.forecastMethod, events]);

  const b = summarize(plan);
  const s = summarize(scenarioPlan);
  const r = summarize(scenarioRecommended);
  const compare = plan.totals.map((t, i) => ({
    week: t.weekStart,
    baseReq: t.required,
    scenReq: scenarioPlan.totals[i] ? scenarioPlan.totals[i].required : null,
    supply: scenarioPlan.totals[i] ? scenarioPlan.totals[i].effective : null,
  }));

  const peaks = peakWeeks(plan.totals, 4);
  const peakRows = peaks.map(w => {
    const t = scenarioPlan.totals.find(x => x.weekStart === w) || {};
    const status = t.uncoveredFTE > 1 ? 'critical' : t.otHours > 0 ? 'warning' : 'good';
    return { id: w, week: w, volume: t.volume, required: t.required, effective: t.effective, gap: t.gap, ot: t.otHours, short: t.uncoveredFTE, status };
  });

  const addRisk = () => {
    if (!newRisk.title.trim()) return;
    setRisks([...risks, { ...newRisk, title: newRisk.title.trim(), id: `R-${Date.now().toString(36)}`, status: 'Open', due: '' }]);
    setNewRisk({ title: '', lineId: 'all', likelihood: 3, impact: 3, owner: '', mitigation: '' });
  };
  const updateRisk = (id, patch) => setRisks(risks.map(x => (x.id === id ? { ...x, ...patch } : x)));

  const delta = (a, bVal, digits = 0, money = false) => {
    const d = a - bVal;
    if (Math.abs(d) < 1e-9) return <span className="text-slate-400">—</span>;
    return <span className={d > 0 ? 'text-rose-700' : 'text-emerald-800'}>{d > 0 ? '+' : ''}{money ? formatCompact(d, currency) : formatNumber(d, digits)}</span>;
  };

  const matrix = Array.from({ length: 5 }, (_, i) => 5 - i).map(impact => Array.from({ length: 5 }, (_, j) => j + 1).map(lk => risks.filter(x => x.status !== 'Closed' && Number(x.impact) === impact && Number(x.likelihood) === lk)));
  const lineName = Object.fromEntries(lines.map(l => [l.id, l.name]));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Scenarios, Risks & Peak Readiness"
        subtitle="Stress-test the current hiring plan against demand and productivity shocks, see which driver moves cost most, and track mitigations."
        actions={<Button variant="secondary" onClick={() => setScenario(ZERO)}><RotateCcw size={16} /> Reset scenario</Button>}
      />

      <Card className="p-5">
        <h3 className="font-bold text-slate-800 mb-4">What-if levers <span className="text-xs font-normal text-slate-500">(applied to every line; current hiring plan held fixed)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {LEVERS.map(l => (
            <label key={l.key} className="block">
              <div className="flex justify-between text-sm font-semibold text-slate-700">
                <span>{l.label}</span>
                <span className="tabular-nums">{sc[l.key] > 0 ? '+' : ''}{sc[l.key]} {l.unit}</span>
              </div>
              <input type="range" className="w-full mt-2 accent-blue-600" min={l.min} max={l.max} step={l.step} value={sc[l.key]} onChange={e => setScenario({ ...sc, [l.key]: Number(e.target.value) })} aria-label={`${l.label} change`} />
              <div className="flex justify-between text-[10px] text-slate-400"><span>{l.min}</span><span>{l.max}</span></div>
            </label>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="overflow-x-auto xl:col-span-2">
          <div className="px-5 py-3 border-b font-bold text-slate-800">Impact summary</div>
          <table className="w-full text-sm tabular-nums [&_td]:whitespace-nowrap">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr><th className="px-4 py-2 text-left">Metric</th><th className="px-3 py-2 text-right">Baseline</th><th className="px-3 py-2 text-right">Scenario</th><th className="px-3 py-2 text-right">Δ</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="px-4 py-2">Peak required FTE</td><td className="px-3 text-right">{formatNumber(b.peakReq)}</td><td className="px-3 text-right">{formatNumber(s.peakReq)}</td><td className="px-3 text-right">{delta(s.peakReq, b.peakReq)}</td></tr>
              <tr><td className="px-4 py-2">Weeks short after OT</td><td className="px-3 text-right">{b.shortWeeks}</td><td className="px-3 text-right">{s.shortWeeks}</td><td className="px-3 text-right">{delta(s.shortWeeks, b.shortWeeks)}</td></tr>
              <tr><td className="px-4 py-2">Uncovered FTE-weeks</td><td className="px-3 text-right">{formatNumber(b.shortFteWeeks, 1)}</td><td className="px-3 text-right">{formatNumber(s.shortFteWeeks, 1)}</td><td className="px-3 text-right">{delta(s.shortFteWeeks, b.shortFteWeeks, 1)}</td></tr>
              <tr><td className="px-4 py-2">OT hours</td><td className="px-3 text-right">{formatNumber(b.ot)}</td><td className="px-3 text-right">{formatNumber(s.ot)}</td><td className="px-3 text-right">{delta(s.ot, b.ot)}</td></tr>
              <tr><td className="px-4 py-2">Variable cost</td><td className="px-3 text-right">{formatCompact(b.cost, currency)}</td><td className="px-3 text-right">{formatCompact(s.cost, currency)}</td><td className="px-3 text-right">{delta(s.cost, b.cost, 0, true)}</td></tr>
              <tr className="bg-blue-50/50"><td className="px-4 py-2">Hires to cover <span className="text-xs text-slate-500">(perm + temp)</span></td><td className="px-3 text-right">{b.hires} + {b.temps}</td><td className="px-3 text-right">{r.hires} + {r.temps}</td><td className="px-3 text-right">{delta(r.hires + r.temps, b.hires + b.temps)}</td></tr>
              <tr className="bg-blue-50/50"><td className="px-4 py-2">Cost if re-planned</td><td className="px-3 text-right">{formatCompact(b.cost, currency)}</td><td className="px-3 text-right">{formatCompact(r.cost, currency)}</td><td className="px-3 text-right">{delta(r.cost, b.cost, 0, true)}</td></tr>
            </tbody>
          </table>
        </Card>
        <ChartCard title="Required FTE: baseline vs scenario" subtitle="Against effective supply from the current hiring plan" className="xl:col-span-3" height={290}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <LineChart data={compare} margin={{ right: 12 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="week" {...AXIS_PROPS} tickFormatter={shortWeek} minTickGap={16} />
              <YAxis {...AXIS_PROPS} width={48} />
              <Tooltip {...TOOLTIP_PROPS} labelFormatter={v => `Week of ${v}`} formatter={(v, n) => [formatNumber(v, 1), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="baseReq" name="Baseline required" stroke={SERIES[0]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="scenReq" name="Scenario required" stroke={SERIES[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="supply" name="Effective supply" stroke={SERIES[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Cost sensitivity (tornado)" subtitle="Change in horizon variable cost when each driver moves alone, re-planning hires" height={240}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={tornado} layout="vertical" stackOffset="sign" margin={{ left: 20, right: 16 }}>
              <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
              <XAxis type="number" {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} />
              <YAxis type="category" dataKey="driver" {...AXIS_PROPS} width={130} />
              <ReferenceLine x={0} stroke={INK.axis} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v, n) => [formatCurrency(v, currency), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="low" name="Driver down" stackId="t" fill={SERIES[0]} barSize={18} />
              <Bar dataKey="high" name="Driver up" stackId="t" fill={STATUS.critical} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <div className="px-5 py-3 border-b font-bold text-slate-800 flex items-center gap-2"><Flag size={16} /> Peak readiness (under scenario)</div>
          <DataTable
            rows={peakRows}
            columns={[
              { key: 'week', label: 'Peak week' },
              { key: 'volume', label: 'Volume', align: 'right', format: v => formatNumber(v) },
              { key: 'required', label: 'Req FTE', align: 'right', format: v => formatNumber(v, 1) },
              { key: 'effective', label: 'Supply', align: 'right', format: v => formatNumber(v, 1) },
              { key: 'ot', label: 'OT hrs', align: 'right', format: v => formatNumber(v) },
              { key: 'short', label: 'Short FTE', align: 'right', format: v => (v > 0.05 ? formatNumber(v, 1) : '—') },
              { key: 'status', label: 'Status', render: x => <StatusPill status={x.status}>{x.status === 'good' ? 'Ready' : x.status === 'warning' ? 'On OT' : 'Gap'}</StatusPill> },
            ]}
          />
          <div className="p-4 border-t space-y-2">
            <div className="text-xs font-bold uppercase text-slate-500">Readiness checklist · {checklist.filter(c => c.done).length}/{checklist.length}</div>
            {checklist.map(c => (
              <label key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-1" checked={c.done} onChange={() => setChecklist(checklist.map(x => (x.id === c.id ? { ...x, done: !x.done } : x)))} />
                <span className={c.done ? 'line-through text-slate-400' : ''}>{c.text}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-3">Risk heat map <span className="text-xs font-normal text-slate-500">(open risks)</span></h3>
          <div className="flex gap-2">
            <div className="flex flex-col justify-between text-[10px] text-slate-500 py-1"><span>Impact 5</span><span>1</span></div>
            <div className="grid grid-cols-5 gap-1 flex-1">
              {matrix.map((row, i) => row.map((cell, j) => {
                const score = (5 - i) * (j + 1);
                const lvl = riskLevel(score);
                const bg = lvl === 'critical' ? 'bg-rose-100' : lvl === 'warning' ? 'bg-amber-100' : 'bg-emerald-50';
                return (
                  <div key={`${i}-${j}`} title={cell.map(x => x.title).join('\n')} className={`${bg} rounded h-11 flex items-center justify-center text-sm font-bold text-slate-800`}>
                    {cell.length || ''}
                  </div>
                );
              }))}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 text-center mt-1">Likelihood 1 → 5</div>
        </Card>
        <Card className="xl:col-span-2">
          <div className="px-5 py-3 border-b font-bold text-slate-800">Risk register</div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-12 gap-2 items-end bg-slate-50 border-b">
            <Field label="Risk" className="col-span-2 md:col-span-4"><TextInput value={newRisk.title} onChange={v => setNewRisk({ ...newRisk, title: v })} placeholder="What could go wrong?" /></Field>
            <Field label="Line" className="md:col-span-2"><Select value={newRisk.lineId} onChange={v => setNewRisk({ ...newRisk, lineId: v })} options={[{ value: 'all', label: 'All' }, ...lines.map(l => ({ value: l.id, label: l.id }))]} /></Field>
            <Field label="L (1-5)" className="md:col-span-1"><NumberInput value={newRisk.likelihood} min={1} max={5} step={1} onChange={v => setNewRisk({ ...newRisk, likelihood: Math.round(v) })} /></Field>
            <Field label="I (1-5)" className="md:col-span-1"><NumberInput value={newRisk.impact} min={1} max={5} step={1} onChange={v => setNewRisk({ ...newRisk, impact: Math.round(v) })} /></Field>
            <Field label="Owner" className="md:col-span-2"><TextInput value={newRisk.owner} onChange={v => setNewRisk({ ...newRisk, owner: v })} /></Field>
            <div className="md:col-span-2 col-span-2"><Button onClick={addRisk} className="w-full" disabled={!newRisk.title.trim()}><Plus size={14} /> Add</Button></div>
            <Field label="Mitigation" className="col-span-2 md:col-span-12"><TextInput value={newRisk.mitigation} onChange={v => setNewRisk({ ...newRisk, mitigation: v })} placeholder="Mitigation plan" /></Field>
          </div>
          <DataTable
            maxHeight={360}
            rows={risks.map(x => ({ ...x, score: x.likelihood * x.impact }))}
            initialSort={{ key: 'score', dir: 'desc' }}
            columns={[
              { key: 'title', label: 'Risk', render: x => <div className="whitespace-normal min-w-[200px]"><div className="font-medium">{x.title}</div><div className="text-xs text-slate-500">{x.mitigation}</div></div> },
              { key: 'lineId', label: 'Line', format: v => (v === 'all' ? 'All' : lineName[v] || v) },
              { key: 'score', label: 'Score', align: 'right', render: x => <StatusPill status={riskLevel(x.score)}>{x.score}</StatusPill> },
              { key: 'owner', label: 'Owner' },
              { key: 'status', label: 'Status', render: x => <Select value={x.status} onChange={v => updateRisk(x.id, { status: v })} options={RISK_STATUSES} className="py-1 text-xs w-32" aria-label="Risk status" /> },
              { key: 'del', label: '', render: x => <button type="button" aria-label="Delete risk" onClick={() => setRisks(risks.filter(y => y.id !== x.id))} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default ScenarioRisk;
