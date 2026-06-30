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
const newCycleButton = document.querySelector("#newCycleButton");
const briefSwitch = document.querySelector("#briefSwitch");
const experimentSwitch = document.querySelector("#experimentSwitch");
const deliverableTitle = document.querySelector("#deliverableTitle");
const briefBody = document.querySelector("#briefBody");
const experimentBody = document.querySelector("#experimentBody");
const paletteSearch = document.querySelector("#paletteSearch");
const cycleGrid = document.querySelector("#cycleGrid");
const cycleState = document.querySelector("#cycleState");
const patternGrid = document.querySelector("#patternGrid");
const patternState = document.querySelector("#patternState");
const patternSearch = document.querySelector("#patternSearch");
const patternFilters = document.querySelector("#patternFilters");
const contextBody = document.querySelector("#contextBody");

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
let cycles = [];
let patterns = [];
let contextPayload = null;
let cyclesLoaded = false;
let patternsLoaded = false;
let contextLoaded = false;
const patternFilterState = { type: "all", cause: "all", subprofile: "all", cognitiveLevel: "all", search: "" };

init();

function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  renderStepper();
  renderMessages();
  setView("workspace");
  renderBriefState();
  loadCycles();
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

document.querySelectorAll("[data-example-cycle]").forEach((item) => {
  item.addEventListener("click", () => setView("workspace"));
});

newCycleButton?.addEventListener("click", createCycle);

briefSwitch?.addEventListener("click", () => setDeliverable("brief"));
experimentSwitch?.addEventListener("click", () => setDeliverable("experiment"));

patternSearch?.addEventListener("input", () => {
  patternFilterState.search = patternSearch.value.trim().toLowerCase();
  renderPatterns();
});

patternFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-kind]");
  if (!button) return;
  patternFilterState[button.dataset.filterKind] = button.dataset.filterValue;
  renderPatternFilters();
  renderPatterns();
});

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
  if (view === "home" && !cyclesLoaded) loadCycles();
  if (view === "library" && !patternsLoaded) loadPatterns();
  if (view === "context" && !contextLoaded) loadContext();
}

async function fetchJson(url, options) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

function listFromPayload(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function loadCycles() {
  cyclesLoaded = true;
  cycleGrid.innerHTML = "";
  cycleState.innerHTML = '<div class="state-card">Cargando ciclos…</div>';
  try {
    cycles = listFromPayload(await fetchJson("/api/cycles"), "cycles");
    renderCycles();
  } catch (error) {
    cycleState.innerHTML = `<div class="state-card error">No pudimos cargar los ciclos. ${escapeHtml(error.message)}</div>`;
  }
}

function renderCycles() {
  if (!cycles.length) {
    cycleGrid.innerHTML = "";
    cycleState.innerHTML = '<div class="state-card">No hay ciclos todavía. Crea uno nuevo para empezar en F0 · Sense.</div>';
    return;
  }
  cycleState.innerHTML = "";
  cycleGrid.innerHTML = cycles.map(renderCycleCard).join("");
  cycleGrid.querySelectorAll("[data-open-workspace]").forEach((item) => item.addEventListener("click", () => setView("workspace")));
}

function renderCycleCard(cycle) {
  const cause = normalizeCause(cycle.cause || cycle.primaryCause);
  const status = cycle.status || "En curso";
  const cognitive = cycle.cognitiveLevel || cycle.cognitivePath || "Setup → Aha";
  const [from, to, next] = String(cognitive).split(/→|>/).map((item) => item.trim());
  const phase = cycle.phase || cycle.currentPhase || "F0 · Sense";
  return `<article class="dashboard-card" data-open-workspace data-cycle-id="${escapeHtml(String(cycle.id ?? ""))}">
    <div class="card-topline"><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span><span>${escapeHtml(cycle.updatedAtLabel || cycle.updatedAt || "")}</span></div>
    <h2>${escapeHtml(cycle.title || cycle.name || "Ciclo sin título")}</h2>
    <div class="chip-row"><span class="chip neutral">${escapeHtml(cycle.subprofile || cycle.segment || "Sin subperfil")}</span><span class="chip cause ${cause}"><span class="dot"></span>${escapeHtml(cycle.cause || cycle.primaryCause || "Sin causa")}</span></div>
    <div class="cognitive-path"><span>${escapeHtml(from || "Setup")}</span><span>›</span><strong>${escapeHtml(to || from || "Aha")}</strong>${next ? `<span>›</span><span class="muted-step">${escapeHtml(next)}</span>` : ""}</div>
    <div class="mini-stepper">${renderMiniStepper(cycle.phaseIndex ?? 0)}</div>
    <footer><strong>${escapeHtml(phase)}</strong><span>${escapeHtml(cycle.riskSummary || "sin riesgos")}</span></footer>
  </article>`;
}

async function createCycle() {
  newCycleButton.disabled = true;
  try {
    const cycle = await fetchJson("/api/cycles", { method: "POST", body: JSON.stringify({ source: "home" }) });
    if (cycle) cycles = [cycle, ...cycles];
    renderCycles();
    setView("workspace");
    activePhase = "F0";
    phases = phases.map((phase) => ({ ...phase, state: phase.key === "F0" ? "active" : phase.state === "active" ? "todo" : phase.state }));
    renderStepper();
    addAiNote("Nuevo ciclo creado desde la API en F0 · Sense.");
  } catch (error) {
    cycleState.innerHTML = `<div class="state-card error">No pudimos crear el ciclo. ${escapeHtml(error.message)}</div>`;
  } finally {
    newCycleButton.disabled = false;
  }
}

async function loadPatterns() {
  patternsLoaded = true;
  patternGrid.innerHTML = "";
  patternState.innerHTML = '<div class="state-card">Cargando patrones…</div>';
  try {
    patterns = listFromPayload(await fetchJson("/api/patterns"), "patterns");
    renderPatternFilters();
    renderPatterns();
  } catch (error) {
    patternState.innerHTML = `<div class="state-card error">No pudimos cargar la biblioteca. ${escapeHtml(error.message)}</div>`;
  }
}

function renderPatternFilters() {
  const groups = [
    ["type", "Tipo", ["all", ...unique(patterns.map((p) => p.type))]],
    ["cause", "Causa", ["all", ...unique(patterns.map((p) => p.cause))]],
    ["subprofile", "Subperfil", ["all", ...unique(patterns.map((p) => p.subprofile || p.segment))]],
    ["cognitiveLevel", "Nivel", ["all", ...unique(patterns.map((p) => p.cognitiveLevel || p.cognitivePath))]],
  ];
  patternFilters.innerHTML = groups.map(([kind, label, values]) => values.map((value) => `<button class="filter ${patternFilterState[kind] === value ? "active" : ""} ${kind === "cause" && value !== "all" ? `cause-filter ${normalizeCause(value)}` : ""}" type="button" data-filter-kind="${kind}" data-filter-value="${escapeHtml(String(value))}">${kind === "cause" && value !== "all" ? "<span></span>" : ""}${value === "all" ? `Todos ${label}` : escapeHtml(String(value))}</button>`).join("")).join("");
}

function renderPatterns() {
  const filtered = patterns.filter(matchesPatternFilters);
  patternGrid.innerHTML = filtered.map(renderPatternCard).join("");
  patternState.innerHTML = filtered.length ? "" : '<div class="state-card">No hay patrones que coincidan con los filtros o la búsqueda.</div>';
}

function matchesPatternFilters(pattern) {
  const haystack = [pattern.title, pattern.summary, pattern.learning, pattern.cause, pattern.subprofile, pattern.segment, pattern.cognitiveLevel, pattern.cognitivePath, pattern.cycleName].join(" ").toLowerCase();
  return ["type", "cause"].every((key) => patternFilterState[key] === "all" || String(pattern[key]).toLowerCase() === patternFilterState[key].toLowerCase())
    && (patternFilterState.subprofile === "all" || String(pattern.subprofile || pattern.segment).toLowerCase() === patternFilterState.subprofile.toLowerCase())
    && (patternFilterState.cognitiveLevel === "all" || String(pattern.cognitiveLevel || pattern.cognitivePath).toLowerCase() === patternFilterState.cognitiveLevel.toLowerCase())
    && (!patternFilterState.search || haystack.includes(patternFilterState.search));
}

function renderPatternCard(pattern) {
  const type = pattern.type || "Patrón";
  const cause = normalizeCause(pattern.cause);
  return `<article class="pattern-card"><span class="type-badge ${/anti/i.test(type) ? "anti" : "pattern"}">${escapeHtml(type)}</span><h2>${escapeHtml(pattern.title || "Patrón sin título")}</h2><div class="chip-row"><span class="chip cause ${cause}"><span class="dot"></span>${escapeHtml(pattern.cause || "Sin causa")}</span><span class="chip neutral">${escapeHtml(pattern.subprofile || pattern.segment || "Sin subperfil")}</span><span class="chip neutral">${escapeHtml(pattern.cognitiveLevel || pattern.cognitivePath || "Sin nivel")}</span></div><p><strong>Qué aprendimos:</strong> ${escapeHtml(pattern.learning || pattern.summary || "Sin aprendizaje registrado.")}</p><footer><a href="${escapeHtml(pattern.cycleUrl || "#")}">${escapeHtml(pattern.cycleName || "Ciclo relacionado")}</a><span>${escapeHtml(pattern.meta || pattern.reusedLabel || "")}</span></footer></article>`;
}

async function loadContext() {
  contextLoaded = true;
  contextBody.innerHTML = '<div class="state-card">Cargando contexto…</div>';
  try {
    contextPayload = await fetchJson("/api/context");
    renderContext();
  } catch (error) {
    contextBody.innerHTML = `<div class="state-card error">No pudimos cargar el contexto. ${escapeHtml(error.message)}</div>`;
  }
}

function renderContext() {
  const sections = listFromPayload(contextPayload, "sections");
  const canEdit = Boolean(contextPayload?.permissions?.canEdit || contextPayload?.canEdit);
  const pending = countPendingConfirmations(sections);
  contextBody.innerHTML = `<div class="confirm-banner">${pending} campos sin confirmar — la IA los tratará como supuestos.</div><h1 id="doctrina">Contexto Dropi</h1><p>Base de conocimiento editable para doctrina, perfiles, OKRs y Dropi Score.</p>${sections.map((section) => renderContextSection(section, canEdit)).join("")}`;
}

function renderContextSection(section, canEdit) {
  const fields = Array.isArray(section.fields) ? section.fields : [];
  const content = fields.length ? fields.map((field) => `<div class="editable-block" ${canEdit ? 'contenteditable="true"' : ""}><strong>${escapeHtml(field.label || field.name || "Campo")}</strong>: ${escapeHtml(field.value || "")} ${field.confirmed === false ? '<span class="inline-confirm">[CONFIRMAR]</span>' : ""}</div>`).join("") : `<div class="editable-block" ${canEdit ? 'contenteditable="true"' : ""}>${escapeHtml(section.content || "")}${section.confirmed === false ? ' <span class="inline-confirm">[CONFIRMAR]</span>' : ""}</div>`;
  return `<h2 id="${escapeHtml(section.id || slug(section.title || "seccion"))}">${escapeHtml(section.title || "Sección")}</h2>${content}`;
}

function countPendingConfirmations(sections) {
  return sections.reduce((count, section) => count + (section.confirmed === false ? 1 : 0) + (section.fields || []).filter((field) => field.confirmed === false).length, 0);
}

function renderMiniStepper(activeIndex) {
  return Array.from({ length: 6 }, (_, index) => `<span class="${index < activeIndex ? "done" : index === activeIndex ? "active" : ""}"></span>`).join("");
}

function normalizeCause(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("mot")) return "motivation";
  if (text.includes("prompt")) return "prompt";
  return text.includes("abil") ? "ability" : "neutral";
}

function statusClass(status = "") {
  return /iter/i.test(status) ? "iterating" : "live";
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function slug(value) {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
