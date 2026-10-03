import React, { useMemo, useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Download, Plus, Trash2, FileDown, Target } from 'lucide-react';
import { Card, ChartCard, KPICard, DataTable, PageHeader, Button, Field, Select, TextInput, NumberInput, StatusPill, useToast } from '../components/ui';
import { LineSelect, shortWeek } from '../components/planning';
import { useWorkspace } from '../state/workspace';
import { METHODS, backtest, backtestWindow } from '../lib/forecast';
import { downloadCSV, today } from '../lib/csv';
import SchemaImportButton from '../components/SchemaImportButton';
import { formatNumber, formatCompact } from '../lib/format';
import { parseDate } from '../lib/dates';
import { SERIES, INK, AXIS_PROPS, GRID_PROPS, TOOLTIP_PROPS, CHART_INIT } from '../lib/theme';

const accuracyStatus = (w) => (!Number.isFinite(w) ? 'info' : w <= 5 ? 'good' : w <= 10 ? 'warning' : 'critical');

const DemandForecast = () => {
  const { plan, lines, settings, setSettings, events, setEvents, volumeHistory } = useWorkspace();
  const { notify } = useToast();
  const [lineId, setLineId] = useState('all');
  const [newEvent, setNewEvent] = useState({ name: '', start: '', end: '', upliftPct: 10, lineId: 'all' });

  const selected = lineId === 'all' ? plan.plans.filter(p => p.weeks.length) : plan.plans.filter(p => p.line.id === lineId && p.weeks.length);

  const chartData = useMemo(() => {
    if (!selected.length) return [];
    const hist = {};
    selected.forEach(p => {
      const s = plan.series[p.line.id];
      if (!s) return;
      s.weeks.slice(-52).forEach((w, i, arr) => {
        const v = s.values[s.values.length - arr.length + i];
        hist[w] = (hist[w] || 0) + v;
      });
    });
    const rows = Object.keys(hist).sort().map(w => ({ week: w, actual: hist[w] }));
    const fc = {};
    selected.forEach(p => p.weeks.forEach((w, i) => {
      const f = fc[w] || (fc[w] = { week: w, forecast: 0, base: 0 });
      f.forecast += p.volumes[i];
      f.base += p.forecast.base[i];
    }));
    // Connect the forecast line to the last actual point.
    if (rows.length) { rows[rows.length - 1].forecast = rows[rows.length - 1].actual; rows[rows.length - 1].base = rows[rows.length - 1].actual; }
    return [...rows, ...Object.values(fc).sort((a, b) => a.week.localeCompare(b.week))];
  }, [selected, plan.series]);

  const methodTable = useMemo(() => {
    const target = lineId === 'all' ? null : plan.series[lineId];
    if (!target) return [];
    const holdout = backtestWindow(target.values.length, settings.horizonWeeks);
    return Object.entries(METHODS).map(([key, m]) => {
      const bt = backtest(target.values, key, holdout);
      return { id: key, method: m.label, wape: bt.wape, mape: bt.mape, bias: bt.bias, holdout };
    }).sort((a, b) => a.wape - b.wape);
  }, [lineId, plan.series, settings.horizonWeeks]);

  const totals = useMemo(() => {
    const fcst = selected.reduce((s, p) => s + p.volumes.reduce((a, b) => a + b, 0), 0);
    const ly = selected.reduce((s, p) => {
      const ser = plan.series[p.line.id];
      return s + (ser ? ser.values.slice(-52).slice(0, p.weeks.length).reduce((a, b) => a + b, 0) : 0);
    }, 0);
    const wapes = selected.map(p => p.forecast.accuracy.wape).filter(Number.isFinite);
    const biases = selected.map(p => p.forecast.accuracy.bias).filter(Number.isFinite);
    const peak = chartData.filter(r => r.forecast !== undefined && r.actual === undefined).sort((a, b) => b.forecast - a.forecast)[0];
    return {
      fcst, ly,
      yoy: ly ? ((fcst - ly) / ly) * 100 : null,
      wape: wapes.length ? wapes.reduce((a, b) => a + b, 0) / wapes.length : NaN,
      bias: biases.length ? biases.reduce((a, b) => a + b, 0) / biases.length : NaN,
      peak,
    };
  }, [selected, plan.series, chartData]);

  const exportForecast = () => {
    const rows = selected.flatMap(p => p.weeks.map((w, i) => ({
      week_start: w, line_id: p.line.id, line_name: p.line.name, method: p.forecast.method,
      base_forecast: p.forecast.base[i], event_adjusted_forecast: p.volumes[i],
    })));
    downloadCSV(rows, `volume_forecast_${today()}.csv`);
  };

  const addEvent = () => {
    if (!newEvent.name.trim() || !parseDate(newEvent.start) || !parseDate(newEvent.end)) { notify('An event needs a name, start date and end date', 'warning'); return; }
    if (newEvent.end < newEvent.start) { notify('The end date is before the start date', 'warning'); return; }
    setEvents([...events, { ...newEvent, name: newEvent.name.trim(), id: `EV-${Date.now().toString(36)}` }]);
    setNewEvent({ name: '', start: '', end: '', upliftPct: 10, lineId: 'all' });
  };

  const lastActual = chartData.filter(r => r.actual !== undefined).slice(-1)[0];
  const lineName = Object.fromEntries(lines.map(l => [l.id, l.name]));

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        hideTitle
        title="Demand Forecast"
        subtitle={'Weekly volume forecast per program or queue\nThe method is chosen by a backtest over the planning horizon, and planned events add uplift on top'}
        actions={(
          <>
            <LineSelect lines={lines} value={lineId} onChange={setLineId} allowAll />
            <Select
              value={settings.forecastMethod} className="w-56" aria-label="Forecast method"
              onChange={v => setSettings({ ...settings, forecastMethod: v })}
              options={[{ value: 'auto', label: 'Method: auto (best backtest)' }, ...Object.entries(METHODS).map(([k, m]) => ({ value: k, label: m.label }))]}
            />
          </>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={`Forecast volume (${settings.horizonWeeks} wk)`} value={formatCompact(totals.fcst)} delta={totals.yoy} deltaLabel="vs same weeks last year" />
        <KPICard info="peak" title="Peak week" value={totals.peak ? formatNumber(totals.peak.forecast) : '—'} sub={totals.peak ? `week of ${totals.peak.week}` : ''} />
        <KPICard info="wape" title="Backtest WAPE" value={Number.isFinite(totals.wape) ? `${totals.wape.toFixed(1)}%` : '—'} status={<StatusPill status={accuracyStatus(totals.wape)}>{accuracyStatus(totals.wape) === 'good' ? 'On target ≤5%' : accuracyStatus(totals.wape) === 'warning' ? 'Review' : 'Off target'}</StatusPill>} icon={<Target size={20} className="text-blue-600" />} />
        <KPICard info="bias" title="Backtest bias" value={Number.isFinite(totals.bias) ? `${totals.bias >= 0 ? '+' : ''}${totals.bias.toFixed(1)}%` : '—'} sub={totals.bias > 0 ? 'over forecasting' : 'under forecasting'} />
      </div>

      <ChartCard
        title="Weekly volume: last 52 weeks actual and forecast"
        subtitle="Dashed = statistical forecast before event uplifts"
        height={340}
        actions={(
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={exportForecast}><Download size={12} /> Forecast CSV</Button>
          </div>
        )}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={CHART_INIT}>
          <ComposedChart data={chartData} margin={{ right: 12 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="week" {...AXIS_PROPS} tickFormatter={shortWeek} minTickGap={24} />
            <YAxis {...AXIS_PROPS} tickFormatter={v => formatCompact(v)} width={52} />
            <Tooltip {...TOOLTIP_PROPS} labelFormatter={v => `Week of ${v}`} formatter={(v, n) => [formatNumber(v), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {lastActual && <ReferenceLine x={lastActual.week} stroke={INK.axis} label={{ value: 'today', fontSize: 11, fill: INK.muted, position: 'insideTopRight' }} />}
            <Area type="monotone" dataKey="actual" name="Actual" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.12} strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="base" name="Statistical forecast" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast with events" stroke={SERIES[1]} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 py-3 border-b flex justify-between items-center">
            <span className="font-bold text-slate-800">Method comparison {methodTable[0] ? `(holdout ${methodTable[0].holdout} wk)` : ''}</span>
          </div>
          {lineId === 'all' ? (
            <DataTable
              rows={plan.plans.filter(p => p.forecast).map(p => ({ id: p.line.id, line: p.line.name, method: METHODS[p.forecast.method].label, wape: p.forecast.accuracy.wape, mape: p.forecast.accuracy.mape, bias: p.forecast.accuracy.bias }))}
              columns={[
                { key: 'line', label: 'Line' },
                { key: 'method', label: 'Method in use' },
                { key: 'wape', label: 'WAPE', align: 'right', format: v => `${v.toFixed(1)}%` },
                { key: 'mape', label: 'MAPE', align: 'right', format: v => `${v.toFixed(1)}%` },
                { key: 'bias', label: 'Bias', align: 'right', format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
              ]}
            />
          ) : (
            <DataTable
              rows={methodTable}
              columns={[
                { key: 'method', label: 'Method', render: r => <span>{r.method}{selected[0] && selected[0].forecast.method === r.id && <span className="ml-2"><StatusPill status="good">in use</StatusPill></span>}</span> },
                { key: 'wape', label: 'WAPE', align: 'right', format: v => `${v.toFixed(1)}%` },
                { key: 'mape', label: 'MAPE', align: 'right', format: v => `${v.toFixed(1)}%` },
                { key: 'bias', label: 'Bias', align: 'right', format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
              ]}
            />
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="font-bold text-slate-800">Volume history data</div>
          <p className="text-sm text-slate-500">
            Daily rows with columns <code className="bg-slate-100 px-1 rounded">date, line_id, volume</code> and optionally <code className="bg-slate-100 px-1 rounded">aht</code><br />Importing replaces history only for the lines in the file, and partial weeks are ignored
          </p>
          <div className="flex flex-wrap gap-2">
            <SchemaImportButton schemaId="volume_history">Import history (CSV/Excel)</SchemaImportButton>
            <Button variant="secondary" onClick={() => downloadCSV(volumeHistory.slice(-14), 'volume_history_template.csv', ['date', 'line_id', 'volume', 'aht'])}><FileDown size={16} /> Template</Button>
            <Button variant="secondary" onClick={() => downloadCSV(volumeHistory, `volume_history_${today()}.csv`, ['date', 'line_id', 'volume', 'aht'])}><Download size={16} /> Export all</Button>
          </div>
          <p className="text-xs text-slate-400">{formatNumber(volumeHistory.length)} daily rows · {Object.keys(plan.series).length} line(s) with complete weeks</p>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-3 border-b font-bold text-slate-800">Planned events &amp; uplifts</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end border-b bg-slate-50">
          <Field label="Event" className="md:col-span-2"><TextInput value={newEvent.name} onChange={v => setNewEvent({ ...newEvent, name: v })} placeholder="Like Marketing campaign" /></Field>
          <Field label="Start"><input type="date" className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={newEvent.start} onChange={e => setNewEvent({ ...newEvent, start: e.target.value })} /></Field>
          <Field label="End"><input type="date" className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={newEvent.end} onChange={e => setNewEvent({ ...newEvent, end: e.target.value })} /></Field>
          <Field label="Uplift %"><NumberInput value={newEvent.upliftPct} min={-90} max={500} onChange={v => setNewEvent({ ...newEvent, upliftPct: v })} /></Field>
          <div className="flex gap-2">
            <Select value={newEvent.lineId} onChange={v => setNewEvent({ ...newEvent, lineId: v })} options={[{ value: 'all', label: 'All lines' }, ...lines.map(l => ({ value: l.id, label: l.id }))]} aria-label="Event line" />
            <Button onClick={addEvent} aria-label="Add event"><Plus size={16} /></Button>
          </div>
        </div>
        <DataTable
          rows={events}
          emptyText="No events, so the forecast is purely statistical"
          columns={[
            { key: 'name', label: 'Event' },
            { key: 'start', label: 'Start' },
            { key: 'end', label: 'End' },
            { key: 'upliftPct', label: 'Uplift', align: 'right', format: v => `${v >= 0 ? '+' : ''}${v}%` },
            { key: 'lineId', label: 'Applies to', format: v => (v === 'all' ? 'All lines' : lineName[v] || v) },
            { key: 'actions', label: '', render: r => <button type="button" aria-label={`Delete ${r.name}`} onClick={() => setEvents(events.filter(e => e.id !== r.id))} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button> },
          ]}
        />
      </Card>
    </div>
  );
};

export default DemandForecast;
