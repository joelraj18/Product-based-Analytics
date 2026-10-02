import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, Database, Table, Kanban, Settings as SettingsIcon, Brush, LogOut, Menu,
  Gauge, TrendingUp, Users, Clock, Wallet, ShieldAlert, Activity, Compass, UploadCloud,
} from 'lucide-react';
import { ToastProvider, useToast } from './components/ui';
import { HelpBox } from './components/help';
import StartHere from './modules/StartHere';
import UploadCenter from './modules/UploadCenter';
import ErrorBoundary from './components/ErrorBoundary';
import { WorkspaceProvider, useWorkspace } from './state/workspace';
import { load, remove } from './lib/storage';
import usePersistentState from './hooks/usePersistentState';
import AuthModule from './modules/Auth';
import PlanningHub from './modules/PlanningHub';
import DemandForecast from './modules/DemandForecast';
import CapacityPlanner from './modules/CapacityPlanner';
import IntradayStaffing from './modules/IntradayStaffing';
import BudgetPlanner from './modules/BudgetPlanner';
import ScenarioRisk from './modules/ScenarioRisk';
import PlanningKPIs from './modules/PlanningKPIs';
import Dashboard from './modules/Dashboard';
import SqlLab from './modules/SqlLab';
import DataGrid from './modules/DataGrid';
import DataCleaning from './modules/DataCleaning';
import Projects from './modules/Projects';
import Settings from './modules/Settings';

export const NAV = [
  {
    group: 'Get started',
    items: [
      { id: 'start', label: 'Start Here', icon: Compass, component: StartHere },
      { id: 'upload', label: 'Upload Data', icon: UploadCloud, component: UploadCenter },
    ],
  },
  {
    group: 'Workforce Planning',
    items: [
      { id: 'hub', label: 'Planning Hub', icon: Gauge, component: PlanningHub },
      { id: 'forecast', label: 'Demand Forecast', icon: TrendingUp, component: DemandForecast },
      { id: 'capacity', label: 'Capacity & Headcount', icon: Users, component: CapacityPlanner },
      { id: 'intraday', label: 'Intraday Staffing', icon: Clock, component: IntradayStaffing },
      { id: 'budget', label: 'Budget & OP', icon: Wallet, component: BudgetPlanner },
      { id: 'scenarios', label: 'Scenarios & Risks', icon: ShieldAlert, component: ScenarioRisk },
      { id: 'kpis', label: 'Planning KPIs', icon: Activity, component: PlanningKPIs },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { id: 'dashboard', label: 'Sales Dashboard', icon: LayoutDashboard, component: Dashboard },
      { id: 'sql', label: 'SQL Lab', icon: Database, component: SqlLab },
      { id: 'grid', label: 'Data Grid', icon: Table, component: DataGrid },
      { id: 'cleaning', label: 'Data Cleaning', icon: Brush, component: DataCleaning },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { id: 'projects', label: 'Workboard', icon: Kanban, component: Projects },
      { id: 'settings', label: 'Settings', icon: SettingsIcon, component: Settings },
    ],
  },
];
const ALL_ITEMS = NAV.flatMap(g => g.items);

const NavItem = ({ icon: Icon, label, active, expanded, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={expanded ? undefined : label}
    aria-current={active ? 'page' : undefined}
    className={`w-full flex items-center p-2.5 rounded-lg transition-colors duration-150 ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
    } ${expanded ? 'gap-3' : 'justify-center'}`}
  >
    <Icon size={18} aria-hidden="true" />
    {expanded && <span className="font-medium text-sm truncate">{label}</span>}
  </button>
);

const Shell = ({ user, onLogout }) => {
  const { plan } = useWorkspace();
  const [active, setActive] = usePersistentState('active_module', 'start');
  const { notify } = useToast();
  const warnedFull = useRef(false);
  useEffect(() => {
    const onFull = () => {
      if (warnedFull.current) return;
      warnedFull.current = true;
      notify('Browser storage is full: your latest changes work now but may not survive a reload. Download a backup in Settings, or delete large uploads you no longer need.', 'warning');
    };
    window.addEventListener('workx-storage-full', onFull);
    return () => window.removeEventListener('workx-storage-full', onFull);
  }, [notify]);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  const current = ALL_ITEMS.find(i => i.id === active) || ALL_ITEMS[0];
  const Module = current.component;
  const weeks = plan.totals.map(t => t.weekStart);
  const initials = (user.name || user.email || '?').split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const go = (id) => {
    setActive(id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      <aside
        className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'} fixed lg:static inset-y-0 left-0 bg-slate-900 text-slate-300 transition-all duration-200 flex flex-col shadow-xl z-30`}
        aria-label="Main navigation"
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 font-bold text-white tracking-wider">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-lg">W</span></div>
            {sidebarOpen && <span className="text-xl">WorkX</span>}
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-5 overflow-y-auto">
          {NAV.map(group => (
            <div key={group.group}>
              {sidebarOpen && <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">{group.group}</div>}
              <div className="space-y-1">
                {group.items.map(item => (
                  <NavItem key={item.id} icon={item.icon} label={item.label} active={current.id === item.id} expanded={sidebarOpen} onClick={() => go(item.id)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-800">
          <button type="button" onClick={onLogout} className={`flex items-center w-full p-2.5 rounded-lg hover:bg-slate-800 text-rose-300 transition-colors ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <LogOut size={18} aria-hidden="true" />
            {sidebarOpen && <span className="text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm z-10 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" aria-label="Toggle navigation" onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <Menu size={20} />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-slate-800 truncate">{current.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            {weeks.length > 0 && (
              <div className="hidden md:block px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-semibold border border-blue-200 whitespace-nowrap">
                Plan horizon: wk {weeks[0]} → {weeks[weeks.length - 1]}
              </div>
            )}
            <div className="flex items-center gap-3 pl-3 border-l">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-800 truncate max-w-[160px]">{user.name || user.email}</div>
                <div className="text-xs text-slate-500">Planner</div>
              </div>
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full text-white flex items-center justify-center font-bold text-sm">
                {initials}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <HelpBox moduleId={current.id} onNavigate={go} />
          <ErrorBoundary resetKey={current.id}>
            <Module onNavigate={go} />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(() => load('current_user', null));
  const logout = () => { remove('current_user'); setUser(null); };
  return (
    <ToastProvider>
      {user ? (
        <WorkspaceProvider>
          <Shell user={user} onLogout={logout} />
        </WorkspaceProvider>
      ) : (
        <AuthModule onLogin={setUser} />
      )}
    </ToastProvider>
  );
};

export default App;
