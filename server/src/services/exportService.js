const CONFIRM = "[CONFIRMAR]";

export function createDefaultExportState(overrides = {}) {
  return {
    cycle: "Cliff de activación post-Aha",
    behavior: "El Rebuscador Digital configura su 2º envío dentro de las 72h posteriores al primer pedido.",
    profile: "Rebuscador Digital",
    cognitiveLevel: "Setup → Aha",
    cause: "Ability — flujo de envío bloqueado",
    evidence: ["Cohorte 30d — 7 pasos para configurar envío · n=412", `${CONFIRM} 2ª fuente pendiente`],
    hypothesis: `${CONFIRM} Se define en F2 · Design`,
    metric: `${CONFIRM} Métrica primaria pendiente`,
    experiment: {
      hypothesis: "Si reducimos la configuración de envío, aumentará el 2º envío en 72h.",
      intervention: `${CONFIRM} guía asistida de configuración`,
      primaryMetric: `${CONFIRM} tasa de 2º envío en 72h`,
      stopCriteria: `${CONFIRM} deterioro en setup completado o soporte`,
      sampleSize: `${CONFIRM} tamaño de muestra`,
      duration: "14 días",
      tracking: `${CONFIRM} eventos de envío configurado`,
    },
    conversation: [
      { role: "user", text: "Tengo un problema de activación: muchos sellers llegan al Aha, pero no configuran el segundo envío." },
      { role: "assistant", text: "F1 · Diagnose queda abierto hasta confirmar segunda fuente para Ability." },
    ],
    risks: {
      assumed: ["F1: Diagnóstico con 1 sola fuente. Riesgo aceptado por Santiago · 25 jun."],
      resolved: [`${CONFIRM} Segunda fuente todavía no resuelta.`],
    },
    decision: `${CONFIRM} Decisión F3 pendiente`,
    executiveSummary: "El ciclo apunta a reducir fricción Ability después del Aha. La evidencia cuantitativa muestra un flujo de envío de 7 pasos; falta confirmar con segunda fuente antes de comprometer sprint.",
    ...overrides,
  };
}

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function conversationList(items) {
  return items.map((item) => `- **${item.role}:** ${item.text}`).join("\n");
}

export function generateInterventionBriefMarkdown(input = {}) {
  const state = createDefaultExportState(input);
  return `# Intervention Brief\n\n## Resumen ejecutivo\n${state.executiveSummary}\n\n## Ciclo\n${state.cycle}\n\n## Comportamiento objetivo\n${state.behavior}\n\n## Segmento y nivel\n- Sub-perfil: ${state.profile}\n- Nivel cognitivo: ${state.cognitiveLevel}\n\n## Causa B=MAP\n${state.cause}\n\n## Evidencia\n${list(state.evidence)}\n\n## Hipótesis de intervención\n${state.hypothesis}\n\n## Métrica de éxito\n${state.metric}\n\n## Riesgos asumidos\n${list(state.risks.assumed)}\n\n## Riesgos resueltos\n${list(state.risks.resolved)}\n`;
}

export function generateExperimentCardMarkdown(input = {}) {
  const state = createDefaultExportState(input);
  const experiment = state.experiment;
  return `# Experiment Card\n\n## Ciclo\n${state.cycle}\n\n## Hipótesis\n${experiment.hypothesis}\n\n## Variable / intervención\n${experiment.intervention}\n\n## Métrica primaria\n${experiment.primaryMetric}\n\n## Criterio de stop\n${experiment.stopCriteria}\n\n## Tamaño de muestra\n${experiment.sampleSize}\n\n## Duración\n${experiment.duration}\n\n## Tracking\n${experiment.tracking}\n\n## Riesgos asumidos\n${list(state.risks.assumed)}\n\n## Riesgos resueltos\n${list(state.risks.resolved)}\n`;
}

export function generateExecutiveSummaryMarkdown(input = {}) {
  const state = createDefaultExportState(input);
  return `# Resumen ejecutivo\n\n${state.executiveSummary}\n\n## Decisión\n${state.decision}\n\n## Riesgos\n### Asumidos\n${list(state.risks.assumed)}\n\n### Resueltos\n${list(state.risks.resolved)}\n`;
}

export function generateFullCycleMarkdown(input = {}) {
  const state = createDefaultExportState(input);
  return `# Ciclo completo\n\n## Resumen ejecutivo\n${state.executiveSummary}\n\n## Conversación\n${conversationList(state.conversation)}\n\n## Riesgos asumidos\n${list(state.risks.assumed)}\n\n## Riesgos resueltos\n${list(state.risks.resolved)}\n\n## Evidencia\n${list(state.evidence)}\n\n## Decisión\n${state.decision}\n\n---\n\n${generateInterventionBriefMarkdown(state)}\n\n---\n\n${generateExperimentCardMarkdown(state)}`;
}

function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function markdownToPdfHtml(markdown, title = "Export Dropi") {
  const escapedBody = escapeHtml(markdown);
  const escapedTitle = escapeHtml(title);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapedTitle}</title><style>body{font-family:Inter,Arial,sans-serif;line-height:1.55;padding:32px;color:#1f2328}pre{white-space:pre-wrap}h1{color:#ff6b00}</style></head><body><pre>${escapedBody}</pre><script>window.onload=()=>window.print()</script></body></html>`;
}

export function createPdfDownload(markdown, title = "Export Dropi") {
  return new Blob([markdownToPdfHtml(markdown, title)], { type: "text/html;charset=utf-8" });
}
