import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, Pencil, Calendar, User } from 'lucide-react';
import { Card, Button, Field, Select, TextInput, Badge, PageHeader, StatusPill } from '../components/ui';
import { useWorkspace } from '../state/workspace';
import { today } from '../lib/csv';

const STATUSES = ['To Do', 'In Progress', 'Done'];
const TAGS = ['Planning', 'Finance', 'Analytics', 'Automation', 'Process', 'General'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const EMPTY = { content: '', tag: 'Planning', status: 'To Do', priority: 'Medium', owner: '', due: '' };

const tagStyle = { Planning: 'blue', Finance: 'success', Analytics: 'purple', Automation: 'warning', Process: 'default', General: 'default' };

const Projects = () => {
  const { tasks: rawTasks, setTasks } = useWorkspace();
  const tasks = Array.isArray(rawTasks) ? rawTasks : [];
  const [form, setForm] = useState(null); // null | { ...task } (id present → edit)
  const [filter, setFilter] = useState('All');
  const now = today();

  const save = () => {
    if (!form.content.trim()) return;
    if (form.id) setTasks(tasks.map(t => (t.id === form.id ? { ...form, content: form.content.trim() } : t)));
    else setTasks([...tasks, { ...form, content: form.content.trim(), id: `T-${Date.now().toString(36).toUpperCase()}` }]);
    setForm(null);
  };
  const move = (id, dir) => setTasks(tasks.map(t => {
    if (t.id !== id) return t;
    const i = STATUSES.indexOf(t.status);
    return { ...t, status: STATUSES[Math.min(STATUSES.length - 1, Math.max(0, i + dir))] };
  }));
  const del = (id) => { if (window.confirm('Delete this task?')) setTasks(tasks.filter(t => t.id !== id)); };

  const visible = filter === 'All' ? tasks : tasks.filter(t => t.tag === filter);
  const overdue = tasks.filter(t => t.status !== 'Done' && t.due && t.due < now).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Planning Workboard"
        subtitle="Track weekly planning deliverables, Finance reconciliations, RCAs and automation work"
        actions={(
          <>
            {overdue > 0 && <StatusPill status="critical">{overdue} overdue</StatusPill>}
            <Select value={filter} onChange={setFilter} options={['All', ...TAGS]} className="w-36" aria-label="Filter by tag" />
            <Button onClick={() => setForm(form ? null : { ...EMPTY })}><Plus size={16} /> {form ? 'Cancel' : 'New task'}</Button>
          </>
        )}
      />

      {form && (
        <Card className="mb-6 p-4 bg-blue-50/50 border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <Field label="Task" className="md:col-span-2">
              <TextInput value={form.content} onChange={v => setForm({ ...form, content: v })} placeholder="Like Refresh weekly HC plan" onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
            </Field>
            <Field label="Tag"><Select value={form.tag} onChange={v => setForm({ ...form, tag: v })} options={TAGS} /></Field>
            <Field label="Priority"><Select value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={PRIORITIES} /></Field>
            <Field label="Owner"><TextInput value={form.owner} onChange={v => setForm({ ...form, owner: v })} placeholder="Team / person" /></Field>
            <Field label="Due"><input type="date" className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex justify-end"><Button onClick={save} disabled={!form.content.trim()}>{form.id ? 'Update task' : 'Save task'}</Button></div>
        </Card>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {STATUSES.map(status => {
          const col = visible.filter(t => t.status === status);
          return (
            <div key={status} className="flex flex-col bg-slate-100 rounded-xl border border-slate-200 min-h-[200px]">
              <div className="p-3 font-bold text-sm uppercase tracking-wider border-b border-slate-200 flex justify-between items-center text-slate-700">
                {status}
                <span className="bg-white px-2 py-0.5 rounded-full text-xs border">{col.length}</span>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {col.map(task => {
                  const late = task.status !== 'Done' && task.due && task.due < now;
                  return (
                    <div key={task.id} className={`bg-white p-3 rounded-lg shadow-sm border ${late ? 'border-rose-300' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <Badge type={tagStyle[task.tag] || 'default'}>{task.tag}</Badge>
                        <Badge type={task.priority === 'High' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'default'}>{task.priority || 'Medium'}</Badge>
                      </div>
                      <p className="text-slate-800 text-sm font-medium leading-snug">{task.content}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        {task.owner && <span className="flex items-center gap-1"><User size={12} />{task.owner}</span>}
                        {task.due && <span className={`flex items-center gap-1 ${late ? 'text-rose-700 font-semibold' : ''}`}><Calendar size={12} />{task.due}{late ? ' · overdue' : ''}</span>}
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between">
                        <div className="flex gap-1">
                          <button type="button" aria-label="Edit task" onClick={() => setForm({ ...EMPTY, ...task })} className="p-1 rounded hover:bg-slate-100 text-slate-500"><Pencil size={14} /></button>
                          <button type="button" aria-label="Delete task" onClick={() => del(task.id)} className="p-1 rounded hover:bg-rose-50 text-rose-500"><Trash2 size={14} /></button>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" aria-label="Move left" disabled={status === STATUSES[0]} onClick={() => move(task.id, -1)} className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30"><ChevronLeft size={14} /></button>
                          <button type="button" aria-label="Move right" disabled={status === STATUSES[STATUSES.length - 1]} onClick={() => move(task.id, 1)} className="p-1 rounded hover:bg-slate-100 text-blue-600 disabled:opacity-30"><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Projects;
