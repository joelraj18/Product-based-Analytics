import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Scatter
} from 'recharts';
import { 
  LayoutDashboard, Database, Table, Kanban, Settings, Plus, 
  Search, Save, Trash2, Download, Upload, Play, RefreshCw, 
  ChevronDown, ChevronUp, Filter, MoreVertical, FileText, 
  CheckCircle, AlertCircle, Clock, DollarSign, Package,
  ArrowLeft, Calendar, Tag, Brush, Sparkles, WashingMachine, CalendarClock, Calculator, ToggleLeft, BarChart3, Sigma
} from 'lucide-react';

/**
 * WorkX - Business Intelligence & Project Management Suite
 * Designed for High-Performance Business Analysts
 * * Features:
 * 1. Analytics Dashboard (Visualization)
 * 2. SQL Lab (Query Simulation)
 * 3. Smart Grid (Excel-like Data Manipulation)
 * 4. Project Tracker (Kanban/Task Management)
 * 5. Local Storage Persistence
 */

// --- MOCK DATA GENERATORS (Seeding the Local Database) ---

const SEED_DATA = {
  orders: Array.from({ length: 50 }, (_, i) => ({
    id: `ORD-${1000 + i}`,
    date: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString().split('T')[0],
    amount: Math.floor(Math.random() * 500) + 50,
    status: ['Shipped', 'Pending', 'Delivered', 'Cancelled'][Math.floor(Math.random() * 4)],
    region: ['NA', 'EU', 'APAC', 'LATAM'][Math.floor(Math.random() * 4)],
    fulfillment_center: `FC-${Math.floor(Math.random() * 10) + 1}`
  })),
  inventory: Array.from({ length: 20 }, (_, i) => ({
    sku: `SKU-${500 + i}`,
    name: `Product ${String.fromCharCode(65 + i)}`,
    stock: Math.floor(Math.random() * 1000),
    reorder_point: 100,
    category: ['Electronics', 'Home', 'Apparel'][Math.floor(Math.random() * 3)]
  })),
  projects: [
    { id: 1, title: 'Q4 Supply Chain Optimization', status: 'In Progress', priority: 'High', owner: 'Analyst A', due: '2025-12-01' },
    { id: 2, title: 'MCF Revenue Analysis', status: 'To Do', priority: 'Medium', owner: 'Analyst B', due: '2025-11-15' },
    { id: 3, title: 'Inventory API Integration', status: 'Done', priority: 'High', owner: 'Dev Team', due: '2025-10-30' }
  ],
  tasks: [
    { id: 'T-1', projectId: 1, content: 'Analyze route efficiency', status: 'In Progress', tag: 'Analytics' },
    { id: 'T-2', projectId: 1, content: 'Draft SQL queries for FC data', status: 'To Do', tag: 'Technical' },
    { id: 'T-3', projectId: 2, content: 'Visualize monthly recurring revenue', status: 'Done', tag: 'Viz' }
  ]
};

// --- UTILITY COMPONENTS ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, type = 'default' }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700'
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.default}`}>
      {children}
    </span>
  );
};

// --- HELPERS ---
const INR_RATE = 84.5; // Current Approx Rate
const formatINR = (val) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val * INR_RATE);

// --- IMPROVED HELPER: ROBUST CSV PARSER ---
const parseCSV = (text) => {
  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  // Regex to match: quoted strings OR non-comma sequences
  // This fixes the "Comma in Quotes" bug
  const parseLine = (line) => {
    const regex = /("(?:[^"]|"")*"|[^,]+)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      // Remove surrounding quotes and unescape double quotes
      let val = match[1].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      matches.push(val);
    }
    return matches;
  };

  const headers = parseLine(lines[0]);
  
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    return headers.reduce((obj, header, index) => {
      // Ensure we don't map undefined values if row is short
      obj[header] = values[index] || ''; 
      return obj;
    }, {});
  });
};

// ==========================================
// NEW MODULE: AUTHENTICATION (Login/Register)
// ==========================================
const AuthModule = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Joel Raj',
    email: 'vjoelraj1823@gmail.com',
    password: ''
  });
  const [error, setError] = useState('');

  // Handle Input Changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle Form Submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      return setError("Please fill in all fields");
    }

    if (isRegistering) {
      // REGISTER LOGIC
      if (!formData.name) return setError("Name is required");
      
      const newUser = { 
        name: formData.name, 
        email: formData.email, 
        password: formData.password 
      };
      
      // Save to Local Storage (Simulating DB)
      localStorage.setItem('workx_user_' + formData.email, JSON.stringify(newUser));
      localStorage.setItem('workx_current_user', JSON.stringify(newUser));
      
      onLogin(newUser);
    } else {
      // LOGIN LOGIC
      // 1. Check if user exists in Local Storage
      const storedUser = localStorage.getItem('workx_user_' + formData.email);
      
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.password === formData.password) {
          localStorage.setItem('workx_current_user', JSON.stringify(user));
          onLogin(user);
        } else {
          setError("Invalid password");
        }
      } else {
        // Fallback for the very first run (Auto-register if matching default)
        if(formData.email === 'vjoelraj1823@gmail.com') {
             const defaultUser = { name: 'Joel Raj', email: formData.email };
             localStorage.setItem('workx_current_user', JSON.stringify(defaultUser));
             onLogin(defaultUser);
        } else {
           setError("User not found. Please register.");
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/50">
            <span className="text-2xl font-bold text-white">W</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">WorkX</h2>
          <p className="text-slate-400 text-sm mt-2">Enterprise Analytics Suite</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {isRegistering ? "Create Account" : "Welcome Back"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input 
                  type="text" name="name" 
                  value={formData.name} onChange={handleChange}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-500 transition-all"
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
              <input 
                type="email" name="email" 
                value={formData.email} onChange={handleChange}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-500 transition-all"
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
              <input 
                type="password" name="password" 
                value={formData.password} onChange={handleChange}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle size={16}/> {error}
              </div>
            )}

            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-200 transition-all">
              {isRegistering ? "Register" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {isRegistering ? "Already have an account? " : "New to WorkX? "}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }} 
              className="text-blue-600 font-bold hover:underline"
            >
              {isRegistering ? "Sign In" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION COMPONENT ---
const WorkX = () => {

  const [user, setUser] = useState(null);

  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardConfig, setDashboardConfig] = useState({
    dateCol: 'date',
    valCol: 'amount',
    statusCol: 'status',
    catCol: 'region'
  });

  // GLOBAL STATE (The Source of Truth)
  const [globalData, setGlobalData] = useState([]);
  
  // Global History for SQL
  const [sqlHistory, setSqlHistory] = useState([]);
  
  // 1. Check for Session & Data on Load
  useEffect(() => {
    // Check Auth
    const storedUser = localStorage.getItem('workx_current_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Load Data
    const storedOrders = localStorage.getItem('workx_db_orders');
    if (storedOrders) {
      setGlobalData(JSON.parse(storedOrders));
    } else {
      setGlobalData(SEED_DATA.orders);
      localStorage.setItem('workx_db_orders', JSON.stringify(SEED_DATA.orders));
    }
  }, []);

  // Update LocalStorage whenever Global Data changes (Persistence)
  const updateGlobalData = (newData) => {
    setGlobalData(newData);
    localStorage.setItem('workx_db_orders', JSON.stringify(newData));
  };

  const handleLogout = () => {
    localStorage.removeItem('workx_current_user');
    setUser(null);
  };

  // --- CONDITIONAL RENDER: AUTH SCREEN ---
  if (!user) {
    return <AuthModule onLogin={setUser} />;
  }

  const Modules = {
    // PASSING PROPS IS KEY HERE
    dashboard: <DashboardModule 
                data={globalData} 
                config={dashboardConfig} 
                setConfig={setDashboardConfig} 
               />, 
    sql: <SqlLabModule data={globalData} history={sqlHistory} addToHistory={setSqlHistory} />,
    grid: <DataGridModule data={globalData} onUpdateData={updateGlobalData} />, 
    cleaning: <DataCleaningModule data={globalData} onUpdateData={updateGlobalData} />,
    projects: <ProjectBoardModule />,
    settings: <SettingsModule />
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col shadow-xl z-20`}>
        {/* ... Sidebar Header ... */}
         <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <div className="flex items-center space-x-2 font-bold text-white tracking-wider">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">W</span>
            </div>
            {sidebarOpen && <span className="text-xl">WorkX</span>}
          </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          <NavItem 
            icon={<Brush size={20} />} 
            label="Data Cleaning" 
            active={activeModule === 'cleaning'} 
            expanded={sidebarOpen} 
            onClick={() => setActiveModule('cleaning')} 
          />
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeModule === 'dashboard'} 
            expanded={sidebarOpen}
            onClick={() => setActiveModule('dashboard')} 
          />
          <NavItem 
            icon={<Database size={20} />} 
            label="SQL Lab" 
            active={activeModule === 'sql'} 
            expanded={sidebarOpen}
            onClick={() => setActiveModule('sql')} 
          />
          <NavItem 
            icon={<Table size={20} />} 
            label="Data Grid" 
            active={activeModule === 'grid'} 
            expanded={sidebarOpen}
            onClick={() => setActiveModule('grid')} 
          />
          <NavItem 
            icon={<Kanban size={20} />} 
            label="Projects" 
            active={activeModule === 'projects'} 
            expanded={sidebarOpen}
            onClick={() => setActiveModule('projects')} 
          />
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-800">
           <button onClick={handleLogout} className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-800 text-rose-400 transition-colors">
            <ToggleLeft size={20} />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => setActiveModule('settings')}
            className={`flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-800 transition-colors ${activeModule === 'settings' ? 'bg-slate-800 text-white' : ''}`}
          >
            <Settings size={20} />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center text-slate-500">
            <h2 className="text-lg font-semibold text-slate-800 uppercase tracking-wide">
              {activeModule.replace('-', ' ')}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
             <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
               {globalData.length} Records Loaded
             </div>
             {/* USER PROFILE SECTION */}
             <div className="flex items-center gap-3 pl-4 border-l">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-bold text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500">Admin</div>
                </div>
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full text-white flex items-center justify-center font-bold shadow-lg shadow-blue-200">
                  {user.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50 scroll-smooth">
          {Modules[activeModule]}
        </div>
      </main>
    </div>
  );
};

// --- SUB-COMPONENT: SIDEBAR ITEM ---
const NavItem = ({ icon, label, active, expanded, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center p-3 rounded-lg transition-all duration-200
      ${active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
      }
      ${!expanded ? 'justify-center' : 'space-x-3'}
    `}
  >
    {icon}
    {expanded && <span className="font-medium text-sm">{label}</span>}
  </button>
);

// ==========================================
// MODULE 1: DASHBOARD (Interactive Analytics)
// ==========================================
// ==========================================
// MODULE 1: DASHBOARD (Enhanced & Persistent)
// ==========================================
const DashboardModule = ({ data, config, setConfig }) => {
  const [drillDown, setDrillDown] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [showConfig, setShowConfig] = useState(false);

  // 1. DYNAMIC COLUMNS
  const columns = useMemo(() => data.length > 0 ? Object.keys(data[0]) : [], [data]);

  // 2. PREPARE DATA (Monthly Grouping)

  const processedData = useMemo(() => {
    return data.map(row => {
      const d = new Date(row[config.dateCol]);
      const isValid = !isNaN(d.getTime());
      return {
        ...row,
        // Keep YYYY-MM for sorting so the order stays correct (Jan, Feb, Mar...)
        _monthKey: isValid ? d.toISOString().slice(0, 7) : 'Unknown', 
        
        // CHANGE: Show only Month Name (Jan, Feb, Mar)
        _monthLabel: isValid ? d.toLocaleString('default', { month: 'short' }) : 'Unknown' 
      };
    });
  }, [data, config]);

  // 3. APPLY MONTH FILTER
  const filteredData = useMemo(() => {
    if (selectedMonth === 'All') return processedData;
    return processedData.filter(d => d._monthKey === selectedMonth);
  }, [processedData, selectedMonth]);

  // 4. CHART DATA (Grouped by Month)
  const chartData = useMemo(() => {
    const agg = {};
    // Aggregate based on the Filtered Data
    filteredData.forEach(d => {
      if (d._monthKey === 'Unknown') return;
      if (!agg[d._monthKey]) {
        agg[d._monthKey] = { 
          name: d._monthLabel, 
          sort: d._monthKey, // Keep YYYY-MM for sorting
          revenue: 0 
        };
      }
      agg[d._monthKey].revenue += (Number(d[config.valCol]) || 0);
    });
    // Return sorted by date
    return Object.values(agg).sort((a, b) => a.sort.localeCompare(b.sort));
  }, [filteredData, config]);

  // 5. METRICS & GROWTH CALCULATOR (UPDATED)
  const metrics = useMemo(() => {
    if (!processedData.length) return { totalRev: 0, shipped: 0, pending: 0, avgVal: 0, growth: 0, shippedGrowth: 0, pendingGrowth: 0 };

    // A. Current Metrics (Totals based on Selection)
    const totalRev = filteredData.reduce((sum, item) => sum + (Number(item[config.valCol]) || 0), 0);
    const shipped = filteredData.filter(i => String(i[config.statusCol]).toLowerCase().includes('ship') || String(i[config.statusCol]).toLowerCase().includes('done')).length;
    const pending = filteredData.filter(i => String(i[config.statusCol]).toLowerCase().includes('pending')).length;
    const avgVal = filteredData.length > 0 ? Math.floor(totalRev / filteredData.length) : 0;

    // B. Growth Logic (% vs Previous Month)
    const allMonths = [...new Set(processedData.map(d => d._monthKey))].sort();
    
    // Determine "Current" (Base for comparison)
    let currentMonthKey = selectedMonth;
    if (selectedMonth === 'All') {
      currentMonthKey = allMonths[allMonths.length - 1]; // Use last available month
    }

    const prevMonthIndex = allMonths.indexOf(currentMonthKey) - 1;
    let growth = 0;
    let shippedGrowth = 0; // New
    let pendingGrowth = 0; // New

    if (prevMonthIndex >= 0) {
      const prevMonthKey = allMonths[prevMonthIndex];
      
      // Get Data Slices for Comparison
      const currentSlice = processedData.filter(d => d._monthKey === currentMonthKey);
      const prevSlice = processedData.filter(d => d._monthKey === prevMonthKey);

      // 1. Revenue Growth
      const currentSum = currentSlice.reduce((s, i) => s + (Number(i[config.valCol])||0), 0);
      const prevSum = prevSlice.reduce((s, i) => s + (Number(i[config.valCol])||0), 0);
      if(prevSum > 0) growth = ((currentSum - prevSum) / prevSum) * 100;

      // 2. Shipped Growth
      const curShip = currentSlice.filter(i => String(i[config.statusCol]).toLowerCase().includes('ship') || String(i[config.statusCol]).toLowerCase().includes('done')).length;
      const preShip = prevSlice.filter(i => String(i[config.statusCol]).toLowerCase().includes('ship') || String(i[config.statusCol]).toLowerCase().includes('done')).length;
      if(preShip > 0) shippedGrowth = ((curShip - preShip) / preShip) * 100;

      // 3. Pending Growth
      const curPend = currentSlice.filter(i => String(i[config.statusCol]).toLowerCase().includes('pending')).length;
      const prePend = prevSlice.filter(i => String(i[config.statusCol]).toLowerCase().includes('pending')).length;
      if(prePend > 0) pendingGrowth = ((curPend - prePend) / prePend) * 100;
    }

    return { 
      totalRev, shipped, pending, avgVal, 
      growth: growth.toFixed(1),
      shippedGrowth: shippedGrowth.toFixed(1),
      pendingGrowth: pendingGrowth.toFixed(1)
    };
  }, [filteredData, processedData, config, selectedMonth]);

  // --- RENDER CONFIGURATION UI ---
  const ConfigSection = () => (
    <Card className="mb-6 p-4 border-blue-200 bg-blue-50">
      <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setShowConfig(!showConfig)}>
        <h3 className="font-bold text-blue-800 flex items-center gap-2">
          <Settings size={16}/> Dashboard Configuration
        </h3>
        <ChevronDown size={16} className={`text-blue-600 transition-transform ${showConfig ? 'rotate-180' : ''}`}/>
      </div>
      {showConfig && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
          <div>
            <label className="text-xs font-bold text-blue-600 uppercase">Date Column</label>
            <select className="w-full mt-1 p-2 rounded border border-blue-200 text-sm" 
              value={config.dateCol} onChange={e => setConfig({...config, dateCol: e.target.value})}>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-blue-600 uppercase">Value Column</label>
            <select className="w-full mt-1 p-2 rounded border border-blue-200 text-sm"
              value={config.valCol} onChange={e => setConfig({...config, valCol: e.target.value})}>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
             <label className="text-xs font-bold text-blue-600 uppercase">Status Column</label>
             <select className="w-full mt-1 p-2 rounded border border-blue-200 text-sm"
               value={config.statusCol} onChange={e => setConfig({...config, statusCol: e.target.value})}>
               {columns.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
           </div>
        </div>
      )}
    </Card>
  );

  if (drillDown) {
    // DRILL DOWN LOGIC
    let drillData = [];
    if(drillDown === 'revenue') drillData = [...filteredData].sort((a,b) => b[config.valCol] - a[config.valCol]);
    if(drillDown === 'orders') drillData = filteredData.filter(i => String(i[config.statusCol]).toLowerCase().includes('ship'));
    if(drillDown === 'pending') {
      drillData = filteredData.filter(i => String(i[config.statusCol]).toLowerCase().includes('pending'));
   }
    
    // NEW LOGIC: Top 50 Values
    if(drillDown === 'top_values') drillData = [...filteredData].sort((a,b) => (Number(b[config.valCol])||0) - (Number(a[config.valCol])||0)).slice(0, 50);
    
    // Logic: Click on Month Chart
    if(drillDown.startsWith('month_')) {
       const mLabel = drillDown.replace('month_', '');
       drillData = filteredData.filter(d => d._monthLabel === mLabel);
    }

    return (
      <div className="space-y-4 h-full flex flex-col">
        <div className="flex justify-between items-center">
          <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <div className="text-sm font-bold text-slate-500 uppercase">
             Viewing: {drillDown.replace('_', ' ')} ({drillData.length} records)
          </div>
        </div>
        
        {/* TALLER TABLE CONTAINER (Fixed height issue) */}
        <Card className="flex-1 overflow-hidden h-[80vh] shadow-xl border-t-4 border-t-blue-500">
          <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>{columns.map(c => <th key={c} className="p-4 font-bold text-slate-600 uppercase text-xs tracking-wider">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drillData.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50 transition-colors">
                    {columns.map(c => <td key={c} className="p-3 text-slate-700 whitespace-nowrap">{row[c]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* HEADER WITH MONTH FILTER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Analytics Overview</h2>
        
        <div className="flex gap-2">
           <select 
             className="p-2 border border-slate-300 rounded-lg text-sm bg-white shadow-sm focus:outline-blue-500 font-medium"
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
           >
             <option value="All">All Months</option>
             {/* Get unique months for dropdown */}
             {[...new Set(processedData.map(d => d._monthKey))].sort().filter(m => m!=='Unknown').map(m => (
               <option key={m} value={m}>{m}</option>
             ))}
           </select>
           <button onClick={() => setShowConfig(!showConfig)} className="p-2 bg-white border rounded shadow-sm hover:bg-slate-50">
              <Settings size={20} className="text-slate-600"/>
           </button>
        </div>
      </div>

      {showConfig && <ConfigSection />}
      
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div onClick={() => setDrillDown('revenue')} className="cursor-pointer group">
          <KPICard 
            title="Total Revenue" 
            value={formatINR(metrics.totalRev)} 
            trend={`${metrics.growth}%`} 
            isPositive={Number(metrics.growth) >= 0}
            icon={<DollarSign className="text-emerald-500" />} 
          />
        </div>
        <div onClick={() => setDrillDown('orders')} className="cursor-pointer group">
          <KPICard 
            title="Shipped / Done" 
            value={metrics.shipped} 
            trend={`${metrics.shippedGrowth}%`} // Updated
            isPositive={Number(metrics.shippedGrowth) >= 0} 
            icon={<CheckCircle className="text-blue-500" />} 
          />
        </div>
        <div onClick={() => setDrillDown('pending')} className="cursor-pointer group">
          <KPICard 
            title="Pending" 
            value={metrics.pending} 
            trend={`${metrics.pendingGrowth}%`} // Updated
            // Logic: If pending grew (+), it's bad (false). If pending dropped (-), it's good (true).
            isPositive={Number(metrics.pendingGrowth) <= 0} 
            icon={<Clock className="text-amber-500" />} 
          />
        </div>
        {/* Clickable Avg Value */}
        <div onClick={() => setDrillDown('top_values')} className="cursor-pointer group">
          <KPICard title="Avg Order Value" value={formatINR(metrics.avgVal)} trend="Top 50" isPositive={true} icon={<Package className="text-indigo-500" />} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
         <Card className="col-span-2 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4">Revenue Trend (Monthly)</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} onClick={(e) => {
                   if(e && e.activePayload) {
                     // Filter Drilldown by Month Label
                     setDrillDown(`month_${e.activePayload[0].payload.name}`);
                   }
                }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                  <XAxis dataKey="name" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 11}} axisLine={false} tickLine={false} tickFormatter={(val)=> `₹${val/1000}k`} />
                  <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
         </Card>
         <Card className="col-span-1 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4">Status Distribution</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={[
                    { name: 'Shipped', value: metrics.shipped },
                    { name: 'Pending', value: metrics.pending }
                  ]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                     <Cell fill="#3b82f6" /><Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
         </Card>
      </div>
    </div>
  );
};

// UPDATE KPI CARD Helper to accept 'isPositive' prop
const KPICard = ({ title, value, trend, isPositive, icon }) => (
  <Card className="p-5 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500 h-full">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 mt-2">{value}</h4>
      </div>
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm group-hover:bg-white transition-colors">
        {icon}
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <span className={`${isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded font-bold text-xs flex items-center gap-1`}>
        {isPositive ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {trend}
      </span>
      <span className="text-slate-400 ml-2 text-xs">vs last month</span>
    </div>
  </Card>
);
  // ==========================================
  // MODULE 2: SQL LAB (Professional SQL Engine)
  // ==========================================
  const SqlLabModule = ({ data, history, addToHistory }) => {
    const [query, setQuery] = useState('SELECT * FROM orders LIMIT 5');
    const [results, setResults] = useState([]);
    const [message, setMessage] = useState('');
    const [isEngineReady, setIsEngineReady] = useState(false);
    const [tables, setTables] = useState({});

    // 1. Initialize SQL Engine & Prepare Tables
    useEffect(() => {
      // Define available tables (Live Data + Seeds for Joins)
      const db = {
        orders: data, // The live edited data
        inventory: SEED_DATA.inventory, // From your mock generator
        projects: SEED_DATA.projects    // From your mock generator
      };
      setTables(db);

      // Dynamically load AlaSQL if not present
      if (!window.alasql) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/alasql@4.4.0/dist/alasql.min.js";
        script.async = true;
        script.onload = () => setIsEngineReady(true);
        script.onerror = () => setMessage("Failed to load SQL Engine. Check internet.");
        document.body.appendChild(script);
      } else {
        setIsEngineReady(true);
      }
    }, [data]);

    const runQuery = () => {
      setMessage('');
      if (!isEngineReady) return setMessage("SQL Engine is initializing...");

      try {
        // 2. Execute Query against the 'tables' object
        // syntax: alasql(sql, [paramsObj])
        const res = window.alasql(query, [tables]);
        
        setResults(Array.isArray(res) ? res : [res]); // Handle scalar results
        setMessage(`Query executed successfully. ${Array.isArray(res) ? res.length + ' rows.' : ''}`);
        addToHistory(prev => [{ query, time: new Date().toLocaleTimeString(), status: 'success' }, ...prev]);
      } catch (e) {
        console.error(e);
        setMessage(`SQL Error: ${e.message}`);
      }
    };

    const insertSnippet = (snippet) => {
      setQuery(prev => prev + " " + snippet);
    };

    return (
      <div className="flex h-[calc(100vh-140px)] gap-4">
        {/* SIDEBAR: SCHEMA & CHEATSHEET */}
        <div className="w-64 bg-white border rounded-xl shadow-sm hidden md:flex flex-col overflow-hidden">
          <div className="p-3 bg-slate-100 border-b font-bold text-slate-700 flex items-center gap-2">
              <Database size={14}/> Database Schema
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-4 custom-scrollbar">
            {Object.entries(tables).map(([tableName, rows]) => (
              <div key={tableName}>
                <div className="text-xs font-bold text-blue-800 uppercase mb-1 flex items-center gap-1">
                  <Table size={12}/> {tableName} <span className="text-slate-400">({rows?.length})</span>
                </div>
                <div className="pl-2 border-l-2 border-slate-100 space-y-1">
                  {rows.length > 0 && Object.keys(rows[0]).map(col => (
                    <div key={col} 
                          className="text-xs text-slate-500 cursor-pointer hover:text-blue-600 hover:bg-slate-50 px-1 rounded flex justify-between"
                          onClick={() => insertSnippet(col)}
                    >
                      <span>{col}</span>
                      <span className="text-[10px] text-slate-300">{typeof rows[0][col]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="border-t pt-3 mt-2">
              <div className="text-xs font-bold text-slate-700 uppercase mb-2">Snippets</div>
              <div className="flex flex-wrap gap-2">
                {['SELECT', 'WHERE', 'GROUP BY', 'JOIN', 'COUNT()', 'DATEDIFF()', 'CASE WHEN', 'ROW_NUMBER()', 'WITH'].map(k => (
                  <span key={k} onClick={() => insertSnippet(k)} 
                        className="px-2 py-1 bg-slate-100 text-[10px] rounded cursor-pointer hover:bg-blue-100 text-slate-600 font-mono">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN EDITOR AREA */}
        <div className="flex-1 flex flex-col gap-4">
          <Card className="flex flex-col h-1/2 shadow-md border-indigo-100">
            <div className="p-2 bg-slate-50 border-b flex justify-between items-center rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">SQL Editor</span>
                {!isEngineReady && <span className="text-xs text-amber-500 flex items-center gap-1"><RefreshCw className="animate-spin" size={10}/> Loading Engine...</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setQuery("SELECT region, SUM(amount) as rev FROM orders GROUP BY region")} className="text-xs text-blue-600 hover:underline">Agg Ex</button>
                <button onClick={() => setQuery("SELECT * FROM orders o JOIN inventory i ON o.id = i.sku")} className="text-xs text-blue-600 hover:underline">Join Ex</button>
                <button onClick={runQuery} className="flex items-center gap-2 px-6 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold shadow-sm transition-colors">
                  <Play size={14} /> Run Query
                </button>
              </div>
            </div>
            <textarea 
              className="flex-1 p-4 font-mono text-sm bg-slate-900 text-blue-100 resize-none focus:outline-none custom-scrollbar leading-relaxed"
              value={query} 
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Write your SQL here... Try: SELECT * FROM orders"
            />
            {message && (
              <div className={`px-4 py-2 text-xs border-t font-mono ${message.includes('Error') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {message}
              </div>
            )}
          </Card>

          {/* RESULTS AREA */}
          <Card className="flex-1 overflow-hidden flex flex-col shadow-md">
            <div className="flex-1 overflow-auto">
              {results.length > 0 ? (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                    <tr>{Object.keys(results[0] || {}).map(k => (
                      <th key={k} className="px-4 py-3 border-b border-r last:border-r-0 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50">
                        {k}
                      </th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                        {Object.values(r).map((v, j) => (
                          <td key={j} className="px-4 py-2 border-b border-r last:border-r-0 text-slate-700 font-mono text-xs whitespace-nowrap">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Database size={48} className="mb-4 opacity-20"/>
                  <p>Run a query to view results</p>
                  <p className="text-xs opacity-60 mt-2">Supports JOINs, CTEs, Window Functions & Aggregations</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };
// ==========================================
// MODULE 3: DATA GRID (With Export)
// ==========================================
const DataGridModule = ({ data, onUpdateData }) => {
  const [columns, setColumns] = useState([]);
  const [page, setPage] = useState(1);
  const ROWS_PER_PAGE = 50;

  useEffect(() => {
    if(data.length > 0) setColumns(Object.keys(data[0]));
  }, [data]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvData = parseCSV(event.target.result);
        if (csvData.length > 0) {
          onUpdateData(csvData);
          setPage(1);
          alert(`Synced ${csvData.length} records.`);
        }
      } catch (err) { alert("Error parsing CSV."); }
    };
    reader.readAsText(file);
  };

  // --- NEW: EXPORT CSV FUNCTION ---
  const downloadCSV = () => {
    if (!data.length) return alert("No data to export");
    
    // 1. Get Headers
    const headers = Object.keys(data[0]);
    
    // 2. Format CSV String
    const csvContent = [
      headers.join(','), // Header Row
      ...data.map(row => headers.map(fieldName => {
        // Handle commas in data by wrapping in quotes
        const val = row[fieldName] ? String(row[fieldName]).replace(/"/g, '""') : ''; 
        return `"${val}"`;
      }).join(','))
    ].join('\n');

    // 3. Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `workx_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentData = data.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const totalPages = Math.ceil(data.length / ROWS_PER_PAGE) || 1;

  return (
    <Card className="h-full flex flex-col shadow-lg">
      <div className="p-3 bg-slate-100 border-b flex justify-between items-center">
        <div className="font-bold text-slate-700 flex items-center gap-2">
          <Table size={16}/> Data Grid (Master)
        </div>
        <div className="flex gap-2">
          {/* EXPORT BUTTON */}
          <button 
            onClick={downloadCSV}
            className="flex items-center px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors"
          >
            <Download className="mr-1 w-3 h-3" /> Export CSV
          </button>
          
          <label className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 cursor-pointer transition-colors">
            <Upload className="mr-1 w-3 h-3" /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="min-w-full border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="w-10 bg-slate-100 border p-2 text-xs">#</th>
              {columns.map(col => (
                <th key={col} className="border p-2 text-left text-xs font-bold text-slate-700 bg-slate-100 uppercase">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                <td className="border p-2 text-center text-xs text-slate-500">{((page - 1) * ROWS_PER_PAGE) + rIdx + 1}</td>
                {columns.map(col => <td key={`${rIdx}-${col}`} className="border p-2 text-sm text-slate-700 whitespace-nowrap">{row[col]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* PAGINATION */}
      <div className="bg-slate-100 border-t p-2 text-xs flex justify-between items-center">
        <span className="font-medium text-slate-500">Total Records: {data.length}</span>
        <div className="flex gap-2 items-center">
          <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-1 hover:bg-slate-200 rounded disabled:opacity-50"><ChevronUp className="-rotate-90" size={14}/></button>
          <span className="font-mono">{page} / {totalPages}</span>
          <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-1 hover:bg-slate-200 rounded disabled:opacity-50"><ChevronDown className="-rotate-90" size={14}/></button>
        </div>
      </div>
    </Card>
  );
};

const FileSpreadsheetIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
)


// ==========================================
// MODULE 4: PROJECT BOARD (With Tag Selection)
// ==========================================
const ProjectBoardModule = () => {
  const [tasks, setTasks] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ content: '', tag: 'General', status: 'To Do' });

  useEffect(() => {
    const t = JSON.parse(localStorage.getItem('workx_tasks') || '[]');
    setTasks(t);
  }, []);

  const moveTask = (id, newStatus) => {
    const updated = tasks.map(t => t.id === id ? { ...t, status: newStatus } : t);
    setTasks(updated);
    localStorage.setItem('workx_tasks', JSON.stringify(updated));
  };

  const saveTask = () => {
    if(!newTask.content) return;
    const taskEntry = { 
      id: `T-${Date.now()}`, 
      projectId: 1, 
      ...newTask 
    };
    const updated = [...tasks, taskEntry];
    setTasks(updated);
    localStorage.setItem('workx_tasks', JSON.stringify(updated));
    setShowAddForm(false);
    setNewTask({ content: '', tag: 'General', status: 'To Do' });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Q Objectives</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all">
          <Plus size={18} /> {showAddForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {/* Add Task Form Area */}
      {showAddForm && (
        <Card className="mb-6 p-4 bg-blue-50 border-blue-100 animate-in slide-in-from-top-2">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Task Description</label>
              <input 
                type="text" 
                className="w-full mt-1 p-2 border border-slate-300 rounded focus:outline-blue-500"
                placeholder="E.g. Create SQL Query for Monthly Revenue"
                value={newTask.content}
                onChange={e => setNewTask({...newTask, content: e.target.value})}
              />
            </div>
            <div className="w-48">
              <label className="text-xs font-bold text-slate-500 uppercase">Tag / Category</label>
              <select 
                className="w-full mt-1 p-2 border border-slate-300 rounded focus:outline-blue-500"
                value={newTask.tag}
                onChange={e => setNewTask({...newTask, tag: e.target.value})}
              >
                <option>General</option>
                <option>Technical</option>
                <option>Analytics</option>
                <option>Visualization</option>
                <option>Finance</option>
              </select>
            </div>
            <button onClick={saveTask} className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">
              Save
            </button>
          </div>
        </Card>
      )}

      {/* Kanban Board */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {['To Do', 'In Progress', 'Done'].map(status => (
          <div key={status} className="flex flex-col bg-slate-100 rounded-xl border border-slate-200 h-full max-h-full">
            <div className={`p-4 font-bold text-sm uppercase tracking-wider border-b border-slate-200 flex justify-between items-center ${
              status === 'To Do' ? 'text-slate-600' : status === 'In Progress' ? 'text-blue-600' : 'text-emerald-600'
            }`}>
              {status}
              <span className="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm border border-slate-100">
                {tasks.filter(t => t.status === status).length}
              </span>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              {tasks.filter(t => t.status === status).map(task => (
                <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow group relative">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-slate-400">{task.id}</span>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                      task.tag === 'Technical' ? 'bg-purple-100 text-purple-700' :
                      task.tag === 'Analytics' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>{task.tag}</span>
                  </div>
                  <p className="text-slate-800 text-sm font-medium leading-relaxed">{task.content}</p>
                   <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                     {status !== 'To Do' && (
                       <button onClick={() => moveTask(task.id, 'To Do')} className="p-1 hover:bg-slate-100 rounded">
                         <ChevronUp size={14} className="rotate-[-90deg] text-slate-500"/>
                       </button>
                     )}
                     {status !== 'Done' && (
                       <button onClick={() => moveTask(task.id, status === 'To Do' ? 'In Progress' : 'Done')} className="p-1 hover:bg-slate-100 rounded">
                         <ChevronDown size={14} className="rotate-[-90deg] text-blue-500"/>
                       </button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};



// ==========================================
// MODULE: DATA CLEANING & ENRICHMENT
// ==========================================
// ==========================================
// MODULE: DATA CLEANING & ENRICHMENT (UPDATED)
// ==========================================
const DataCleaningModule = ({ data, onUpdateData }) => {
  // --- STATE ---
  const [targetCol, setTargetCol] = useState('');
  const [numCol, setNumCol] = useState(''); // New state for Numerical Column
  const [statusCol, setStatusCol] = useState('status'); // New state for Status Column
  const [deleteCol, setDeleteCol] = useState('');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [skewCol, setSkewCol] = useState('');
  const [skewResult, setSkewResult] = useState(null); // Stores the result message
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  // --- HEALTH STATS ---
  const stats = useMemo(() => {
    const totalCells = data.length * (data[0] ? Object.keys(data[0]).length : 0);
    let emptyCells = 0;
    data.forEach(row => Object.values(row).forEach(v => {
      if (!v || v === '' || v === 'null') emptyCells++;
    }));
    return { totalCells, emptyCells, cleanliness: 100 - Math.floor((emptyCells/totalCells)*100) };
  }, [data]);

  // --- LOGIC 1: RANDOM DATE GENERATOR ---
  const applyRandomDates = () => {
    if (!targetCol) return alert("Please enter a column name (e.g., 'delivery_date')");
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();
    const min = Math.min(startTs, endTs);
    const max = Math.max(startTs, endTs);

    const newData = data.map(row => {
      const randomTime = min + Math.random() * (max - min);
      const dateStr = new Date(randomTime).toISOString().split('T')[0];
      return { ...row, [targetCol]: row[targetCol] ? row[targetCol] : dateStr };
    });
    onUpdateData(newData);
    alert(`Enriched ${newData.length} rows with dates in '${targetCol}'`);
  };

  // --- LOGIC 2: NUMERICAL SANITIZATION (MEAN IMPUTATION) ---
  const sanitizeToMean = () => {
    if (!numCol) return alert("Please enter a column to sanitize.");

    // Helper: Removes symbols (₹, $) and commas, keeps only numbers, dots, and minus
    const cleanNumber = (val) => {
      if (!val) return NaN;
      const str = String(val).replace(/[^0-9.-]/g, ''); 
      return parseFloat(str);
    };

    // Step 1: Calculate Mean of existing VALID numbers (handling ₹ and ,)
    let sum = 0;
    let count = 0;
    data.forEach(row => {
      const val = cleanNumber(row[numCol]);
      if (!isNaN(val)) {
        sum += val;
        count++;
      }
    });
    
    // Avoid division by zero
    const mean = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;

    // Step 2: Replace values
    const newData = data.map(row => {
      const original = row[numCol];
      const val = cleanNumber(original);
      
      // logic: If it's a valid number (e.g. "₹399" -> 399), use the CLEAN number.
      // If it's text (e.g. "High" -> NaN), replace with MEAN.
      return {
        ...row,
        [numCol]: isNaN(val) ? mean : val 
      };
    });

    onUpdateData(newData);
    alert(`Sanitized '${numCol}'.\nCleaned symbols/commas.\nReplaced invalid text with Mean: ${mean}`);
  };
  // --- LOGIC 3: STATUS GENERATOR (RANDOM CATEGORY) ---
  const generateStatus = () => {
    const colName = statusCol || 'status';
    const options = ['Pending', 'Shipped'];

    const newData = data.map(row => ({
      ...row,
      // Randomly pick index 0 or 1
      [colName]: options[Math.floor(Math.random() * options.length)]
    }));

    onUpdateData(newData);
    alert(`Generated '${colName}' column with values: Pending / Shipped`);
  };

  // --- LOGIC 4: DEEP CLEAN (WHITESPACE) ---
  const runDeepClean = () => {
    const newData = data.map(row => {
      const newRow = {};
      Object.keys(row).forEach(key => {
        let val = row[key];
        if (typeof val === 'string') val = val.trim();
        newRow[key] = val;
      });
      return newRow;
    });
    onUpdateData(newData);
    alert("Deep Clean Complete: Whitespace trimmed.");
  };

  // --- LOGIC 5: REMOVE COLUMN ---
  const removeColumn = () => {
    if (!deleteCol) return alert("Please enter a column name to remove.");
    if (data.length > 0 && data[0][deleteCol] === undefined) {
      return alert(`Column '${deleteCol}' does not exist.`);
    }

    if (!window.confirm(`Are you sure you want to permanently delete the '${deleteCol}' column?`)) return;

    const newData = data.map(row => {
      const newRow = { ...row };
      delete newRow[deleteCol];
      return newRow;
    });

    onUpdateData(newData);
    setDeleteCol('');
    alert(`Column '${deleteCol}' removed successfully.`);
  };

  // --- HELPER: Clean currency/text to float ---
  const cleanNumber = (val) => {
    if (!val) return NaN;
    const str = String(val).replace(/[^0-9.-]/g, ''); 
    return parseFloat(str);
  };

  // --- LOGIC 6: CHECK SKEWNESS ---
  const checkSkewness = () => {
    if (!skewCol) return alert("Enter a column to check.");
    
    // 1. Extract valid numbers
    const values = data.map(r => cleanNumber(r[skewCol])).filter(n => !isNaN(n)).sort((a,b) => a - b);
    if(values.length < 2) return setSkewResult("Not enough data.");

    // 2. Calc Mean
    const mean = values.reduce((a,b) => a + b, 0) / values.length;

    // 3. Calc Median
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

    // 4. Calc Std Dev
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 5. Pearson's Second Skewness Coefficient: 3 * (Mean - Median) / StdDev
    const skew = stdDev === 0 ? 0 : (3 * (mean - median)) / stdDev;

    // 6. Recommendation
    let rec = "Symmetric (Use Mean)";
    if (skew > 1 || skew < -1) rec = "Highly Skewed (Use Median)";
    else if (skew > 0.5 || skew < -0.5) rec = "Moderately Skewed (Use Median)";

    setSkewResult(`Skew: ${skew.toFixed(2)} | ${rec}`);
  };

  // --- LOGIC 7: SANITIZE TO MEDIAN (For Skewed Data) ---
  const sanitizeToMedian = () => {
    if (!numCol) return alert("Enter column in the 'Sanitize' box.");
    
    // 1. Get Median
    const values = data.map(r => cleanNumber(r[numCol])).filter(n => !isNaN(n)).sort((a,b) => a - b);
    if(values.length === 0) return alert("No valid numbers found.");
    
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

    // 2. Replace
    const newData = data.map(row => {
      const val = cleanNumber(row[numCol]);
      return { ...row, [numCol]: isNaN(val) ? median : val };
    });

    onUpdateData(newData);
    alert(`Sanitized '${numCol}' to Median: ${median}`);
  };

  // --- LOGIC 8: SANITIZE TO MODE (For Categorical Data) ---
  const sanitizeToMode = () => {
    if (!statusCol) return alert("Enter column in the 'Category' box.");

    // 1. Frequency Map
    const counts = {};
    data.forEach(row => {
      const val = row[statusCol];
      // Ignore empty/null for mode calculation
      if (val && val !== 'null' && val !== '') {
        counts[val] = (counts[val] || 0) + 1;
      }
    });

    // 2. Find Mode
    let mode = '';
    let maxCount = 0;
    Object.entries(counts).forEach(([key, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mode = key;
      }
    });

    if(!mode) return alert("Could not determine mode (all empty?)");

    // 3. Replace
    const newData = data.map(row => ({
      ...row,
      [statusCol]: (!row[statusCol] || row[statusCol] === 'null' || row[statusCol] === '') ? mode : row[statusCol]
    }));

    onUpdateData(newData);
    alert(`Filled empty '${statusCol}' cells with Mode: '${mode}'`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Data Health Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center space-x-4 border-l-4 border-l-emerald-500">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><Sparkles size={24} /></div>
          <div>
            <h4 className="font-bold text-slate-700">Data Health Score</h4>
            <div className="text-2xl font-bold">{isNaN(stats.cleanliness) ? 100 : stats.cleanliness}%</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center space-x-4 border-l-4 border-l-blue-500">
           <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><WashingMachine size={24} /></div>
          <div>
            <h4 className="font-bold text-slate-700">Rows Loaded</h4>
            <div className="text-2xl font-bold">{data.length}</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Temporal Enrichment */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 text-blue-800 font-bold border-b pb-2">
            <CalendarClock size={20} /> Temporal Enrichment (Date Gen)
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Target Column</label>
              <input type="text" className="w-full p-2 border rounded mt-1" placeholder="e.g. order_date"
                value={targetCol} onChange={e => setTargetCol(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" className="w-full p-2 border rounded" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" className="w-full p-2 border rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button onClick={applyRandomDates} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center justify-center gap-2">
              <Sparkles size={16} /> Fill Dates
            </button>
            <div className="text-xs font-bold text-blue-600 uppercase mb-1">Current Table</div>

            {/* ADDED: A wrapper div to prevent columns from stretching full width or breaking layout */}
            <div className="flex flex-wrap gap-2 mt-2">
              {columns.map(c => (
                <div 
                  key={c} 
                  className="text-sm text-slate-500 py-0.5 px-2 hover:bg-slate-100 rounded cursor-pointer border border-transparent hover:border-slate-300 transition-colors" 
                  onClick={() => setTargetCol(c)}
                >
                  {c}
                </div>
              ))}
            </div>
                        
          </div>
        </Card>

        {/* 3. NEW: Transformation Rules (Numerical & Status) */}
        <Card className="p-6 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-2 mb-4 text-indigo-800 font-bold border-b pb-2">
            <Calculator size={20} /> Transformation Rules
          </div>
          <div className="space-y-6">
            
            {/* Logic 2: Numerical Mean Imputation */}
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 flex justify-between">
                <span>Sanitize to Mean</span>
                <span className="text-indigo-400 text-[10px]">Replaces Text/NaN</span>
              </label>
              <div className="flex gap-2 mt-1">
                <input type="text" className="flex-1 p-2 border rounded" placeholder="Column (e.g. amount)"
                  value={numCol} onChange={e => setNumCol(e.target.value)} />
                <button onClick={sanitizeToMean} className="px-4 bg-indigo-100 text-indigo-700 font-bold rounded hover:bg-indigo-200">
                  Fix
                </button>
              </div>
            </div>

            {/* Logic 3: Status Generator */}
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 flex justify-between">
                <span>Generate Category</span>
                <span className="text-purple-400 text-[10px]">Pending / Shipped</span>
              </label>
              <div className="flex gap-2 mt-1">
                <input type="text" className="flex-1 p-2 border rounded" placeholder="Column (e.g. status)"
                  value={statusCol} onChange={e => setStatusCol(e.target.value)} />
                <button onClick={generateStatus} className="px-4 bg-purple-100 text-purple-700 font-bold rounded hover:bg-purple-200 flex items-center gap-2">
                  <ToggleLeft size={16}/> Gen
                </button>
              </div>
            </div>

            {/* --- NEW SECTION: SKEWNESS CHECK --- */}
            <div className="pt-4 border-t border-indigo-100">
               <label className="text-xs font-bold uppercase text-slate-500">Distribution Check (Skewness)</label>
               <div className="flex gap-2 mt-1">
                 <input 
                   type="text" className="flex-1 p-2 border rounded text-sm" placeholder="Col (e.g. amount)"
                   value={skewCol} onChange={e => setSkewCol(e.target.value)}
                 />
                 <button onClick={checkSkewness} className="px-3 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-bold">
                   <BarChart3 size={16} />
                 </button>
               </div>
               {skewResult && <div className="mt-2 text-xs font-mono bg-slate-100 p-2 rounded text-slate-600 border border-slate-200">{skewResult}</div>}
            </div>

            {/* --- UPDATED: NUMERICAL SANITIZATION (MEAN OR MEDIAN) --- */}
            <div className="pt-4 border-t border-indigo-100">
              <label className="text-xs font-bold uppercase text-slate-500 flex justify-between">
                <span>Sanitize Numerical</span>
                <span className="text-indigo-400 text-[10px]">Text/NaN &rarr; Value</span>
              </label>
              <div className="flex gap-2 mt-1 mb-2">
                <input type="text" className="flex-1 p-2 border rounded" placeholder="Col (e.g. amount)"
                  value={numCol} onChange={e => setNumCol(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={sanitizeToMean} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100 border border-indigo-200">
                  Fix w/ Mean
                </button>
                <button onClick={sanitizeToMedian} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100 border border-blue-200 flex items-center justify-center gap-1">
                  <Sigma size={12}/> Fix w/ Median
                </button>
              </div>
            </div>

            {/* --- UPDATED: CATEGORICAL RULES (MODE OR RANDOM) --- */}
            <div className="pt-4 border-t border-indigo-100">
              <label className="text-xs font-bold uppercase text-slate-500 flex justify-between">
                <span>Sanitize Categorical</span>
                <span className="text-purple-400 text-[10px]">Empty &rarr; Value</span>
              </label>
              <div className="flex gap-2 mt-1 mb-2">
                <input type="text" className="flex-1 p-2 border rounded" placeholder="Col (e.g. status)"
                  value={statusCol} onChange={e => setStatusCol(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <button onClick={sanitizeToMode} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded hover:bg-purple-100 border border-purple-200">
                   Fill w/ Mode
                 </button>
                 <button onClick={generateStatus} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded hover:bg-purple-100 border border-purple-200">
                   Gen Random
                 </button>
              </div>
            </div>

          </div>
        </Card>

        {/* Logic 4: Remove Column */}
        <div className="pt-4 border-t border-indigo-100">
              <label className="text-xs font-bold uppercase text-rose-500 flex justify-between">
                <span>Remove Column</span>
                <span className="text-rose-300 text-[10px]">Destructive</span>
              </label>
              <div className="flex gap-2 mt-1">
                <input 
                  type="text" 
                  className="flex-1 p-2 border border-rose-200 rounded text-rose-900 placeholder-rose-300 focus:outline-rose-500" 
                  placeholder="Column (e.g. region)"
                  value={deleteCol} 
                  onChange={e => setDeleteCol(e.target.value)} 
                />
                <button 
                  onClick={removeColumn} 
                  className="px-4 bg-rose-100 text-rose-700 font-bold rounded hover:bg-rose-200 flex items-center gap-2"
                >
                  <Trash2 size={16}/> Drop
                </button>
              </div>
            </div>

        {/* 4. Deep Clean */}
        <Card className="p-6 col-span-1 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b pb-2">
            <Brush size={20} /> Deep Cleaning Operations
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
            <div>
               <h5 className="font-bold text-sm">Trim Whitespace</h5>
               <p className="text-xs text-slate-500">Removes leading/trailing spaces from all cells.</p>
            </div>
            <button onClick={runDeepClean} className="px-3 py-1 bg-white border shadow-sm rounded text-xs font-bold hover:bg-slate-50">Run</button>
          </div>
        </Card>
      </div>
    </div>
  );
};


// ==========================================
// MODULE 5: SETTINGS & TOOLS
// ==========================================
const SettingsModule = () => {
  const resetData = () => {
    if(window.confirm("Are you sure? This will wipe all local changes.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Application Data</h3>
        <p className="text-sm text-slate-500 mb-6">
          WorkX stores all data in your browser's Local Storage. 
          Use the controls below to manage your session data.
        </p>
        <div className="flex space-x-4">
          <button 
            onClick={resetData}
            className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={18} /> Factory Reset
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors">
            <Save size={18} /> Backup Local Data
          </button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">About WorkX</h3>
        <div className="prose text-sm text-slate-600">
          <p>
            Built for the Amazon ARCADE assessment. This dashboard demonstrates proficiency in:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>React Architecture (Single File SPA)</li>
            <li>Complex State Management (Local Database Simulation)</li>
            <li>Data Visualization (Recharts)</li>
            <li>Tooling (SQL Parser & Grid Logic)</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default WorkX;