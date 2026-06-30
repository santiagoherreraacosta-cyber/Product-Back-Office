// --- Constants ---
const THEME_KEY = "dropi-workspace-theme";
const TOKEN_KEY = "dropi-token";

// --- DOM refs ---
const loginView = document.querySelector("#loginView");
const loginForm = document.querySelector("#loginForm");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");

const workspace = document.querySelector("#workspace");
const phaseStepper = document.querySelector("#phaseStepper");
const activePhaseLabel = document.querySelector("#activePhaseLabel");
const activePhaseNote = document.querySelector("#activePhaseNote");
const activeCycleName = document.querySelector("#activeCycleName");
const activeCycleCard = document.querySelector("#activeCycleCard");
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
const briefCycleTitle = document.querySelector("#briefCycleTitle");
const viewButtons = document.querySelectorAll("[data-view-target]");
const homeView = document.querySelector("#homeView");
const workspaceView = document.querySelector("#workspaceView");
const libraryView = document.querySelector("#libraryView");
const contextView = document.querySelector("#contextView");
const contextDocuments = document.querySelector("#contextDocuments");
const contextPendingBanner = document.querySelector("#contextPendingBanner");
const newCycleButton = document.querySelector("#newCycleButton");
const newCycleEmpty = document.querySelector("#newCycleEmpty");
const emptyCycles = document.querySelector("#emptyCycles");
const cyclesList = document.querySelector("#cyclesList");
const patternsList = document.querySelector("#patternsList");
const briefSwitch = document.querySelector("#briefSwitch");
const experimentSwitch = document.querySelector("#experimentSwitch");
const deliverableTitle = document.querySelector("#deliverableTitle");
const briefBody = document.querySelector("#briefBody");
const experimentBody = document.querySelector("#experimentBody");
const paletteSearch = document.querySelector("#paletteSearch");
const logoutButton = document.querySelector("#logoutButton");
const userEmailEl = document.querySelector("#userEmail");

// --- Phase seed (template for new cycles) ---
const phaseSeed = [
  { key: "F0", label: "Sense", state: "active" },
  { key: "F1", label: "Diagnose", state: "todo" },
  { key: "F2", label: "Design", state: "todo" },
  { key: "F3", label: "Decide", state: "todo" },
  { key: "F4", label: "Deploy", state: "todo" },
  { key: "F5", label: "Distill", state: "todo" },
];

const prompts = [
  "¿Qué comportamiento debe ocurrir, y por qué no ocurre hoy?",
  "Trae la evidencia: ¿qué dato sostiene la causa Ability?",
  "Si avanzas sin gate, ¿qué riesgo aceptas explícitamente?",
  "¿Cuál sería el cambio mínimo para mover el comportamiento?",
];

// --- App state ---
let currentUser = null;
let currentCycleId = null;
let cycles = [];
let patterns = [];
let filled = 0;
let currentView = "workspace";
let deliverable = "brief";
let contextLoaded = false;
let promptIndex = 0;

// --- Auth helpers ---
function getToken() { return localStorage.getItem(TOKEN_KEY); }

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` };
}

function getCurrentCycle() {
  return cycles.find((c) => c.id === currentCycleId) ?? null;
}

// Derived state from current cycle
function getPhases() {
  return getCurrentCycle()?.phases ?? structuredClone(phaseSeed);
}

function getActivePhase() {
  return getCurrentCycle()?.activePhase ?? "F0";
}

function isRiskAccepted() {
  return getCurrentCycle()?.riskAccepted ?? false;
}

// --- Auth flow ---
function showLogin() {
  loginView.hidden = false;
  workspace.hidden = true;
}

function showApp() {
  loginView.hidden = true;
  workspace.hidden = false;
  userEmailEl.textContent = currentUser?.email ?? "";
}

async function checkAuth() {
  const token = getToken();
  if (!token) { showLogin(); return; }
  try {
    const res = await fetch("/api/auth/me", { headers: authHeaders() });
    if (!res.ok) { localStorage.removeItem(TOKEN_KEY); showLogin(); return; }
    currentUser = await res.json();
    showApp();
    await loadInitialData();
  } catch {
    showLogin();
  }
}

async function login(email, password) {
  loginError.hidden = true;
  const submitBtn = loginForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando…";
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      loginError.textContent = "Credenciales incorrectas. Revisa email y contraseña.";
      loginError.hidden = false;
      return;
    }
    const { token, user } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    currentUser = user;
    showApp();
    await loadInitialData();
  } catch {
    loginError.textContent = "No se pudo conectar con el servidor.";
    loginError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  currentCycleId = null;
  cycles = [];
  patterns = [];
  contextLoaded = false;
  showLogin();
}

// --- Init ---
async function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  rotatePlaceholder();
  setInterval(rotatePlaceholder, 4200);
  await checkAuth();
}

async function loadInitialData() {
  await Promise.all([loadCycles(), loadPatterns()]);
  renderStepper();
  renderMessages();
  setView("workspace");
  renderBriefState();
}

// --- Cycles ---
async function loadCycles() {
  try {
    const res = await fetch("/api/cycles", { headers: authHeaders() });
    if (!res.ok) return;
    cycles = await res.json();
    // Auto-select most recent cycle
    if (cycles.length && !currentCycleId) {
      currentCycleId = cycles[cycles.length - 1].id;
    }
    renderCyclesList();
    renderActiveCycle();
  } catch {
    console.warn("No se pudieron cargar los ciclos.");
  }
}

async function createCycle(title) {
  try {
    const res = await fetch("/api/cycles", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title,
        phases: structuredClone(phaseSeed),
        activePhase: "F0",
        riskAccepted: false,
      }),
    });
    if (!res.ok) return;
    const cycle = await res.json();
    cycles.push(cycle);
    currentCycleId = cycle.id;
    renderCyclesList();
    renderActiveCycle();
    renderStepper();
    renderBriefState();
    briefCycleTitle.textContent = cycle.title;
    addAiNote(`Nuevo ciclo "${escapeHtml(cycle.title)}" en F0 · Sense. Empecemos: ¿qué seller, haciendo qué, no está haciendo qué?`);
    setView("workspace");
  } catch {
    console.warn("No se pudo crear el ciclo.");
  }
}

async function updateCycle(patch) {
  if (!currentCycleId) return;
  try {
    const res = await fetch(`/api/cycles/${currentCycleId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const updated = await res.json();
    cycles = cycles.map((c) => (c.id === currentCycleId ? updated : c));
    renderCyclesList();
  } catch {
    console.warn("No se pudo actualizar el ciclo.");
  }
}

function renderCyclesList() {
  if (!cycles.length) {
    cyclesList.innerHTML = "";
    emptyCycles.hidden = false;
    return;
  }
  emptyCycles.hidden = true;
  cyclesList.innerHTML = cycles
    .map((cycle) => {
      const phases = cycle.phases ?? phaseSeed;
      const active = cycle.activePhase ?? "F0";
      const activePhaseObj = phases.find((p) => p.key === active) ?? phases[0];
      const miniDots = phases
        .map((p) => `<span class="${p.state}"></span>`)
        .join("");
      const since = new Date(cycle.updatedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
      return `
        <article class="dashboard-card ${cycle.id === currentCycleId ? "is-active" : ""}" data-cycle-id="${escapeHtml(cycle.id)}">
          <div class="card-topline"><span class="status-pill live">En curso</span><span>${escapeHtml(since)}</span></div>
          <h2>${escapeHtml(cycle.title)}</h2>
          <div class="mini-stepper" aria-label="Fases F0 a F5">${miniDots}</div>
          <footer><strong>${escapeHtml(activePhaseObj.key)} · ${escapeHtml(activePhaseObj.label)}</strong>${cycle.riskAccepted ? '<span class="risk-count">riesgo abierto</span>' : ""}</footer>
        </article>`;
    })
    .join("");

  cyclesList.querySelectorAll("[data-cycle-id]").forEach((card) => {
    card.addEventListener("click", () => {
      currentCycleId = card.dataset.cycleId;
      renderCyclesList();
      renderActiveCycle();
      renderStepper();
      renderBriefState();
      setView("workspace");
    });
  });
}

function renderActiveCycle() {
  const cycle = getCurrentCycle();
  if (!cycle) {
    activeCycleCard.innerHTML = `<p class="muted">Sin ciclo activo</p>`;
    activeCycleName.textContent = "Sin ciclo activo";
    activePhaseLabel.textContent = "—";
    activePhaseNote.textContent = "";
    briefCycleTitle.textContent = "[CONFIRMAR]";
    return;
  }
  const phases = cycle.phases ?? phaseSeed;
  const active = cycle.activePhase ?? "F0";
  const activePhaseObj = phases.find((p) => p.key === active) ?? phases[0];
  activeCycleCard.innerHTML = `<h2>${escapeHtml(cycle.title)}</h2>`;
  activeCycleName.textContent = cycle.title;
  activePhaseLabel.textContent = `${activePhaseObj.key} · ${activePhaseObj.label}`;
  activePhaseNote.textContent = activePhaseObj.note || "gate abierto";
  briefCycleTitle.textContent = cycle.title;
}

// --- Patterns ---
async function loadPatterns() {
  try {
    const res = await fetch("/api/patterns", { headers: authHeaders() });
    if (!res.ok) return;
    patterns = await res.json();
    if (currentView === "library") renderPatternsList();
  } catch {
    console.warn("No se pudieron cargar los patrones.");
  }
}

function renderPatternsList() {
  if (!patterns.length) {
    patternsList.innerHTML = `<p class="empty-library">Aún no hay patrones. Cierra tu primer ciclo en F5 y aparecerá aquí.</p>`;
    return;
  }
  patternsList.innerHTML = patterns
    .map((p) => {
      const isAnti = p.type === "anti-pattern";
      const badgeClass = isAnti ? "anti" : "pattern";
      const badgeText = isAnti ? "ANTI-PATRÓN" : "PATRÓN";
      const since = p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
      return `
        <article class="pattern-card">
          <span class="type-badge ${badgeClass}">${badgeText}</span>
          <h2>${escapeHtml(p.name)}</h2>
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
          <footer><span>${escapeHtml(since)}</span></footer>
        </article>`;
    })
    .join("");
}

// --- View ---
function setView(view) {
  currentView = view;
  workspace.dataset.view = view;
  homeView.hidden = view !== "home";
  workspaceView.hidden = view !== "workspace";
  libraryView.hidden = view !== "library";
  contextView.hidden = view !== "context";
  if (view === "context" && !contextLoaded) loadContextDocuments();
  if (view === "library") renderPatternsList();
}

// --- Context ---
async function loadContextDocuments() {
  contextPendingBanner.textContent = "Cargando contexto…";
  try {
    const response = await fetch("/api/context");
    if (!response.ok) throw new Error("No se pudo cargar el contexto.");
    const data = await response.json();
    contextLoaded = true;
    renderContextDocuments(data);
  } catch (error) {
    contextPendingBanner.textContent = `${error.message} Revisa que el backend Node esté corriendo.`;
  }
}

function renderContextDocuments(data) {
  contextPendingBanner.textContent = `${data.pendingCount} campos pendientes [CONFIRMAR] — la IA los tratará como supuestos.`;
  contextDocuments.innerHTML = data.documents
    .map((doc) => `
      <section class="context-document" data-context-id="${escapeHtml(doc.id)}">
        <header><h2>${escapeHtml(doc.title)}</h2><span>v${escapeHtml(String(doc.version))} · ${escapeHtml(String(doc.pendingCount))} pendientes</span></header>
        <textarea aria-label="Editar ${escapeHtml(doc.title)}">${escapeHtml(doc.content)}</textarea>
        <footer><span>Actualizado por ${escapeHtml(doc.updatedBy)} · ${escapeHtml(new Date(doc.updatedAt).toLocaleString("es-CO"))}</span><button class="secondary-action" type="button" data-save-context>Guardar como admin</button></footer>
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
    const response = await fetch(`/api/context/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ content, reason: "Edición desde Contexto Dropi" }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error ${response.status}`);
    }
    contextLoaded = false;
    await loadContextDocuments();
  } catch (error) {
    button.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

// --- Brief / deliverable ---
function setDeliverable(next) {
  deliverable = next;
  briefBody.hidden = next !== "brief";
  experimentBody.hidden = next !== "experiment";
  briefSwitch.classList.toggle("active", next === "brief");
  experimentSwitch.classList.toggle("active", next === "experiment");
  deliverableTitle.textContent = next === "brief" ? "Intervention Brief" : "Experiment Card";
  progressText.textContent = next === "brief" ? `${filled} / 11` : "0 / 9";
  progressFill.style.width = next === "brief" ? `${Math.round((filled / 11) * 100)}%` : "0%";
}

function applyTheme(theme) {
  workspace.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === "dark" ? "☀" : "☾";
}

// --- Stepper ---
function renderStepper() {
  const phases = getPhases();
  const active = getActivePhase();

  phaseStepper.innerHTML = phases
    .map((phase, index) => {
      const statusMark = phase.state === "done" ? "✓" : index;
      const skipped = phase.skipped ? '<span class="skipped-pin" aria-label="gate saltado"></span>' : "";
      const note = phase.note ? `<span class="phase-note">${escapeHtml(phase.note)}</span>` : "";
      return `
        <button class="phase-row ${phase.state} ${phase.skipped ? "skipped" : ""}" type="button" data-phase="${escapeHtml(phase.key)}">
          <span class="phase-dot">${statusMark}</span>
          <span class="phase-copy">
            <span class="phase-label-line"><strong>${escapeHtml(phase.key)} ${escapeHtml(phase.label)}</strong>${skipped}</span>
            ${note}
          </span>
        </button>`;
    })
    .join("");

  const selected = phases.find((p) => p.key === active) ?? phases[0];
  if (selected) {
    activePhaseLabel.textContent = `${selected.key} · ${selected.label}`;
    activePhaseNote.textContent = selected.note || "";
  }
}

// --- Messages ---
function renderMessages() {
  const cycle = getCurrentCycle();
  messageStream.innerHTML = `<div class="stream-inner"></div>`;
  if (!cycle) {
    addAiNote("Bienvenido. Crea un nuevo ciclo desde Ciclos o usa /nuevo-ciclo para empezar.");
  } else {
    addAiNote(`Ciclo cargado: "${escapeHtml(cycle.title)}" · ${escapeHtml(cycle.activePhase ?? "F0")}. ¿Cómo te puedo ayudar?`);
  }
}

// --- Chat ---
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  const inner = messageStream.querySelector(".stream-inner");
  inner.insertAdjacentHTML("beforeend", `<div class="user-message">${escapeHtml(text)}</div>`);
  messageInput.value = "";
  chatInput.classList.remove("has-text");

  if (text.startsWith("/nuevo-ciclo")) {
    const title = text.replace("/nuevo-ciclo", "").trim() || prompt("Nombre del ciclo:");
    if (title) await createCycle(title);
    return;
  }

  if (text.startsWith("/brief")) {
    downloadBrief();
    addAiNote("Brief exportado en Markdown. También queda vivo en el panel derecho.");
    return;
  }

  if (text.startsWith("/experimento")) {
    setDeliverable("experiment");
    addAiNote("Cambiando a Experiment Card. Completa los campos de hipótesis, métrica y criterio de stop.");
    return;
  }

  // Real LLM call
  inner.insertAdjacentHTML(
    "beforeend",
    `<article class="ai-message"><div class="ai-avatar">D</div><div class="ai-body"><p class="thinking">…</p></div></article>`
  );
  messageStream.scrollTop = messageStream.scrollHeight;
  const thinkingEl = inner.querySelector(".ai-message:last-child .ai-body p");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message: text, cycleId: currentCycleId }),
    });
    const data = await res.json();
    thinkingEl.classList.remove("thinking");
    thinkingEl.textContent = data.reply ?? data.error ?? "Sin respuesta.";
  } catch {
    thinkingEl.classList.remove("thinking");
    thinkingEl.textContent = "Error de conexión con el asistente.";
  }
  messageStream.scrollTop = messageStream.scrollHeight;
}

function addAiNote(content) {
  const inner = messageStream.querySelector(".stream-inner");
  if (!inner) return;
  inner.insertAdjacentHTML(
    "beforeend",
    `<article class="ai-message"><div class="ai-avatar">D</div><div class="ai-body"><p>${escapeHtml(content)}</p></div></article>`
  );
  messageStream.scrollTop = messageStream.scrollHeight;
}

// --- Phase actions ---
async function acceptRiskAndAdvance() {
  const phases = getPhases().map((phase) => {
    if (phase.key === "F1") return { ...phase, state: "done", note: "riesgo aceptado" };
    if (phase.key === "F2") return { ...phase, state: "active", note: "diseñar intervención" };
    return { ...phase, state: phase.state === "active" ? "todo" : phase.state };
  });
  const patch = { phases, activePhase: "F2", riskAccepted: true };
  await updateCycle(patch);
  // Update local state optimistically
  if (currentCycleId) {
    cycles = cycles.map((c) => c.id === currentCycleId ? { ...c, ...patch } : c);
  }
  setBriefProgress(Math.max(filled, 7));
  renderStepper();
  renderBriefState();
  addAiNote("Avanzamos a F2 con riesgo explícito. El brief mantiene el tag para que no parezca un diagnóstico cerrado.");
}

function renderBriefState() {
  const accepted = isRiskAccepted();
  riskTag.classList.toggle("is-hidden", !accepted);
  if (accepted) {
    const cycle = getCurrentCycle();
    const who = currentUser?.email ?? "usuario";
    const when = cycle?.updatedAt ? new Date(cycle.updatedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
    riskTag.innerHTML = `<span>F1</span> Diagnóstico con 1 sola fuente. Riesgo aceptado por ${escapeHtml(who)} · ${escapeHtml(when)}.`;
  }
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
  const cycle = getCurrentCycle();
  const title = cycle?.title ?? "[CONFIRMAR]";
  const behavior = document.querySelector("#briefBehavior")?.textContent?.trim() ?? "[CONFIRMAR]";
  const cause = document.querySelector("#briefCause")?.textContent?.trim() ?? "[CONFIRMAR]";
  const evidence = document.querySelector("#briefEvidence")?.textContent?.trim() ?? "[CONFIRMAR]";
  const source2 = secondSource?.textContent?.trim() ?? "[CONFIRMAR]";
  const hypothesis = hypothesisField?.textContent?.trim() ?? "[CONFIRMAR]";
  const metric = metricField?.textContent?.trim() ?? "[CONFIRMAR]";
  const who = currentUser?.email ?? "usuario";
  const when = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

  const markdown = [
    `# Intervention Brief`,
    ``,
    `## Ciclo`,
    title,
    ``,
    `## Comportamiento objetivo`,
    behavior,
    ``,
    `## Causa B=MAP`,
    cause,
    ``,
    `## Evidencia`,
    `- ${evidence}`,
    `- ${source2}`,
    ``,
    `## Hipótesis de intervención`,
    hypothesis,
    ``,
    `## Métrica de éxito`,
    metric,
    ``,
    `## Riesgos asumidos`,
    isRiskAccepted()
      ? `- F1: Diagnóstico con 1 sola fuente. Riesgo aceptado por ${who} · ${when}.`
      : `- Sin riesgos aceptados.`,
    ``,
    `---`,
    `*Exportado por ${who} · ${when}*`,
  ].join("\n");

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `intervention-brief-${(title).toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// --- Placeholder rotation ---
function rotatePlaceholder() {
  if (placeholder) placeholder.firstChild.textContent = prompts[promptIndex % prompts.length];
  promptIndex++;
}

// --- Escape HTML ---
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Event listeners ---
loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  login(loginEmail.value.trim(), loginPassword.value);
});

logoutButton?.addEventListener("click", logout);

themeToggle?.addEventListener("click", () => {
  const next = workspace.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

phaseStepper?.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-phase]");
  if (!row || !currentCycleId) return;
  const key = row.dataset.phase;
  const phases = getPhases().map((p) => ({ ...p, state: p.key === key ? "active" : p.state === "active" ? "todo" : p.state }));
  const patch = { phases, activePhase: key };
  cycles = cycles.map((c) => c.id === currentCycleId ? { ...c, ...patch } : c);
  renderStepper();
  await updateCycle(patch);
});

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage();
});

messageInput?.addEventListener("input", () => {
  chatInput.classList.toggle("has-text", messageInput.value.trim().length > 0);
});

messageInput?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.command + " ";
    chatInput.classList.add("has-text");
    messageInput.focus();
  });
});

commandButton?.addEventListener("click", () => { commandPalette.hidden = false; });

commandPalette?.addEventListener("click", (event) => {
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

exportBrief?.addEventListener("click", downloadBrief);

viewButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

newCycleButton?.addEventListener("click", () => {
  const title = prompt("Nombre del ciclo (describe el comportamiento):");
  if (title?.trim()) createCycle(title.trim());
});

newCycleEmpty?.addEventListener("click", () => {
  const title = prompt("Nombre del ciclo (describe el comportamiento):");
  if (title?.trim()) createCycle(title.trim());
});

briefSwitch?.addEventListener("click", () => setDeliverable("brief"));
experimentSwitch?.addEventListener("click", () => setDeliverable("experiment"));

paletteSearch?.addEventListener("input", () => {
  const term = paletteSearch.value.toLowerCase();
  commandPalette.querySelectorAll("[data-palette-command]").forEach((button) => {
    button.classList.toggle("is-hidden", !button.textContent.toLowerCase().includes(term));
  });
});

// --- Start ---
init();
