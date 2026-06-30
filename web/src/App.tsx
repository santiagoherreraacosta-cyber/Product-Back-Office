import { useCallback, useEffect, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { LiveDeliverablePanel } from './components/LiveDeliverablePanel';
import { Rail } from './components/Rail';
import { DropiContext } from './routes/DropiContext';
import { Home } from './routes/Home';
import { PatternLibrary } from './routes/PatternLibrary';
import { Workspace } from './routes/Workspace';
import type { Deliverable, Phase, View } from './types';

const THEME_KEY = 'dropi-workspace-theme';
const RISK_KEY = 'dropi-workspace-risk-accepted';
const phaseSeed: Phase[] = [
  { key: 'F0', label: 'Sense', state: 'done' },
  { key: 'F1', label: 'Diagnose', state: 'active', note: 'falta 2ª fuente' },
  { key: 'F2', label: 'Design', state: 'todo' },
  { key: 'F3', label: 'Decide', state: 'todo', skipped: true, note: 'gate saltado' },
  { key: 'F4', label: 'Deploy', state: 'todo' },
  { key: 'F5', label: 'Distill', state: 'todo' },
];

function getInitialTheme(): 'light' | 'dark' { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [phases, setPhases] = useState<Phase[]>(phaseSeed);
  const [activePhase, setActivePhase] = useState('F1');
  const [riskAccepted, setRiskAccepted] = useState(() => localStorage.getItem(RISK_KEY) === 'true');
  const [filled, setFilled] = useState(() => (localStorage.getItem(RISK_KEY) === 'true' ? 7 : 6));
  const [view, setView] = useState<View>('workspace');
  const [deliverable, setDeliverable] = useState<Deliverable>('brief');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [secondSource, setSecondSource] = useState('[CONFIRMAR] 2ª fuente pendiente');
  const [hypothesis, setHypothesis] = useState('[CONFIRMAR] Se define en F2 · Design');
  const [metric] = useState('[CONFIRMAR]');
  const [newCycleNote, setNewCycleNote] = useState('');

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((open) => !open); } if (event.key === 'Escape') setPaletteOpen(false); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, []);

  const selectPhase = (phaseKey: string) => { setActivePhase(phaseKey); setPhases((current) => current.map((phase) => ({ ...phase, state: phase.key === phaseKey ? 'active' : phase.state === 'active' ? 'todo' : phase.state }))); };
  const exportBrief = useCallback(() => {
    const markdown = `# Intervention Brief\n\n## Ciclo\nCliff de activación post-Aha\n\n## Comportamiento objetivo\nEl Rebuscador Digital configura su 2º envío dentro de las 72h posteriores al primer pedido.\n\n## Causa B=MAP\nAbility — flujo de envío bloqueado\n\n## Evidencia\n- Cohorte 30d — 7 pasos para configurar envío · n=412\n- ${secondSource}\n\n## Riesgos asumidos\n${riskAccepted ? '- F1: Diagnóstico con 1 sola fuente. Riesgo aceptado por Santiago · 25 jun.' : '- [CONFIRMAR] Sin riesgos aceptados aún.'}\n`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'intervention-brief-dropi.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [riskAccepted, secondSource]);
  const acceptRiskAndAdvance = () => { setRiskAccepted(true); localStorage.setItem(RISK_KEY, 'true'); setPhases((current) => current.map((phase) => { if (phase.key === 'F1') return { ...phase, state: 'done', note: 'riesgo aceptado' }; if (phase.key === 'F2') return { ...phase, state: 'active', note: 'diseñar intervención' }; return { ...phase, state: phase.state === 'active' ? 'todo' : phase.state }; })); setActivePhase('F2'); setFilled((value) => Math.max(value, 7)); };
  const registerSecondSource = () => { setSecondSource('Entrevistas rápidas confirman bloqueo en configuración de envío · 5/7 sellers.'); setFilled((value) => Math.max(value, 7)); };
  const showExperiment = () => { setHypothesis('Si reducimos la configuración de envío de 7 pasos a una guía asistida, aumentará el 2º envío en 72h porque baja la fricción Ability.'); setFilled((value) => Math.max(value, 8)); setDeliverable('experiment'); };
  const newCycle = () => { setView('workspace'); setActivePhase('F0'); setPhases((current) => current.map((phase) => ({ ...phase, state: phase.key === 'F0' ? 'active' : 'todo' }))); setNewCycleNote(`Nuevo ciclo en F0 · Sense. Empecemos por el comportamiento: ¿qué seller, haciendo qué, no está haciendo qué? ${Date.now()}`); };

  return <div className="workspace" data-theme={theme} data-view={view}><Rail phases={phases} activePhase={activePhase} theme={theme} onPhaseSelect={selectPhase} onThemeToggle={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} onViewChange={setView} /><main className="conversation-shell">{view === 'home' && <Home onOpenWorkspace={() => setView('workspace')} onNewCycle={newCycle} />}{view === 'workspace' && <Workspace phases={phases} activePhase={activePhase} onCommandOpen={() => setPaletteOpen(true)} onAcceptRisk={acceptRiskAndAdvance} onSecondSource={registerSecondSource} onExperiment={showExperiment} onBrief={exportBrief} onNewCycleNote={newCycleNote} />}{view === 'library' && <PatternLibrary />}{view === 'context' && <DropiContext />}</main>{view === 'workspace' && <LiveDeliverablePanel deliverable={deliverable} filled={filled} riskAccepted={riskAccepted} secondSource={secondSource} hypothesis={hypothesis} metric={metric} onDeliverable={setDeliverable} onExport={exportBrief} />}<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onView={setView} onTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} onBrief={exportBrief} onExperiment={showExperiment} onAdvance={acceptRiskAndAdvance} /></div>;
}
