export const DEFAULT_PROMPTS = [
  "¿Qué comportamiento debe ocurrir, y por qué no ocurre hoy?",
  "Trae la evidencia: ¿qué dato sostiene la causa Ability?",
  "Si avanzas sin gate, ¿qué riesgo aceptas explícitamente?",
  "¿Cuál sería el cambio mínimo para mover el comportamiento?",
];

export function buildPhasePrompt({ phaseKey, label, missing = [] }) {
  const missingText = missing.length ? ` Falta confirmar: ${missing.join(", ")}.` : "";
  return `Estamos en ${phaseKey} · ${label}.${missingText}`;
}

export function nextPrompt(index, prompts = DEFAULT_PROMPTS) {
  const nextIndex = (index + 1) % prompts.length;
  return { index: nextIndex, text: prompts[nextIndex] };
}
