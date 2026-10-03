import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Users, UserPlus, Wallet, ShieldAlert, Download, TrendingUp } from 'lucide-react';
import { Card, KPICard, ChartCard, DataTable, StatusPill, PageHeader, Button, useToast } from '../components/ui';
import { useWorkspace, monthlyTotals } from '../state/workspace';
import { planToRows, peakWeeks } from '../lib/planEngine';
import { lineStatus, planInsights } from '../lib/planHealth';
import { downloadCSV, today } from '../lib/csv';
import { formatCurrency, formatCompact, formatNumber } from '../lib/format';
import { variance } from '../lib/budget';
import { wape } from '../lib/stats';
import { weekStart, parseDate } from '../lib/dates';
import { SERIES, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT } from '../lib/theme';

const PlanningHub = ({ onNavigate }) => {
  const { plan, currency, risks, opTargets, actuals, sites } = useWorkspace();
  const { notify } = useToast();
  const { plans, totals } = plan;
  const fmt = (v) => formatCurrency(v, currency);

  const stats = useMemo(() => {
    if (!totals.length) return null;
    const now = totals[0];
    const cost = totals.reduce((s, t) => s + t.cost, 0);
    const months = monthlyTotals(plans);
    const opByMonth = Object.fromEntries(opTargets.map(o => [o.month, o]));
    const overlap = months.filter(m => opByMonth[m.month]);
    const planOverlap = overlap.reduce((s, m) => s + m.total, 0);
    const op2 = overlap.reduce((s, m) => s + (Number(opByMonth[m.month].op2_cost) || 0), 0);
    const recent = [...new Set(actuals.map(a => a.week_start))].sort().slice(-8);
    const rec = actuals.filter(a => recent.includes(a.week_start));
    return {
      reqNow: now.required,
      effNow: now.effective,
      worstGap: Math.min(...totals.map(t => t.gapPct)),
      hires: totals.reduce((s, t) => s + t.hires, 0),
      temps: totals.reduce((s, t) => s + t.temps, 0),
      cost,
      opVar: op2 ? variance(planOverlap, op2) : null,
      openRisks: risks.filter(r => r.status !== 'Closed' && r.status !== 'Mitigated').length,
      highRisks: risks.filter(r => r.status !== 'Closed' && r.status !== 'Mitigated' && r.likelihood * r.impact >= 12).length,
      wape8: rec.length ? wape(rec.map(a => a.actual_volume), rec.map(a => a.forecast_volume)) : NaN,
    };
  }, [totals, plans, opTargets, risks, actuals]);

  const peaks = useMemo(() => peakWeeks(totals, 4), [totals]);
  const insights = useMemo(() => {
    const list = planInsights(plans, fmt);
    const lastHist = Object.values(plan.series).map(x => x.weeks[x.weeks.length - 1]).filter(Boolean).sort().pop();
    const thisWeek = weekStart(new Date());
    if (lastHist && (parseDate(thisWeek) - parseDate(lastHist)) / 86400000 > 14) {
      list.unshift({ status: 'warning', text: `Volume history ends week of ${lastHist}. Import the latest actuals in Demand Forecast so the plan starts from this week.` });
    }
    return list;
  }, [plans, plan.series, currency]); // eslint-disable-line react-hooks/exhaustive-deps
  const siteName = Object.fromEntries(sites.map(s => [s.id, s.name]));

  const lineRows = plans.map(p => {
    const st = lineStatus(p);
    return {
      id: p.line.id,
      name: p.line.name,
      site: siteName[p.line.siteId] || p.line.siteId || '—',
      reqNow: p.sim[0] ? p.sim[0].required : 0,
      hcNow: p.sim[0] ? p.sim[0].totalHC : 0,
      peakReq: p.summary.peakRequired,
      minGap: p.summary.minGapPct,
      hires: p.summary.totalHires,
      temps: p.summary.totalTemps,
      ot: p.summary.totalOtHours,
      cost: p.costs.reduce((s, c) => s + c.total, 0),
      wape: p.forecast ? p.forecast.accuracy.wape : NaN,
      status: st,
    };
  });

  const exportPack = () => {
    downloadCSV(planToRows(plans), `weekly_headcount_plan_${today()}.csv`);
    notify('Weekly headcount plan exported (all lines × weeks).');
  };

  if (!stats) return <Card className="p-8 text-slate-500">No plan available — load volume history in Demand Forecast.</Card>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Planning Hub"
        subtitle="Readiness across every program and site: demand, required vs planned headcount, hiring, variable cost vs OP and open risks."
        actions={<Button variant="success" onClick={exportPack}><Download size={16} /> Export weekly plan</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          info="requiredFte"
          title="Required vs effective FTE"
          value={`${formatNumber(stats.reqNow)} / ${formatNumber(stats.effNow)}`}
          status={<StatusPill status={stats.effNow >= stats.reqNow ? 'good' : 'warning'}>{stats.effNow >= stats.reqNow ? 'Covered' : `${formatNumber(stats.reqNow - stats.effNow, 1)} FTE short`}</StatusPill>}
          icon={<Users size={20} className="text-blue-600" />}
          onClick={() => onNavigate('capacity')}
        />
        <KPICard
          info="temps"
          title="Hires: perm + temp"
          value={`${formatNumber(stats.hires)} + ${formatNumber(stats.temps)}`}
          sub={`worst week ${stats.worstGap >= 0 ? '+' : ''}${stats.worstGap.toFixed(1)}% vs required`}
          icon={<UserPlus size={20} className="text-violet-600" />}
          onClick={() => onNavigate('capacity')}
        />
        <KPICard
          info="op"
          title="Variable cost (horizon)"
          value={formatCompact(stats.cost, currency)}
          sub={stats.opVar ? `${stats.opVar.pct >= 0 ? '+' : ''}${stats.opVar.pct.toFixed(1)}% vs OP2` : 'no OP target'}
          status={stats.opVar && <StatusPill status={stats.opVar.pct <= 0 ? 'good' : stats.opVar.pct <= 3 ? 'warning' : 'critical'}>{stats.opVar.pct <= 0 ? 'Within OP' : 'Over OP'}</StatusPill>}
          icon={<Wallet size={20} className="text-emerald-600" />}
          onClick={() => onNavigate('budget')}
        />
        <KPICard
          info="wape"
          title="Open risks · forecast WAPE (8 wk)"
          value={`${stats.openRisks} · ${Number.isFinite(stats.wape8) ? `${stats.wape8.toFixed(1)}%` : '—'}`}
          status={stats.highRisks > 0 ? <StatusPill status="critical">{stats.highRisks} high</StatusPill> : <StatusPill status="good">none high</StatusPill>}
          icon={<ShieldAlert size={20} className="text-rose-600" />}
          onClick={() => onNavigate('scenarios')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <ChartCard title="Required vs effective FTE — all lines" subtitle="Dashed verticals mark the top-4 peak demand weeks" className="xl:col-span-2" height={300}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <LineChart data={totals} margin={{ right: 12 }}>
              <CartesianGrid {...GRID_PROPS} />
              {peaks.map(w => <ReferenceLine key={w} x={w} stroke="#c98500" strokeDasharray="3 3" />)}
              <XAxis dataKey="weekStart" {...AXIS_PROPS} tickFormatter={v => v.slice(5)} minTickGap={16} />
              <YAxis {...AXIS_PROPS} width={48} />
              <Tooltip {...TOOLTIP_PROPS} labelFormatter={v => `Week of ${v}`} formatter={(v, n) => [formatNumber(v, 1), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="required" name="Required FTE" stroke={SERIES[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="effective" name="Effective FTE (plan)" stroke={SERIES[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="totalHC" name="Paid headcount" stroke={SERIES[2]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="p-5 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><TrendingUp size={16} /> Actions &amp; insights</h3>
          <div className="space-y-2 overflow-auto max-h-[300px] pr-1">
            {insights.length === 0 && <p className="text-sm text-slate-500">All lines are covered without overtime. 🎯</p>}
            {insights.map((i, k) => (
              <div key={k} className="text-sm text-slate-700 flex gap-2 items-start">
                <span className="shrink-0 mt-0.5"><StatusPill status={i.status}>{i.status === 'critical' ? 'Act' : i.status === 'warning' ? 'Watch' : 'Plan'}</StatusPill></span>
                <span>{i.text}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-3 border-b font-bold text-slate-800">Plan lines</div>
        <DataTable
          rows={lineRows}
          columns={[
            { key: 'name', label: 'Program / queue' },
            { key: 'site', label: 'Site' },
            { key: 'reqNow', label: 'Req FTE (wk 1)', align: 'right', format: v => formatNumber(v, 1) },
            { key: 'hcNow', label: 'Paid HC (wk 1)', align: 'right', format: v => formatNumber(v, 1) },
            { key: 'peakReq', label: 'Peak req FTE', align: 'right', format: v => formatNumber(v, 1) },
            { key: 'minGap', label: 'Worst gap', align: 'right', format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
            { key: 'hires', label: 'Perm hires', align: 'right' },
            { key: 'temps', label: 'Temp hires', align: 'right' },
            { key: 'ot', label: 'OT hrs', align: 'right', format: v => formatNumber(v) },
            { key: 'cost', label: 'Variable cost', align: 'right', format: v => fmt(v) },
            { key: 'wape', label: 'Fcst WAPE', align: 'right', format: v => (Number.isFinite(v) ? `${v.toFixed(1)}%` : '—') },
            { key: 'status', label: 'Status', render: r => <StatusPill status={r.status.status}>{r.status.label}</StatusPill> },
          ]}
        />
      </Card>
    </div>
  );
};

export default PlanningHub;
