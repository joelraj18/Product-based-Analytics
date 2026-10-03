import React, { useId, useState } from 'react';
import { Info, ChevronDown, Lightbulb, Upload } from 'lucide-react';
import { GLOSSARY, HELP } from '../content/guide';
import { SCHEMA_BY_ID } from '../lib/schemas';
import usePersistentState from '../hooks/usePersistentState';

// ⓘ button with a tooltip. `term` is a GLOSSARY key; `text` overrides it.
export const InfoTip = ({ term, text, label }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const g = term && GLOSSARY[term];
  const body = text || (g && g.short);
  if (!body) return null;
  const name = label || (g && g.term) || 'More info';
  return (
    <span className="relative inline-flex align-middle z-10">
      <button
        type="button"
        aria-label={`What is ${name}?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-slate-400 hover:text-blue-600 focus:text-blue-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-5 w-64 max-w-[80vw] rounded-lg bg-slate-900 text-white text-xs font-normal normal-case tracking-normal leading-relaxed p-3 shadow-xl text-left"
        >
          {g && !text && <span className="block font-semibold mb-1">{g.term}</span>}
          {body}
        </span>
      )}
    </span>
  );
};

// Collapsible "What am I looking at?" panel shown above each screen.
export const HelpBox = ({ moduleId, onNavigate }) => {
  const help = HELP[moduleId];
  const [open, setOpen] = usePersistentState(`help_open_${moduleId}`, true);
  if (!help) return null;
  return (
    <div className="max-w-7xl mx-auto mb-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50/60">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-blue-900"
        >
          <span className="flex items-center gap-2"><Lightbulb size={16} aria-hidden="true" /> What am I looking at?</span>
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {open && (
          <div className="px-4 pb-4 text-sm text-slate-700 space-y-2">
            <p>{help.purpose}</p>
            <ul className="list-disc pl-5 space-y-1">
              {help.steps.map(s => <li key={s}>{s}</li>)}
            </ul>
            {help.feeds && help.feeds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Uses data from:</span>
                {help.feeds.map(f => (
                  <span key={f} className="text-xs bg-white border border-blue-200 rounded-full px-2 py-0.5 text-blue-900">{SCHEMA_BY_ID[f].label}</span>
                ))}
                {onNavigate && (
                  <button type="button" onClick={() => onNavigate('upload')} className="text-xs text-blue-700 font-semibold hover:underline inline-flex items-center gap-1">
                    <Upload size={12} aria-hidden="true" /> Upload your own
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
