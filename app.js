const THEME_KEY = "dropi-workspace-theme";
const RISK_KEY = "dropi-workspace-risk-accepted";

const workspace = document.querySelector("#workspace");
const phaseStepper = document.querySelector("#phaseStepper");
const activePhaseLabel = document.querySelector("#activePhaseLabel");
const activePhaseNote = document.querySelector("#activePhaseNote");
const messageStream = document.querySelector("#messageStream");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const chatInput = document.querySelector(".chat-input");
const placeholder = document.querySelector("#rotatingPlaceholder");
const themeToggle = document.querySelector("#themeToggle");
const commandButton = document.querySelector("#commandButton");
const commandPalette = document.querySelector("#commandPalette");
const exportBrief = document.querySelector("#exportBrief");
const progressFill = document.querySelector("#briefProgressFill");
const progressText = document.querySelector("#briefProgressText");
const riskTag = document.querySelector("#riskTag");
const secondSource = document.querySelector("#secondSource");
const hypothesisField = document.querySelector("#hypothesisField");
const metricField = document.querySelector("#metricField");
const viewButtons = document.querySelectorAll("[data-view-target]");
const homeView = document.querySelector("#homeView");
const workspaceView = document.querySelector("#workspaceView");
const libraryView = document.querySelector("#libraryView");
const contextView = document.querySelector("#contextView");
const contextDocuments = document.querySelector("#contextDocuments");
const contextPendingBanner = document.querySelector("#contextPendingBanner");
const newCycleButton = document.querySelector("#newCycleButton");
const briefSwitch = document.querySelector("#briefSwitch");
const experimentSwitch = document.querySelector("#experimentSwitch");
const deliverableTitle = document.querySelector("#deliverableTitle");
const briefBody = document.querySelector("#briefBody");
const experimentBody = document.querySelector("#experimentBody");
const paletteSearch = document.querySelector("#paletteSearch");

const phaseSeed = [
  { key: "F0", label: "Sense", state: "done" },
  { key: "F1", label: "Diagnose", state: "active", note: "falta 2ª fuente" },
  { key: "F2", label: "Design", state: "todo" },
  { key: "F3", label: "Decide", state: "todo", skipped: true, note: "gate saltado" },
  { key: "F4", label: "Deploy", state: "todo" },
  { key: "F5", label: "Distill", state: "todo" },
];

const prompts = [
  "¿Qué comportamiento debe ocurrir, y por qué no ocurre hoy?",
  "Trae la evidencia: ¿qué dato sostiene la causa Ability?",
  "Si avanzas sin gate, ¿qué riesgo aceptas explícitamente?",
  "¿Cuál sería el cambio mínimo para mover el comportamiento?",
];

let phases = structuredClone(phaseSeed);
let activePhase = "F1";
let riskAccepted = localStorage.getItem(RISK_KEY) === "true";
let filled = riskAccepted ? 7 : 6;
let promptIndex = 0;
let currentView = "workspace";
let deliverable = "brief";
let contextLoaded = false;

init();

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  renderStepper();
  renderMessages();
  setView("workspace");
  renderBriefState();
  rotatePlaceholder();
  setInterval(rotatePlaceholder, 4200);
}

themeToggle.addEventListener("click", () => {
  const next = workspace.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

phaseStepper.addEventListener("click", (event) => {
  const row = event.target.closest("[data-phase]");
  if (!row) return;
  activePhase = row.dataset.phase;
  phases = phases.map((phase) => ({ ...phase, state: phase.key === activePhase ? "active" : phase.state === "active" ? "todo" : phase.state }));
  renderStepper();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

messageInput.addEventListener("input", () => {
  chatInput.classList.toggle("has-text", messageInput.value.trim().length > 0);
});

messageInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.command;
    chatInput.classList.add("has-text");
    messageInput.focus();
  });
});

commandButton.addEventListener("click", () => {
  commandPalette.hidden = false;
});

commandPalette.addEventListener("click", (event) => {
  if (event.target === commandPalette) commandPalette.hidden = true;
  const command = event.target.dataset?.paletteCommand;
  if (!command) return;
  if (["home", "workspace", "library", "context"].includes(command)) setView(command);
  if (command === "theme") themeToggle.click();
  if (command === "brief") downloadBrief();
  if (command === "experiment") setDeliverable("experiment");
  if (command === "advance") acceptRiskAndAdvance();
  commandPalette.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    commandPalette.hidden = !commandPalette.hidden;
  }
  if (event.key === "Escape") commandPalette.hidden = true;
});

exportBrief.addEventListener("click", downloadBrief);

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

document.querySelectorAll("[data-open-workspace], [data-example-cycle]").forEach((item) => {
  item.addEventListener("click", () => setView("workspace"));
});

newCycleButton?.addEventListener("click", () => {
  setView("workspace");
  activePhase = "F0";
  phases = phases.map((phase) => ({ ...phase, state: phase.key === "F0" ? "active" : phase.key === "F1" ? "todo" : phase.state === "done" ? "todo" : phase.state }));
  renderStepper();
  addAiNote("Nuevo ciclo en F0 · Sense. Empecemos por el comportamiento: ¿qué seller, haciendo qué, no está haciendo qué?");
});

briefSwitch?.addEventListener("click", () => setDeliverable("brief"));
experimentSwitch?.addEventListener("click", () => setDeliverable("experiment"));

paletteSearch?.addEventListener("input", () => {
  const term = paletteSearch.value.toLowerCase();
  commandPalette.querySelectorAll("[data-palette-command]").forEach((button) => {
    button.classList.toggle("is-hidden", !button.textContent.toLowerCase().includes(term));
  });
});

function setView(view) {
  currentView = view;
  workspace.dataset.view = view;
  homeView.hidden = view !== "home";
  workspaceView.hidden = view !== "workspace";
  libraryView.hidden = view !== "library";
  contextView.hidden = view !== "context";
  if (view === "context" && !contextLoaded) loadContextDocuments();
}

async function loadContextDocuments() {
  contextPendingBanner.textContent = "Cargando contexto…";
  try {
    const response = await fetch("/api/context");
    if (!response.ok) throw new Error("No se pudo cargar el contexto.");
    const data = await response.json();
    contextLoaded = true;
    renderContextDocuments(data);
  } catch (error) {
    contextPendingBanner.textContent = `${error.message} Revisa que el backend Node esté corriendo con npm run start.`;
  }
}

function renderContextDocuments(data) {
  contextPendingBanner.textContent = `${data.pendingCount} campos pendientes [CONFIRMAR] — la IA los tratará como supuestos.`;
  contextDocuments.innerHTML = data.documents
    .map((doc) => `
      <section class="context-document" data-context-id="${escapeHtml(doc.id)}">
        <header><h2>${escapeHtml(doc.title)}</h2><span>v${doc.version} · ${doc.pendingCount} pendientes</span></header>
        <textarea aria-label="Editar ${escapeHtml(doc.title)}">${escapeHtml(doc.content)}</textarea>
        <footer><span>Actualizado por ${escapeHtml(doc.updatedBy)} · ${new Date(doc.updatedAt).toLocaleString("es-CO")}</span><button class="secondary-action" type="button" data-save-context>Guardar como admin</button></footer>
      </section>`)
    .join("");
  contextDocuments.querySelectorAll("[data-save-context]").forEach((button) => {
    button.addEventListener("click", () => saveContextDocument(button.closest("[data-context-id]")));
  });
}

async function saveContextDocument(section) {
  const id = section.dataset.contextId;
  const content = section.querySelector("textarea").value;
  const button = section.querySelector("[data-save-context]");
  button.disabled = true;
  button.textContent = "Guardando…";
  try {
    const response = await fetch(`/api/context/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-Admin-Role": "admin" }, body: JSON.stringify({ content, reason: "Edición desde Contexto Dropi" }) });
    if (!response.ok) throw new Error("No se pudo guardar la edición.");
    contextLoaded = false;
    await loadContextDocuments();
  } catch (error) {
    button.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function setDeliverable(next) {
  deliverable = next;
  briefBody.hidden = next !== "brief";
  experimentBody.hidden = next !== "experiment";
  briefSwitch.classList.toggle("active", next === "brief");
  experimentSwitch.classList.toggle("active", next === "experiment");
  deliverableTitle.textContent = next === "brief" ? "Intervention Brief" : "Experiment Card";
  progressText.textContent = next === "brief" ? `${filled} / 11` : "3 / 9";
  progressFill.style.width = next === "brief" ? `${Math.round((filled / 11) * 100)}%` : "33%";
}

function applyTheme(theme) {
  workspace.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === "dark" ? "☀" : "☾";
}

function renderStepper() {
  phaseStepper.innerHTML = phases
    .map((phase, index) => {
      const statusMark = phase.state === "done" ? "✓" : index;
      const skipped = phase.skipped ? '<span class="skipped-pin" aria-label="gate saltado"></span>' : "";
      const note = phase.note ? `<span class="phase-note">${phase.note}</span>` : "";
      return `
        <button class="phase-row ${phase.state} ${phase.skipped ? "skipped" : ""}" type="button" data-phase="${phase.key}">
          <span class="phase-dot">${statusMark}</span>
          <span class="phase-copy">
            <span class="phase-label-line"><strong>${phase.key} ${phase.label}</strong>${skipped}</span>
            ${note}
          </span>
        </button>`;
    })
    .join("");

  const selected = phases.find((phase) => phase.key === activePhase) ?? phases[1];
  activePhaseLabel.textContent = `${selected.key} · ${selected.label}`;
  activePhaseNote.textContent = selected.note || "gate abierto";
}

function renderMessages() {
  messageStream.innerHTML = `
    <div class="stream-inner">
      <div class="user-message">Tengo un problema de activación: muchos sellers llegan al Aha, pero no configuran el segundo envío.</div>
      <article class="ai-message">
        <div class="ai-avatar">D</div>
        <div class="ai-body">
          <p><strong>Voy a mantenernos en F1 · Diagnose.</strong> El comportamiento ya está definido, pero todavía falta una segunda fuente para afirmar que la causa es Ability y no Prompt.</p>
          ${renderBmapCard()}
        </div>
      </article>
      ${renderGateCard()}
    </div>`;

  messageStream.querySelector("#closeGate")?.addEventListener("click", () => {
    addAiNote("Perfecto. Mantengo F1 abierto. Busca una 2ª fuente: entrevista breve, sesión grabada o evento de abandono en configuración de envío.");
  });

  messageStream.querySelector("#advanceAnyway")?.addEventListener("click", acceptRiskAndAdvance);
}

function renderBmapCard() {
  return `
    <section class="bmap-card" aria-label="Diagnóstico B=MAP">
      <header class="bmap-head"><strong>DIAGNÓSTICO B=MAP</strong><span>Cohorte 30d · n=412</span></header>
      <div class="bmap-grid">
        <div class="bmap-cell">
          <div class="bmap-label motivation"><span class="dot"></span>Motivación</div>
          <p class="bmap-value">Suficiente</p>
          <p class="bmap-sub">Volvió a abrir la app 2,3 veces.</p>
        </div>
        <div class="bmap-cell cause">
          <span class="cause-badge">CAUSA</span>
          <div class="bmap-label ability"><span class="dot"></span>Ability</div>
          <p class="bmap-value">Bloqueada</p>
          <p class="bmap-sub">Configurar envío = 7 pasos.</p>
        </div>
        <div class="bmap-cell">
          <div class="bmap-label prompt"><span class="dot"></span>Prompt</div>
          <p class="bmap-value">Débil</p>
          <p class="bmap-sub">Sin recordatorio al día 2.</p>
        </div>
      </div>
      <footer class="bmap-footer">
        <span>Nivel cognitivo: <strong>Setup → Aha</strong></span>
        <span>Sesgo: <strong>Costo de hundimiento</strong></span>
      </footer>
    </section>`;
}

function renderGateCard() {
  return `
    <article class="gate-card">
      <div class="gate-head"><span class="gate-icon">⚠</span><strong>Gate sin cerrar — F1 · Diagnose</strong></div>
      <p>Antes de diseñar intervención, falta <strong>2ª fuente</strong> para confirmar que Ability es la causa principal.</p>
      <div class="risk-box"><strong>RIESGO</strong>Diagnóstico por opinión, no por evidencia. Si Ability no es la causa real, la intervención falla y quemas un sprint.</div>
      <div class="gate-actions">
        <button id="closeGate" class="primary-action" type="button">Cerrarlo primero</button>
        <button id="advanceAnyway" class="secondary-action" type="button">Avanzar igual</button>
      </div>
    </article>`;
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  const inner = messageStream.querySelector(".stream-inner");
  inner.insertAdjacentHTML("beforeend", `<div class="user-message">${escapeHtml(text)}</div>`);
  messageInput.value = "";
  chatInput.classList.remove("has-text");

  if (text.startsWith("/brief")) {
    downloadBrief();
    addAiNote("Brief exportado en Markdown. También queda vivo en el panel derecho.");
    return;
  }

  if (text.startsWith("/experimento")) {
    fillField(hypothesisField, "Si reducimos la configuración de envío de 7 pasos a una guía asistida, aumentará el 2º envío en 72h porque baja la fricción Ability.");
    setBriefProgress(8);
    setDeliverable("experiment");
    addAiNote("Detecto intención de pasar a F3. Puedo ayudarte, pero dejo visible el gate F1 si no cerramos la segunda fuente.");
    return;
  }

  if (/entrevista|grabaci[oó]n|segunda fuente|2ª fuente/i.test(text)) {
    fillField(secondSource, "Entrevistas rápidas confirman bloqueo en configuración de envío · 5/7 sellers.");
    setBriefProgress(7);
    addAiNote("Gate F1 mucho más sólido. Ahora sí podemos diseñar una intervención mínima en F2 sin depender solo de una fuente cuantitativa.");
    return;
  }

  addAiNote("Lo tomo como nueva evidencia conversacional. Para que entre al brief, dime si es comportamiento objetivo, evidencia, hipótesis o métrica de éxito.");
}

function addAiNote(content) {
  const inner = messageStream.querySelector(".stream-inner");
  inner.insertAdjacentHTML(
    "beforeend",
    `<article class="ai-message"><div class="ai-avatar">D</div><div class="ai-body"><p>${escapeHtml(content)}</p></div></article>`
  );
  messageStream.scrollTop = messageStream.scrollHeight;
}

function acceptRiskAndAdvance() {
  riskAccepted = true;
  localStorage.setItem(RISK_KEY, "true");
  phases = phases.map((phase) => {
    if (phase.key === "F1") return { ...phase, state: "done", note: "riesgo aceptado" };
    if (phase.key === "F2") return { ...phase, state: "active", note: "diseñar intervención" };
    return { ...phase, state: phase.key === "F1" ? "done" : phase.state === "active" ? "todo" : phase.state };
  });
  activePhase = "F2";
  setBriefProgress(Math.max(filled, 7));
  renderStepper();
  renderBriefState();
  addAiNote("Avanzamos a F2 con riesgo explícito. El brief mantiene el tag para que no parezca un diagnóstico cerrado.");
}

function renderBriefState() {
  riskTag.classList.toggle("is-hidden", !riskAccepted);
  setDeliverable(deliverable);
}


function setBriefProgress(value) {
  filled = value;
  progressText.textContent = `${filled} / 11`;
  progressFill.style.width = `${Math.round((filled / 11) * 100)}%`;
}

function fillField(element, value) {
  element.textContent = value;
  element.classList.remove("confirm-field");
  element.classList.add("mono-value", "fillable", "fillpop");
  setTimeout(() => element.classList.remove("fillpop"), 700);
}

function downloadBrief() {
  const markdown = `# Intervention Brief\n\n## Ciclo\nCliff de activación post-Aha\n\n## Comportamiento objetivo\nEl Rebuscador Digital configura su 2º envío dentro de las 72h posteriores al primer pedido.\n\n## Causa B=MAP\nAbility — flujo de envío bloqueado\n\n## Evidencia\n- Cohorte 30d — 7 pasos para configurar envío · n=412\n- ${secondSource.textContent.trim()}\n\n## Riesgos asumidos\n${riskAccepted ? "- F1: Diagnóstico con 1 sola fuente. Riesgo aceptado por Santiago · 25 jun." : "- [CONFIRMAR] Sin riesgos aceptados aún."}\n`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "intervention-brief-dropi.md";
  anchor.click();
  URL.revokeObjectURL(url);
}

function rotatePlaceholder() {
  promptIndex = (promptIndex + 1) % prompts.length;
  placeholder.innerHTML = `${prompts[promptIndex]}<span class="caret"></span>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
