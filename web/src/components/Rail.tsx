import { PhaseStepper } from './PhaseStepper';
import type { Phase, View } from '../types';

interface Props {
  phases: Phase[];
  activePhase: string;
  theme: 'light' | 'dark';
  onPhaseSelect: (phase: string) => void;
  onThemeToggle: () => void;
  onViewChange: (view: View) => void;
}

export function Rail({ phases, activePhase, theme, onPhaseSelect, onThemeToggle, onViewChange }: Props) {
  return (
    <aside className="rail scrim" aria-label="Navegación del workspace">
      <header className="rail-top">
        <div className="brand-lockup">
          <span className="logo-box" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4.5 8 12 12.2 19.5 8"/><path d="M12 12.2V21"/></svg>
          </span>
          <strong>Asistente Dropi</strong>
        </div>
        <button className="icon-button" type="button" aria-label="Alternar tema" onClick={onThemeToggle}>{theme === 'dark' ? '☀' : '☾'}</button>
      </header>
      <section className="rail-section active-cycle-section">
        <p className="section-label">Ciclo activo</p>
        <article className="cycle-card"><h2>Cliff de activación post-Aha</h2><div className="chip-row"><span className="chip neutral">Rebuscador Digital</span><span className="chip cause ability"><span className="dot"/>Ability</span></div><div className="cognitive-path"><span>Setup</span><span>›</span><strong>Aha</strong><span>›</span><span className="muted-step">Hábito</span></div></article>
      </section>
      <section className="rail-section"><p className="section-label">Fases</p><PhaseStepper phases={phases} activePhase={activePhase} onSelect={onPhaseSelect} /></section>
      <footer className="rail-footer">
        <button className="rail-link" type="button" onClick={() => onViewChange('home')}><span aria-hidden="true">⌂</span>Ciclos</button>
        <button className="rail-link" type="button" onClick={() => onViewChange('library')}><span aria-hidden="true">□</span>Biblioteca de Patrones</button>
        <button className="rail-link" type="button" onClick={() => onViewChange('context')}><span aria-hidden="true">ⓘ</span>Contexto Dropi</button>
      </footer>
    </aside>
  );
}
