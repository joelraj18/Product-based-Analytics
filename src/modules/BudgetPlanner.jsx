import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Wallet, Receipt, Scale, Wand2 } from 'lucide-react';
import { Card, ChartCard, KPICard, PageHeader, Button, NumberInput, DataTable, StatusPill } from '../components/ui';
import { useWorkspace, monthlyTotals, deriveOpTargets } from '../state/workspace';
import { rollupByMonth, costPerUnit, variance } from '../lib/budget';
import { downloadCSV, today } from '../lib/csv';
import SchemaImportButton from '../components/SchemaImportButton';
import { formatCurrency, formatCompact, formatNumber } from '../lib/format';
import { monthLabel } from '../lib/dates';
import { SERIES, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT } from '../lib/theme';

const varStatus = (pct) => (pct <= 0 ? 'good' : pct <= 3 ? 'warning' : 'critical');

const BudgetPlanner = () => {
  const { plan, currency, opTargets, setOpTargets } = useWorkspace();
  const fmt = (v) => formatCurrency(v, currency);
  const { plans } = plan;

  const months = useMemo(() => {
    const totals = monthlyTotals(plans);
    const byLine = plans.map(p => ({ p, months: Object.fromEntries(rollupByMonth(p.costs).map(m => [m.month, m])) }));
    const op = Object.fromEntries(opTargets.map(o => [o.month, o]));
    return totals.map(m => {
      let vendor = 0;
      let inhouse = 0;
      byLine.forEach(({ p, months: lm }) => {
        const x = lm[m.month];
        if (!x) return;
        if (p.line.costModel === 'perUnit') vendor += x.base; else inhouse += x.base;
      });
      const o = op[m.month];
      return {
        ...m,
        label: monthLabel(m.month),
        inhouse, vendor,
        op1: o ? Number(o.op1_cost) || 0 : null,
        op2: o ? Number(o.op2_cost) || 0 : null,
        op2_volume: o ? Number(o.op2_volume) || 0 : null,
        cpc: costPerUnit(m.total, m.volume),
      };
    });
  }, [plans, opTargets]);

  const k = useMemo(() => {
    const total = months.reduce((s, m) => s + m.total, 0);
    const volume = months.reduce((s, m) => s + m.volume, 0);
    const withOp = months.filter(m => m.op2 !== null);
    const planOp = withOp.reduce((s, m) => s + m.total, 0);
    const op1 = withOp.reduce((s, m) => s + m.op1, 0);
    const op2 = withOp.reduce((s, m) => s + m.op2, 0);
    const opVol = withOp.reduce((s, m) => s + m.op2_volume, 0);
    return {
      total, volume,
      ot: months.reduce((s, m) => s + m.overtime, 0),
      hiring: months.reduce((s, m) => s + m.hiring, 0),
      vsOp1: op1 ? variance(planOp, op1) : null,
      vsOp2: op2 ? variance(planOp, op2) : null,
      cpc: costPerUnit(total, volume),
      opCpc: opVol ? op2 / opVol : null,
      covered: withOp.length,
    };
  }, [months]);

  const lineRows = plans.map(p => {
    const cost = p.costs.reduce((s, c) => s + c.total, 0);
    const vol = p.volumes.reduce((a, b) => a + b, 0);
    return { id: p.line.id, name: p.line.name, model: p.line.costModel === 'perUnit' ? 'Vendor / unit' : 'In-house / hr', volume: vol, cost, cpc: costPerUnit(cost, vol), share: k.total ? (100 * cost) / k.total : 0, ot: p.costs.reduce((s, c) => s + c.overtime, 0) };
  });

  const updateOp = (month, field, value) => {
    const exists = opTargets.some(o => o.month === month);
    setOpTargets(exists ? opTargets.map(o => (o.month === month ? { ...o, [field]: value } : o)) : [...opTargets, { month, op1_volume: 0, op1_cost: 0, op2_volume: 0, op2_cost: 0, [field]: value }]);
  };

  const exportBudget = () => downloadCSV(months.map(m => ({
    month: m.month, volume: Math.round(m.volume), inhouse_cost: Math.round(m.inhouse), vendor_cost: Math.round(m.vendor),
    overtime_cost: Math.round(m.overtime), hiring_cost: Math.round(m.hiring), total_cost: Math.round(m.total),
    cost_per_contact: Number(m.cpc.toFixed(2)), op1_cost: m.op1 ?? '', op2_cost: m.op2 ?? '',
    var_vs_op2: m.op2 !== null ? Math.round(m.total - m.op2) : '',
  })), `variable_cost_budget_${today()}.csv`);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Variable Cost Budget vs OP"
        subtitle="Cost of the headcount plan by month — in-house labour, vendor per-unit billing, overtime and hiring — compared with OP1 (annual plan) and OP2 (mid-year refresh) targets."
        actions={(
          <>
            <Button variant="success" onClick={exportBudget}><Download size={16} /> Budget CSV</Button>
            <SchemaImportButton variant="secondary" schemaId="op_targets">Import OP targets</SchemaImportButton>
          </>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard info="variableCost" title="Plan cost (horizon)" value={formatCompact(k.total, currency)} sub={`${formatCompact(k.volume)} contacts`} icon={<Wallet size={20} className="text-blue-600" />} />
        <KPICard info="op" title="vs OP2" value={k.vsOp2 ? `${k.vsOp2.pct >= 0 ? '+' : ''}${k.vsOp2.pct.toFixed(1)}%` : '—'} sub={k.vsOp2 ? `${fmt(k.vsOp2.abs)} over ${k.covered} month(s)` : 'no OP2 targets'} status={k.vsOp2 && <StatusPill status={varStatus(k.vsOp2.pct)}>{k.vsOp2.pct <= 0 ? 'Within' : 'Over'}</StatusPill>} icon={<Scale size={20} className="text-violet-600" />} />
        <KPICard info="op" title="vs OP1" value={k.vsOp1 ? `${k.vsOp1.pct >= 0 ? '+' : ''}${k.vsOp1.pct.toFixed(1)}%` : '—'} sub={k.vsOp1 ? fmt(k.vsOp1.abs) : 'no OP1 targets'} status={k.vsOp1 && <StatusPill status={varStatus(k.vsOp1.pct)}>{k.vsOp1.pct <= 0 ? 'Within' : 'Over'}</StatusPill>} />
        <KPICard info="cpc" title="Cost per contact" value={formatCurrency(k.cpc, currency, { maximumFractionDigits: 2 })} sub={k.opCpc ? `OP2 ${formatCurrency(k.opCpc, currency, { maximumFractionDigits: 2 })} · OT ${((100 * k.ot) / Math.max(1, k.total)).toFixed(1)}% of cost` : ''} icon={<Receipt size={20} className="text-emerald-600" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Plan vs OP1 vs OP2 by month" height={300}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={months} barGap={2}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} width={64} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v, n) => [fmt(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Plan" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="op1" name="OP1" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="op2" name="OP2" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cost composition by month" subtitle="Stacked: in-house labour, vendor, overtime, hiring" height={300}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
            <BarChart data={months}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v, currency)} width={64} />
              <Tooltip {...TOOLTIP_PROPS} cursor={{ fill: '#f1f5f9' }} formatter={(v, n) => [fmt(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inhouse" name="In-house" stackId="c" fill={SERIES[0]} stroke="#fff" strokeWidth={1} maxBarSize={40} />
              <Bar dataKey="vendor" name="Vendor" stackId="c" fill={SERIES[1]} stroke="#fff" strokeWidth={1} maxBarSize={40} />
              <Bar dataKey="overtime" name="Overtime" stackId="c" fill={SERIES[2]} stroke="#fff" strokeWidth={1} maxBarSize={40} />
              <Bar dataKey="hiring" name="Hiring" stackId="c" fill={SERIES[3]} stroke="#fff" strokeWidth={1} maxBarSize={40} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <div className="px-5 py-3 border-b flex flex-wrap justify-between items-center gap-2">
          <span className="font-bold text-slate-800">Monthly budget &amp; OP targets <span className="font-normal text-xs text-slate-500">(edit OP cells; first/last months may be partial)</span></span>
          <Button size="sm" variant="secondary" onClick={() => { if (window.confirm('Replace OP targets with values derived from the current plan?')) setOpTargets(deriveOpTargets(monthlyTotals(plans))); }}><Wand2 size={12} /> Re-seed OP from plan</Button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>{['Month', 'Volume', 'Plan cost', 'Cost / contact', 'OP1 cost', 'OP2 cost', 'OP2 volume', 'Var vs OP2', 'Status'].map(h => <th key={h} className={`px-3 py-2 border-b whitespace-nowrap ${h === 'Month' || h === 'Status' ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {months.map(m => {
                const v = m.op2 ? variance(m.total, m.op2) : null;
                return (
                  <tr key={m.month}>
                    <td className="px-3 py-1.5">{m.label}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(m.volume)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmt(m.total)}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(m.cpc, currency, { maximumFractionDigits: 2 })}</td>
                    {['op1_cost', 'op2_cost', 'op2_volume'].map(f => (
                      <td key={f} className="px-1 py-1">
                        <NumberInput value={(opTargets.find(o => o.month === m.month) || {})[f] ?? ''} min={0} step={1} onChange={val => updateOp(m.month, f, val)} className="w-32 py-1 text-right ml-auto" aria-label={`${f} ${m.month}`} />
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-right ${v && v.abs > 0 ? 'text-rose-700' : 'text-emerald-800'}`}>{v ? `${v.abs >= 0 ? '+' : ''}${fmt(v.abs)} (${v.pct.toFixed(1)}%)` : '—'}</td>
                    <td className="px-3 py-1.5">{v ? <StatusPill status={varStatus(v.pct)}>{v.pct <= 0 ? 'Within' : v.pct <= 3 ? 'Watch' : 'Over'}</StatusPill> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="px-5 py-3 border-b font-bold text-slate-800">Cost by plan line</div>
        <DataTable
          rows={lineRows}
          columns={[
            { key: 'name', label: 'Line' },
            { key: 'model', label: 'Cost model' },
            { key: 'volume', label: 'Volume', align: 'right', format: v => formatNumber(v) },
            { key: 'cost', label: 'Variable cost', align: 'right', format: v => fmt(v) },
            { key: 'cpc', label: 'Cost / contact', align: 'right', format: v => formatCurrency(v, currency, { maximumFractionDigits: 2 }) },
            { key: 'ot', label: 'OT cost', align: 'right', format: v => fmt(v) },
            { key: 'share', label: 'Share', align: 'right', format: v => `${v.toFixed(1)}%` },
          ]}
        />
      </Card>
    </div>
  );
};

export default BudgetPlanner;
