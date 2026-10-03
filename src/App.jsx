import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, Database, Table, Kanban, Settings as SettingsIcon, Brush, LogOut, Menu,
  Gauge, TrendingUp, Users, Clock, Wallet, ShieldAlert, Activity, Compass, UploadCloud, FileSpreadsheet, LineChart as LineChartIcon,
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
import ExcelLab from './modules/ExcelLab';
import ProductAnalytics from './modules/ProductAnalytics';
import DataGrid from './modules/DataGrid';
import DataCleaning from './modules/DataCleaning';
import Projects from './modules/Projects';
import Settings from './modules/Settings';

export const NAV = [
  {
    group: 'Get started',
    items: [
      { id: 'start', label: 'Start Here', tagline: 'Your tour of the planning loop', icon: Compass, component: StartHere },
      { id: 'upload', label: 'Upload Data', tagline: 'Your files, ready in seconds', icon: UploadCloud, component: UploadCenter },
    ],
  },
  {
    group: 'Workforce Planning',
    items: [
      { id: 'hub', label: 'Planning Hub', tagline: 'Every program at a glance', icon: Gauge, component: PlanningHub },
      { id: 'forecast', label: 'Demand Forecast', tagline: 'Know the volume before it arrives', icon: TrendingUp, component: DemandForecast },
      { id: 'capacity', label: 'Capacity & Headcount', tagline: 'The right people, at the right time', icon: Users, component: CapacityPlanner },
      { id: 'intraday', label: 'Intraday Staffing', tagline: 'Hour by hour, queue by queue', icon: Clock, component: IntradayStaffing },
      { id: 'budget', label: 'Budget & OP', tagline: 'Cost that lands on plan', icon: Wallet, component: BudgetPlanner },
      { id: 'scenarios', label: 'Scenarios & Risks', tagline: 'Stress test the plan before the peak', icon: ShieldAlert, component: ScenarioRisk },
      { id: 'kpis', label: 'Planning KPIs', tagline: 'How well did we plan', icon: Activity, component: PlanningKPIs },
    ],
  },
  {
    group: 'Analytics',
    items: [
      { id: 'dashboard', label: 'Sales Dashboard', tagline: 'Revenue, fulfilment and alerts', icon: LayoutDashboard, component: Dashboard },
      { id: 'product', label: 'Product Analytics', tagline: 'Growth, retention and experiments', icon: LineChartIcon, component: ProductAnalytics },
      { id: 'sql', label: 'SQL Lab', tagline: 'Ask your data anything', icon: Database, component: SqlLab },
      { id: 'excel', label: 'Excel Lab', tagline: 'Formulas, pivots and practice', icon: FileSpreadsheet, component: ExcelLab },
      { id: 'grid', label: 'Data Grid', tagline: 'Edit like a spreadsheet', icon: Table, component: DataGrid },
      { id: 'cleaning', label: 'Data Cleaning', tagline: 'Clean data, honest numbers', icon: Brush, component: DataCleaning },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { id: 'projects', label: 'Workboard', tagline: 'Deliverables on track', icon: Kanban, component: Projects },
      { id: 'settings', label: 'Settings', tagline: 'Make it yours', icon: SettingsIcon, component: Settings },
    ],
  },
];
const ALL_ITEMS = NAV.flatMap(g => g.items.map(i => ({ ...i, group: g.group })));

const NavItem = ({ icon: Icon, label, active, expanded, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={expanded ? undefined : label}
    aria-current={active ? 'page' : undefined}
    className={`w-full flex items-center px-3 py-2 rounded-xl transition-colors duration-150 ${
      active ? 'bg-white text-slate-900 shadow-soft font-medium' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
    } ${expanded ? 'gap-3' : 'justify-center'}`}
  >
    <Icon size={17} aria-hidden="true" className={active ? 'text-blue-600' : ''} />
    {expanded && <span className="text-sm truncate">{label}</span>}
  </button>
);

// Screens that read the orders table wait for the user's saved orders to
// load, so the demo sample never flashes in front of their own data.
const ORDER_SCREENS = ['dashboard', 'product', 'sql', 'excel', 'grid', 'cleaning'];

const Shell = ({ user, onLogout }) => {
  const { plan, ordersSource, ordersReady, orders } = useWorkspace();
  const [active, setActive] = usePersistentState('active_module', 'start');
  const { notify } = useToast();
  const warnedFull = useRef(false);
  useEffect(() => {
    const onFull = () => {
      if (warnedFull.current) return;
      warnedFull.current = true;
      notify('Browser storage is full\nYour latest changes work now but may not survive a reload\nDownload a backup in Settings, or delete large uploads you no longer need', 'warning');
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
    <div className="flex h-screen bg-[#f5f3ef] font-sans text-slate-900 overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}
      <aside
        className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'} fixed lg:static inset-y-0 left-0 bg-beige-100/95 backdrop-blur-xl border-r border-black/[0.06] text-slate-700 transition-all duration-200 flex flex-col z-30`}
        aria-label="Main navigation"
      >
        <div className="h-16 flex items-center justify-center shrink-0">
          <div className="flex items-center gap-2.5 font-semibold text-slate-900 tracking-tight">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-beige-300 to-beige-500 shadow-soft flex items-center justify-center ring-1 ring-black/5"><span className="text-white text-base font-bold">W</span></div>
            {sidebarOpen && <span className="text-xl">WorkX</span>}
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-5 overflow-y-auto">
          {NAV.map(group => (
            <div key={group.group}>
              {sidebarOpen && <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.group}</div>}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.id} icon={item.icon} label={item.label} active={current.id === item.id} expanded={sidebarOpen} onClick={() => go(item.id)} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-black/[0.06]">
          <button type="button" onClick={onLogout} className={`flex items-center w-full px-3 py-2 rounded-xl hover:bg-white/60 text-slate-600 hover:text-rose-700 transition-colors ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <LogOut size={18} aria-hidden="true" />
            {sidebarOpen && <span className="text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 bg-white/70 backdrop-blur-xl border-b border-black/[0.06] flex items-center justify-between px-4 md:px-8 z-10 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" aria-label="Toggle navigation" onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-full hover:bg-black/5 text-slate-600">
              <Menu size={18} />
            </button>
            <span className="text-sm text-slate-500 truncate">{current.group}</span>
          </div>
          <div className="flex items-center gap-3">
            {ordersReady && ordersSource === 'demo' && ORDER_SCREENS.includes(current.id) && (
              <button
                type="button"
                onClick={() => go('upload')}
                title={'You are exploring the simulated sample\nUpload your own orders to replace it'}
                className="px-3 py-1 bg-beige-200/80 hover:bg-beige-300/80 text-beige-900 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
              >
                Sample data · {Math.round(orders.length / 1000)}k orders
              </button>
            )}
            {weeks.length > 0 && (
              <div className="hidden md:block px-3 py-1 bg-beige-100 text-slate-700 rounded-full text-xs font-medium whitespace-nowrap">
                Plan horizon: wk {weeks[0]} → {weeks[weeks.length - 1]}
              </div>
            )}
            <div className="flex items-center gap-3 pl-3 border-l border-black/[0.08]">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{user.name || user.email}</div>
                <div className="text-xs text-slate-500">Analyst</div>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-beige-300 to-beige-500 rounded-full text-white flex items-center justify-center font-semibold text-sm ring-1 ring-black/5">
                {initials}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-10">
          <div className="max-w-[1400px] mx-auto">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">{current.label}</h1>
            {current.tagline && <p className="text-xl md:text-2xl font-semibold text-slate-400 mt-1 tracking-tight">{current.tagline}</p>}
          </div>
          <HelpBox moduleId={current.id} onNavigate={go} />
          <ErrorBoundary resetKey={current.id}>
            {ORDER_SCREENS.includes(current.id) && !ordersReady ? (
              <div role="status" className="space-y-4 animate-pulse" aria-label="Loading your orders">
                <div className="h-24 rounded-2xl bg-white/70" />
                <div className="h-72 rounded-2xl bg-white/70" />
              </div>
            ) : <Module onNavigate={go} />}
          </ErrorBoundary>
          </div>
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
