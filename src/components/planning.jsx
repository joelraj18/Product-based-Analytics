import React from 'react';
import { Select } from './ui';

export const LineSelect = ({ lines, value, onChange, allowAll = false, className = 'w-64' }) => (
  <Select
    value={value}
    onChange={onChange}
    className={className}
    aria-label="Plan line"
    options={[...(allowAll ? [{ value: 'all', label: 'All plan lines' }] : []), ...lines.map(l => ({ value: l.id, label: l.name }))]}
  />
);

export const shortWeek = (ws) => (typeof ws === 'string' ? ws.slice(5) : String(ws ?? ''));
