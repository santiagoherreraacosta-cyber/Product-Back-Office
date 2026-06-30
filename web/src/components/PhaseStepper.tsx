import type { Phase } from '../types';

interface Props {
  phases: Phase[];
  activePhase: string;
  onSelect: (phase: string) => void;
}

export function PhaseStepper({ phases, activePhase, onSelect }: Props) {
  return (
    <nav className="phase-list" aria-label="Fases del ciclo">
      {phases.map((phase, index) => (
        <button
          key={phase.key}
          className={`phase-row ${phase.state} ${phase.skipped ? 'skipped' : ''}`}
          type="button"
          data-phase={phase.key}
          aria-current={phase.key === activePhase ? 'step' : undefined}
          onClick={() => onSelect(phase.key)}
        >
          <span className="phase-dot">{phase.state === 'done' ? '✓' : index}</span>
          <span className="phase-copy">
            <span className="phase-label-line">
              <strong>{phase.key} {phase.label}</strong>
              {phase.skipped && <span className="skipped-pin" aria-label="gate saltado" />}
            </span>
            {phase.note && <span className="phase-note">{phase.note}</span>}
          </span>
        </button>
      ))}
    </nav>
  );
}
