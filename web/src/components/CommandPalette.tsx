import { useMemo, useState } from 'react';
import type { View } from '../types';
interface Props { open: boolean; onClose: () => void; onView: (view: View) => void; onTheme: () => void; onBrief: () => void; onExperiment: () => void; onAdvance: () => void; }
const commands = [
  ['home', 'Ir a Ciclos'], ['workspace', 'Abrir Workspace'], ['library', 'Abrir Biblioteca'], ['context', 'Abrir Contexto Dropi'], ['brief', 'Exportar brief Markdown'], ['experiment', 'Mostrar Experiment Card'], ['theme', 'Alternar tema'], ['advance', 'Avanzar a F2 con riesgo'],
] as const;
export function CommandPalette({ open, onClose, onView, onTheme, onBrief, onExperiment, onAdvance }: Props) {
  const [term, setTerm] = useState('');
  const visible = useMemo(() => commands.filter(([, label]) => label.toLowerCase().includes(term.toLowerCase())), [term]);
  if (!open) return null;
  const run = (command: string) => { if (['home','workspace','library','context'].includes(command)) onView(command as View); if (command === 'theme') onTheme(); if (command === 'brief') onBrief(); if (command === 'experiment') onExperiment(); if (command === 'advance') onAdvance(); onClose(); };
  return <div className="palette" onClick={(event) => event.target === event.currentTarget && onClose()}><div className="palette-card"><p className="section-label">Comandos</p><input className="palette-input" placeholder="Escribe un comando o destino…" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />{visible.map(([command, label]) => <button key={command} type="button" data-palette-command={command} onClick={() => run(command)}>{label}</button>)}</div></div>;
}
