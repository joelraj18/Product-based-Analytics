import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calculator, Clock, Gauge, Users } from 'lucide-react';
import { Card, ChartCard, KPICard, PageHeader, Field, NumberInput, Select, StatusPill, EmptyState } from '../components/ui';
import { LineSelect } from '../components/planning';
import { useWorkspace } from '../state/workspace';
import { requiredAgents, serviceLevel, averageSpeedOfAnswer } from '../lib/erlang';
import { intradayProfile, DOW_SHARE } from '../data/seed';
import { DOW } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { SERIES, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, SEQ_BLUE, seqColor, CHART_INIT } from '../lib/theme';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const ErlangCalculator = () => {
  const [c, setC] = useState({ volume: 100, aht: 180, minutes: 30, sl: 80, threshold: 20, agents: 14 });
  const interval = c.minutes * 60;
  const req = requiredAgents({ volume: c.volume, aht: c.aht, interval, slTarget: c.sl / 100, slSeconds: c.threshold, maxOccupancy: 1 });
  const sl = serviceLevel(c.agents, c.volume, c.aht, c.threshold, interval);
  const asa = averageSpeedOfAnswer(c.agents, c.volume, c.aht, interval);
  const occ = (c.volume * c.aht) / interval / Math.max(1, c.agents);
  return (
    <Card className="p-5">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><Calculator size={16} /> Erlang C calculator</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Contacts / interval"><NumberInput value={c.volume} min={0} onChange={v => setC({ ...c, volume: v })} /></Field>
        <Field label="AHT" hint="sec"><NumberInput value={c.aht} min={1} onChange={v => setC({ ...c, aht: v })} /></Field>
        <Field label="Interval" hint="min"><NumberInput value={c.minutes} min={1} onChange={v => setC({ ...c, minutes: v })} /></Field>
        <Field label="SL target" hint="%"><NumberInput value={c.sl} min={1} max={99.9} onChange={v => setC({ ...c, sl: v })} /></Field>
        <Field label="Answer within" hint="sec"><NumberInput value={c.threshold} min={0} onChange={v => setC({ ...c, threshold: v })} /></Field>
        <Field label="Agents to test"><NumberInput value={c.agents} min={1} step={1} onChange={v => setC({ ...c, agents: Math.round(v) })} /></Field>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="text-xs text-blue-800 font-semibold uppercase">Required for target</div>
          <div className="text-xl font-bold text-slate-900">{req.agents} agents</div>
          <div className="text-xs text-slate-600">SL {(req.serviceLevel * 100).toFixed(1)}% · occupancy {(req.occupancy * 100).toFixed(0)}% · traffic {req.intensity.toFixed(2)} Erl</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border">
          <div className="text-xs text-slate-600 font-semibold uppercase">With {c.agents} agents</div>
          <div className="text-xl font-bold text-slate-900">SL {(sl * 100).toFixed(1)}%</div>
          <div className="text-xs text-slate-600">ASA {Number.isFinite(asa) ? `${asa.toFixed(0)} s` : '∞ (understaffed)'} · occupancy {Math.min(100, occ * 100).toFixed(0)}%</div>
        </div>
      </div>
    </Card>
  );
};

const IntradayStaffing = () => {
  const { plan, lines } = useWorkspace();
  const [lineId, setLineId] = useState(lines[0] ? lines[0].id : '');
  const [weekIdx, setWeekIdx] = useState(0);
  const p = plan.plans.find(x => x.line.id === lineId) || plan.plans[0];
  const w = p && p.weeks.length ? Math.min(weekIdx, p.weeks.length - 1) : 0;

  const grid = useMemo(() => {
    if (!p || !p.weeks.length) return null;
    const L = p.line;
    const weekly = p.volumes[w];
    const cells = DOW.map((_, d) => {
      const profile = intradayProfile(L.type, d >= 5);
      const daily = weekly * DOW_SHARE[d];
      return HOURS.map(h => {
        const vol = daily * profile[h];
        if (L.type === 'deferred') {
          const agents = Math.ceil((vol * L.aht) / 3600 / (L.occupancy / 100));
          return { vol, agents, sl: null };
        }
        const r = requiredAgents({ volume: vol, aht: L.aht, interval: 3600, slTarget: L.slTarget / 100, slSeconds: L.slSeconds, maxOccupancy: 0.95 });
        return { vol, agents: r.agents, sl: r.serviceLevel };
      });
    });
    const agentHours = cells.flat().reduce((s, c) => s + c.agents, 0);
    const workload = (weekly * L.aht) / 3600;
    const onQueueSupply = p.sim[w].effective * L.hoursPerWeek * (1 - L.shrinkage / 100) * (1 - L.npt / 100);
    let peak = { agents: 0 };
    cells.forEach((row, d) => row.forEach((c, h) => { if (c.agents > peak.agents) peak = { ...c, d, h }; }));
    const daily = DOW.map((name, d) => ({
      day: name,
      required: cells[d].reduce((s, c) => s + c.agents, 0),
      supply: onQueueSupply * DOW_SHARE[d],
    }));
    return {
      cells, agentHours, workload, onQueueSupply, peak, daily,
      max: Math.max(...cells.flat().map(c => c.agents)),
      impliedOcc: agentHours ? workload / agentHours : 0,
      coverage: agentHours ? onQueueSupply / agentHours : 0,
    };
  }, [p, w]);

  if (!p) return <Card><EmptyState title="No plan lines" /></Card>;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Intraday Staffing Requirements"
        subtitle={'Breaks the weekly forecast into hourly demand by day of week and converts it to agents on queue\nErlang C for real time queues, and workload ÷ occupancy for deferred work'}
        actions={(
          <>
            <LineSelect lines={lines} value={p.line.id} onChange={setLineId} />
            <Select value={String(w)} onChange={v => setWeekIdx(Number(v))} className="w-44" aria-label="Plan week" options={p.weeks.map((wk, i) => ({ value: String(i), label: `Week of ${wk}` }))} />
          </>
        )}
      />

      {!grid ? <Card><EmptyState title="No forecast for this line">Import volume history in Demand Forecast</EmptyState></Card> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard info="erlang" title="Peak interval" value={`${grid.peak.agents} agents`} sub={`${DOW[grid.peak.d]} ${String(grid.peak.h).padStart(2, '0')}:00 · ${formatNumber(grid.peak.vol)} contacts`} icon={<Clock size={20} className="text-blue-600" />} />
            <KPICard title="Agent hours on queue" value={formatNumber(grid.agentHours)} sub={`workload ${formatNumber(grid.workload)} hrs`} icon={<Users size={20} className="text-violet-600" />} />
            <KPICard info="occupancy" title="Implied occupancy" value={`${(grid.impliedOcc * 100).toFixed(1)}%`} sub={`plan assumes ${p.line.occupancy}%`} status={<StatusPill status={grid.impliedOcc * 100 + 3 < p.line.occupancy ? 'warning' : 'good'}>{grid.impliedOcc * 100 + 3 < p.line.occupancy ? 'Plan occupancy too high' : 'Consistent'}</StatusPill>} icon={<Gauge size={20} className="text-emerald-600" />} />
            <KPICard info="serviceLevel" title="Supply vs interval need" value={`${(grid.coverage * 100).toFixed(0)}%`} sub="planned hours on queue ÷ required" status={<StatusPill status={grid.coverage >= 1 ? 'good' : grid.coverage >= 0.95 ? 'warning' : 'critical'}>{grid.coverage >= 1 ? 'Covered' : 'Gap'}</StatusPill>} />
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap justify-between items-end gap-2 mb-3">
              <div>
                <h3 className="font-bold text-slate-800">Required agents on queue by hour</h3>
                <p className="text-xs text-slate-500">{p.line.type === 'realtime' ? `Erlang C, ${p.line.slTarget}% answered in ${p.line.slSeconds}s, 60 minute intervals` : `Workload ÷ ${p.line.occupancy}% occupancy`} · hover a cell for details</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span>0</span>
                {SEQ_BLUE.filter((_, i) => i % 2 === 0).map(c => <span key={c} className="w-4 h-3 inline-block" style={{ background: c }} />)}
                <span>{grid.max}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th />
                    {HOURS.map(h => <th key={h} className="text-[10px] font-normal text-slate-400 w-9">{String(h).padStart(2, '0')}</th>)}
                    <th className="text-[10px] text-slate-500 pl-2 text-right">Agent hours</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.cells.map((row, d) => (
                    <tr key={DOW[d]}>
                      <td className="text-xs font-semibold text-slate-600 pr-2">{DOW[d]}</td>
                      {row.map((c, h) => {
                        const bg = seqColor(c.agents, grid.max);
                        const dark = SEQ_BLUE.indexOf(bg) >= 7;
                        return (
                          <td
                            key={h}
                            title={`${DOW[d]} ${String(h).padStart(2, '0')}:00: ${formatNumber(c.vol, 0)} contacts → ${c.agents} agents${c.sl !== null ? ` (SL ${(c.sl * 100).toFixed(0)}%)` : ''}`}
                            className={`w-9 h-8 text-center text-[10px] rounded ${dark ? 'text-white' : 'text-slate-700'}`}
                            style={{ background: bg }}
                          >
                            {c.agents || ''}
                          </td>
                        );
                      })}
                      <td className="text-xs text-right pl-2 tabular-nums text-slate-700">{formatNumber(row.reduce((s, c) => s + c.agents, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Daily hours on queue: required vs planned supply" subtitle="Supply spread by each day’s share of weekly demand" height={280}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
                <BarChart data={grid.daily} barGap={2}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="day" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} width={48} />
                  <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v, n) => [formatNumber(v), n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="required" name="Required (interval)" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="supply" name="Planned supply" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ErlangCalculator />
          </div>
        </>
      )}
    </div>
  );
};

export default IntradayStaffing;
