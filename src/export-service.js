export function buildBriefMarkdown({ cycleName, behavior, cause, evidence = [], riskAccepted = false }) {
  return `# Intervention Brief\n\n## Ciclo\n${cycleName}\n\n## Comportamiento objetivo\n${behavior}\n\n## Causa B=MAP\n${cause}\n\n## Evidencia\n${evidence.map((item) => `- ${item}`).join("\n")}\n\n## Riesgos asumidos\n${riskAccepted ? "- F1: Diagnóstico con 1 sola fuente. Riesgo aceptado por Santiago · 25 jun." : "- [CONFIRMAR] Sin riesgos aceptados aún."}\n`;
}

export function createMarkdownDownload(markdown, { documentRef = document, urlRef = URL, filename = "intervention-brief-dropi.md" } = {}) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  urlRef.revokeObjectURL(url);
  return { filename, url };
}
