export function extractMessageIntent(text) {
  const normalized = text.trim();
  if (!normalized) return { type: "empty" };
  if (normalized.startsWith("/brief")) return { type: "export_brief" };
  if (normalized.startsWith("/experimento")) return { type: "experiment" };
  if (/entrevista|grabaci[oó]n|segunda fuente|2ª fuente/i.test(normalized)) return { type: "second_source", value: "Entrevistas rápidas confirman bloqueo en configuración de envío · 5/7 sellers." };
  if (/riesgo|avanzar igual|acepto/i.test(normalized)) return { type: "accept_risk" };
  return { type: "evidence", value: normalized };
}

export function extractBriefPatch(text) {
  const intent = extractMessageIntent(text);
  if (intent.type === "second_source") return { secondSource: intent.value, progress: 7 };
  if (intent.type === "experiment") {
    return {
      hypothesis: "Si reducimos la configuración de envío de 7 pasos a una guía asistida, aumentará el 2º envío en 72h porque baja la fricción Ability.",
      progress: 8,
    };
  }
  return {};
}
