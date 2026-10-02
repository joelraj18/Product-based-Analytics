import React from 'react';
import { Upload } from 'lucide-react';
import { FileButton, useToast } from './ui';
import { useWorkspace } from '../state/workspace';
import { readForSchema, explainProblems } from '../lib/importFile';
import { applyImport } from '../lib/importMerge';
import { ACCEPT } from '../lib/fileImport';
import { SCHEMA_BY_ID } from '../lib/schemas';

// One-click import of a CSV/Excel file into a feature dataset, with the same
// column checks as the Upload Data page.
const SchemaImportButton = ({ schemaId, mode, children, size = 'md', variant = 'primary' }) => {
  const ws = useWorkspace();
  const { notify } = useToast();
  const schema = SCHEMA_BY_ID[schemaId];
  const onFile = async (file) => {
    try {
      const v = await readForSchema(file, schemaId);
      if (!v.ok) {
        notify(`${file.name} can't be imported as ${schema.label}.\n${explainProblems(schemaId, v)}\nTip: Upload Data → Column reference has a template.`, 'error');
        return;
      }
      const result = applyImport(ws, schemaId, mode || schema.modes[0].id, v.rows);
      const extra = [v.skipped ? `${v.skipped} row(s) skipped.` : '', ...result.warnings].filter(Boolean).join('\n');
      notify(`Imported ${v.rows.length} row(s) from ${file.name}${v.sheet && /\.xlsx$/i.test(file.name) ? ` (sheet "${v.sheet}")` : ''} into ${schema.label}.${extra ? `\n${extra}` : ''}`, result.warnings.length || v.skipped ? 'warning' : 'success');
    } catch (e) {
      notify(e.message, 'error');
    }
  };
  return (
    <FileButton accept={ACCEPT} onFile={onFile} size={size} variant={variant}>
      <Upload size={size === 'sm' ? 12 : 16} /> {children}
    </FileButton>
  );
};

export default SchemaImportButton;
