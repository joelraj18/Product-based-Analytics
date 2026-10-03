import React, { useMemo, useState } from 'react';
import {
  Compass, TrendingUp, Users, Wallet, ShieldAlert, Activity, Database, UploadCloud, ArrowRight, Search, PlayCircle, BookOpen, HelpCircle,
} from 'lucide-react';
import { Card, Button, TextInput } from '../components/ui';
import { GLOSSARY } from '../content/guide';
import { Prose } from '../components/help';
import { SCHEMAS } from '../lib/schemas';

const STEPS = [
  { id: 'forecast', icon: TrendingUp, title: 'See the demand', text: 'How many calls, chats or tickets will arrive each week?\nThe forecast learns from past volume and seasonal peaks' },
  { id: 'capacity', icon: Users, title: 'Work out the people needed', text: 'Volume × handle time, adjusted for breaks, leave and idle time, gives the people (FTE) you need and when to hire them' },
  { id: 'budget', icon: Wallet, title: 'Check the cost', text: 'What will that staffing cost each month, and is it inside the budget Finance set (OP1/OP2)?' },
  { id: 'scenarios', icon: ShieldAlert, title: 'Stress test the plan', text: 'What if volume is 20% higher or more people leave?\nSee where the plan breaks and log the risks' },
  { id: 'kpis', icon: Activity, title: 'Review how it went', text: 'Compare forecast vs actual, service level and cost every week, and find the root causes' },
];

const FLOW = ['Volume history', 'Forecast', 'Required FTE', 'Hiring plan', 'Cost vs budget'];

const FAQ = [
  ['Where is my data stored?', 'Only in this browser, in its local storage and IndexedDB\nNothing is sent to a server\nUse Settings → Download backup to keep a copy or move it to another computer'],
  ['Can I use my own data?', 'Yes, go to Upload Data\nAny CSV or Excel file can be loaded as a SQL table\nFiles for planning screens need the exact column names shown in the Column reference, so download a template, fill it in and upload it'],
  ['What is the demo data?', 'A realistic but made up support operation with 4 queues at 3 sites, 3 years of daily volume, weekly actuals, defects and risks\nIt is regenerated the same way every time'],
  ['I broke something, how do I start over?', 'Use Settings → Reset to demo data\nYour login is kept, while uploaded tables and changes are cleared'],
  ['Do I need to know SQL or statistics?', 'No, every screen has a “What am I looking at?” box and ⓘ tips that explain terms in plain English\nSQL Lab has guided practice exercises if you want to learn'],
];

const StartHere = ({ onNavigate }) => {
  const [q, setQ] = useState('');
  const terms = useMemo(() => Object.values(GLOSSARY).filter(g => `${g.term} ${g.short}`.toLowerCase().includes(q.trim().toLowerCase())), [q]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <Card className="p-6 md:p-8 bg-gradient-to-br from-slate-900 to-blue-900 text-white border-0">
        <div className="flex items-center gap-2 text-blue-200 text-sm font-semibold"><Compass size={16} /> Start here</div>
        <h2 className="text-2xl md:text-3xl font-bold mt-2">Welcome to WorkX</h2>
        <p className="mt-3 text-blue-100 max-w-3xl leading-relaxed">
          WorkX helps operations teams answer one question: <b className="text-white">“Will we have the right number of people, at the right time, at the right cost?”</b>{' '}
          It forecasts work, turns it into staffing and hiring plans, prices them against the budget and tracks how plans perform, with a SQL lab and data tools for practising analytics
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => onNavigate('hub')} className="bg-white !text-slate-900 hover:bg-blue-50"><PlayCircle size={16} /> Explore with demo data</Button>
          <Button onClick={() => onNavigate('upload')} variant="secondary" className="!bg-transparent !text-white border-white/40 hover:!bg-white/10"><UploadCloud size={16} /> Upload my own files</Button>
          <Button onClick={() => onNavigate('sql')} variant="secondary" className="!bg-transparent !text-white border-white/40 hover:!bg-white/10"><Database size={16} /> Practise SQL</Button>
        </div>
      </Card>

      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">How the pieces fit together</h3>
        <p className="text-sm text-slate-500 mb-3">Each step feeds the next, so change an input anywhere and every screen updates</p>
        <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Planning flow">
          {FLOW.map((f, i) => (
            <React.Fragment key={f}>
              <span role="listitem" className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm">{f}</span>
              {i < FLOW.length - 1 && <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />}
            </React.Fragment>
          ))}
          <span className="text-sm text-slate-500 ml-2">… then <b>Actuals</b> → <b>KPIs</b> show how it went</span>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-3">A 5 step tour</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {STEPS.map((s, i) => (
            <Card key={s.id} className="p-4 flex flex-col">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm"><span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">{i + 1}</span><s.icon size={16} /></div>
              <div className="font-semibold text-slate-800 mt-2">{s.title}</div>
              <p className="text-sm text-slate-600 mt-1 flex-1"><Prose text={s.text} /></p>
              <Button size="sm" variant="secondary" className="mt-3 self-start" onClick={() => onNavigate(s.id)}>Open <ArrowRight size={12} /></Button>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2"><UploadCloud size={18} /> Using your own data</h3>
        <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1 mt-2">
          <li>Open <b>Upload Data</b> and drop a CSV or Excel file</li>
          <li><b>Any file</b> can be saved as a SQL table, great for practising queries on data you care about</li>
          <li>To drive the planning screens, the file must use these exact column names (case and spaces don’t matter):</li>
        </ol>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {SCHEMAS.map(s => (
            <div key={s.id} className="p-2 rounded-lg bg-slate-50 border">
              <div className="font-semibold text-slate-800">{s.label}</div>
              <div className="flex flex-wrap gap-1 mt-1">{s.required.map(c => <code key={c.name} className="font-mono text-xs bg-white border border-slate-200 rounded px-1 text-slate-700">{c.name}</code>)}</div>
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={() => onNavigate('upload')}>Go to Upload Data <ArrowRight size={14} /></Button>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BookOpen size={18} /> Glossary: planning terms in plain English</h3>
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <TextInput value={q} onChange={setQ} placeholder="Search terms…" className="pl-8" aria-label="Search glossary" />
          </div>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {terms.map(g => (
            <div key={g.term} className="p-3 rounded-lg border border-slate-200">
              <dt className="font-semibold text-slate-800">{g.term}</dt>
              <dd className="text-sm text-slate-600 mt-1"><Prose text={g.short} /></dd>
            </div>
          ))}
          {!terms.length && <p className="text-sm text-slate-500">No terms match “{q}”.</p>}
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><HelpCircle size={18} /> Questions</h3>
        <div className="divide-y">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="py-2">
              <summary className="cursor-pointer font-medium text-slate-800">{question}</summary>
              <p className="text-sm text-slate-600 mt-2"><Prose text={answer} /></p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default StartHere;
