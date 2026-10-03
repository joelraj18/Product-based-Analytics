import React from 'react';
import { Trash2, Save, Upload, RotateCcw } from 'lucide-react';
import { Card, Button, FileButton, Field, Select, NumberInput, PageHeader, useToast } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { exportBackupWithTables, importBackupWithTables, resetWorkspace } from '../lib/storage';
import { downloadFile, readFileText, today } from '../lib/csv';
import { CURRENCIES } from '../lib/format';
import { METHODS } from '../lib/forecast';

const Settings = () => {
  const { settings, setSettings, setHiresPlan } = useWorkspace();
  const { notify } = useToast();
  const set = (patch) => setSettings({ ...settings, ...patch });

  const backup = async () => {
    downloadFile(JSON.stringify(await exportBackupWithTables(), null, 2), `workx_backup_${today()}.json`, 'application/json');
    notify('Backup downloaded (includes uploaded tables).');
  };

  const restore = async (file) => {
    try {
      const count = await importBackupWithTables(JSON.parse(await readFileText(file)));
      notify(`Restored ${count} dataset(s). Reloading…`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      notify(`Restore failed: ${e.message}`, 'error');
    }
  };

  const reset = async () => {
    if (!window.confirm('Reset all workspace data to the demo dataset? Uploaded tables are deleted; your account is kept. Download a backup first if needed.')) return;
    await resetWorkspace();
    window.location.reload();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <PageHeader title="Settings" subtitle="Preferences, planning defaults and workspace data management." />

      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Currency">
            <Select value={settings.currency} onChange={v => set({ currency: v })} options={Object.keys(CURRENCIES)} />
          </Field>
          <Field label="Plan horizon" hint="weeks">
            <NumberInput value={settings.horizonWeeks} min={4} max={78} step={1} onChange={v => set({ horizonWeeks: Math.round(v) })} />
          </Field>
          <Field label="Forecast method">
            <Select value={settings.forecastMethod} onChange={v => set({ forecastMethod: v })} options={[{ value: 'auto', label: 'Auto (best backtest)' }, ...Object.entries(METHODS).map(([k, m]) => ({ value: k, label: m.label }))]} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">Amounts are entered and shown in the selected currency; no conversion is applied.</p>
        <div className="pt-2 border-t">
          <Button variant="secondary" onClick={() => { setHiresPlan({}); notify('Saved hiring plans cleared; using recommendations.'); }}>
            <RotateCcw size={16} /> Reset hiring plans to recommendations
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Workspace data</h3>
        <p className="text-sm text-slate-500 mb-5">
          All data is stored in this browser’s local storage. Back it up regularly, or move it to another machine by restoring the backup file.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="dark" onClick={backup}><Save size={16} /> Download backup</Button>
          <FileButton variant="secondary" accept=".json,application/json" onFile={restore}><Upload size={16} /> Restore backup</FileButton>
          <Button variant="danger" onClick={reset}><Trash2 size={16} /> Reset to demo data</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-3">About WorkX</h3>
        <div className="text-sm text-slate-600 space-y-2">
          <p>WorkX is a browser-based workforce planning and analytics workbench for operations teams at product companies:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Demand forecasting with backtested accuracy (WAPE, MAPE, bias) and event uplifts</li>
            <li>Long-term capacity &amp; headcount plans driven by AHT, NPT, shrinkage, occupancy, attrition and ramp</li>
            <li>Intraday staffing requirements with Erlang C</li>
            <li>Variable cost budgeting vs OP1/OP2 targets, scenarios, risk register and peak readiness</li>
            <li>Planning KPI reporting, defect Pareto, SQL Lab and data cleaning tools</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
