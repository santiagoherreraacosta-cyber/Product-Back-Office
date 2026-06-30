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

// Global fetch wrapper — catches 401 mid-session and forces re-login
async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    showToast("Sesión expirada. Inicia sesión de nuevo.", true);
    setTimeout(logout, 1500);
    throw new Error("Unauthorized");
  }
  return res;
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
  const roleLabel = currentUser?.role === "admin" ? " · admin" : currentUser?.role === "pm" ? " · pm" : "";
  userEmailEl.textContent = (currentUser?.email ?? "") + roleLabel;
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
  if (currentCycleId) {
    loadMessages(currentCycleId);
  } else {
    renderMessages([]);
  }
  // Land on Home when no cycles exist so the CTA is the first thing the user sees
  setView(cycles.length ? "workspace" : "home");
  renderBriefState();
}

// --- Cycles ---
async function loadCycles() {
  cyclesList.innerHTML = `<p class="loading-state">Cargando ciclos…</p>`;
  try {
    const res = await apiFetch("/api/cycles", { headers: authHeaders() });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    cycles = await res.json();
    if (cycles.length && !currentCycleId) {
      currentCycleId = cycles[cycles.length - 1].id;
    }
    renderCyclesList();
    renderActiveCycle();
  } catch {
    cyclesList.innerHTML = `<p class="error-state">No se pudieron cargar los ciclos. <button onclick="loadCycles()">Reintentar</button></p>`;
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
    renderActiveCycle();  // also calls loadBriefFromCycle internally
    renderStepper();
    renderBriefState();
    addAiNote(`Nuevo ciclo "${escapeHtml(cycle.title)}" en F0 · Sense. Empecemos: ¿qué seller, haciendo qué, no está haciendo qué?`);
    setView("workspace");
  } catch {
    console.warn("No se pudo crear el ciclo.");
  }
}

async function updateCycle(patch) {
  if (!currentCycleId) return;
  try {
    const res = await apiFetch(`/api/cycles/${currentCycleId}`, {
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
      const miniDots = phases.map((p) => `<span class="${p.state}"></span>`).join("");
      const since = new Date(cycle.updatedAt ?? cycle.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
      const causeLabel = cycle.causa === "M" ? "Motivación" : cycle.causa === "A" ? "Ability" : cycle.causa === "P" ? "Prompt" : null;
      const chips = [
        cycle.sub_perfil ? `<span class="chip">${escapeHtml(cycle.sub_perfil.replace(/_/g, " "))}</span>` : "",
        causeLabel ? `<span class="chip cause-chip ${escapeHtml(cycle.causa)}">${escapeHtml(causeLabel)}</span>` : "",
        cycle.transicion ? `<span class="chip">${escapeHtml(cycle.transicion.replace(/_/g, "→"))}</span>` : "",
      ].join("");
      const statusPill = cycle.estado === "cerrado"
        ? '<span class="status-pill closed">Cerrado</span>'
        : cycle.estado === "descartado"
          ? '<span class="status-pill discarded">Descartado</span>'
          : '<span class="status-pill live">En curso</span>';
      return `
        <article class="dashboard-card ${cycle.id === currentCycleId ? "is-active" : ""}" data-cycle-id="${escapeHtml(cycle.id)}">
          <div class="card-topline">${statusPill}<span>${escapeHtml(since)}</span></div>
          <h2>${escapeHtml(cycle.title)}</h2>
          ${chips ? `<div class="chips">${chips}</div>` : ""}
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
      loadMessages(currentCycleId);
      setView("workspace");
    });
  });
}

function renderActiveCycle() {
  const cycle = getCurrentCycle();
  const closePanel = document.getElementById("closePanel");
  if (!cycle) {
    activeCycleCard.innerHTML = `<p class="muted">Sin ciclo activo</p>`;
    activeCycleName.textContent = "Sin ciclo activo";
    activePhaseLabel.textContent = "—";
    activePhaseNote.textContent = "";
    briefCycleTitle.textContent = "[CONFIRMAR]";
    if (closePanel) closePanel.hidden = true;
    return;
  }
  const phases = cycle.phases ?? phaseSeed;
  const active = cycle.fase_actual ?? cycle.activePhase ?? "F0";
  const activePhaseObj = phases.find((p) => p.key === active) ?? phases[0];
  const isClosed = cycle.estado !== "activo";
  activeCycleCard.innerHTML = `<h2>${escapeHtml(cycle.title)}</h2>${isClosed ? `<span class="cycle-closed-badge">${escapeHtml(cycle.estado === "cerrado" ? "Cerrado" : "Descartado")}</span>` : ""}`;
  activeCycleName.textContent = cycle.title;
  activePhaseLabel.textContent = `${activePhaseObj.key} · ${activePhaseObj.label}`;
  activePhaseNote.textContent = activePhaseObj.note || "gate abierto";
  briefCycleTitle.textContent = cycle.title;
  // Show close panel only in F5 and only for active cycles
  if (closePanel) closePanel.hidden = !(active === "F5" && cycle.estado === "activo");
  // Show F1→F2 advance button with appropriate label based on diagnosis quality
  const advanceBtn = document.querySelector("#advancePhaseBtn");
  if (advanceBtn) {
    const showAdvance = active === "F1" && cycle.estado === "activo";
    advanceBtn.hidden = !showAdvance;
    if (showAdvance) {
      const clean = !!(cycle.causa && cycle.brief?.evidencia_primaria?.confirmed);
      advanceBtn.textContent = clean ? "Avanzar a F2 ✓" : "Avanzar a F2 con riesgo ⚠";
      advanceBtn.dataset.clean = clean ? "1" : "";
    }
  }
  // Populate brief panel from real cycle data
  loadBriefFromCycle(cycle);
  // Grey out chat input for closed/discarded cycles
  chatInput?.classList.toggle("is-readonly", isClosed);
  if (messageInput) messageInput.placeholder = isClosed ? "Ciclo cerrado — solo lectura" : "";
  if (placeholder) placeholder.style.display = isClosed ? "none" : "";
}

async function reusePattern(patternId) {
  try {
    const res = await apiFetch(`/api/patterns/${patternId}/reuse`, { method: "POST", headers: authHeaders() });
    if (!res.ok) return;
    const { newCycle } = await res.json();
    // Refresh patterns to get updated veces_reutilizado
    await loadPatterns();
    cycles.push(newCycle);
    currentCycleId = newCycle.id;
    renderCyclesList();
    renderActiveCycle();
    renderStepper();
    renderBriefState();
    renderMessages([]);
    addAiNote(`Reutilizando patrón: "${escapeHtml(newCycle.title)}". Confirma el contexto y ajusta la hipótesis antes de avanzar.`);
    setView("workspace");
  } catch {
    console.warn("No se pudo reutilizar el patrón.");
  }
}

async function closeCycle() {
  const closureDecision = document.getElementById("closureDecision");
  const closureLearning = document.getElementById("closureLearning");
  const closureDelta = document.getElementById("closureDelta");
  const patternName = document.getElementById("patternName");
  const patternType = document.getElementById("patternType");
  const learning = closureLearning?.value.trim() ?? "";
  const pattern_name = patternName?.value.trim() ?? "";
  if (!learning || !pattern_name) {
    alert("Completa el aprendizaje y el nombre del patrón para cerrar el ciclo.");
    return;
  }
  if (!confirm(`¿Cerrar el ciclo y crear el patrón "${pattern_name}"? Esta acción no se puede deshacer.`)) return;
  try {
    const res = await apiFetch(`/api/cycles/${currentCycleId}/close`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        resultado_cierre: closureDecision?.value ?? "escalado",
        decision: closureDecision?.value ?? "escalado",
        learning,
        delta: closureDelta?.value.trim() ?? null,
        pattern_name,
        tipo: patternType?.value ?? "patron",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Error al cerrar el ciclo.");
      return;
    }
    const { cycle, pattern } = await res.json();
    cycles = cycles.map((c) => (c.id === cycle.id ? cycle : c));
    patterns.push(pattern);
    renderCyclesList();
    renderPatternsList();
    renderActiveCycle();
    renderStepper();
    addAiNote(`Ciclo cerrado. Patrón "${escapeHtml(pattern.nombre)}" creado en la Biblioteca.`);
    showToast(`Patrón "${pattern.nombre}" guardado en la Biblioteca.`);
    setView("home");
  } catch {
    showToast("No se pudo cerrar el ciclo. Intenta de nuevo.", true);
  }
}

// --- Patterns ---
async function loadPatterns() {
  try {
    const res = await apiFetch("/api/patterns", { headers: authHeaders() });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    patterns = await res.json();
    if (currentView === "library") renderPatternsList();
  } catch {
    if (currentView === "library") {
      patternsList.innerHTML = `<p class="error-state">No se pudieron cargar los patrones. <button onclick="loadPatterns()">Reintentar</button></p>`;
    }
  }
}

function renderPatternsList(list = patterns) {
  if (!list.length) {
    patternsList.innerHTML = `<p class="empty-library">Aún no hay patrones. Cierra tu primer ciclo en F5 y aparecerá aquí.</p>`;
    return;
  }
  const causeLabel = (c) => c === "M" ? "Motivación" : c === "A" ? "Ability" : c === "P" ? "Prompt" : c;
  patternsList.innerHTML = list
    .map((p) => {
      const isAnti = p.tipo === "anti_patron";
      const since = p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
      const chips = [
        p.causa ? `<span class="chip cause-chip ${escapeHtml(p.causa)}">${escapeHtml(causeLabel(p.causa))}</span>` : "",
        p.sub_perfil ? `<span class="chip">${escapeHtml(p.sub_perfil.replace(/_/g, " "))}</span>` : "",
        p.transicion ? `<span class="chip">${escapeHtml(p.transicion.replace(/_/g, "→"))}</span>` : "",
      ].join("");
      return `
        <article class="pattern-card">
          <span class="pattern-badge ${isAnti ? "anti_patron" : "patron"}">${isAnti ? "Anti-patrón" : "Patrón"}</span>
          <h2>${escapeHtml(p.nombre ?? p.name ?? "Sin nombre")}</h2>
          ${p.aprendizaje ? `<p class="pattern-learning">${escapeHtml(p.aprendizaje)}</p>` : ""}
          ${chips ? `<div class="chips">${chips}</div>` : ""}
          ${p.delta_metrica ? `<span class="delta">${escapeHtml(p.delta_metrica)}</span>` : ""}
          <footer>
            <span class="reuse-count">${p.veces_reutilizado ?? 0}× reutilizado</span>
            <span>${escapeHtml(since)}</span>
            <button class="reuse-btn" type="button" data-pattern-id="${escapeHtml(p.id)}">Reusar →</button>
          </footer>
        </article>`;
    })
    .join("");

  patternsList.querySelectorAll(".reuse-btn").forEach((btn) => {
    btn.addEventListener("click", () => reusePattern(btn.dataset.patternId));
  });
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
        <footer><span>Actualizado por ${escapeHtml(doc.updatedBy)} · ${escapeHtml(new Date(doc.updatedAt).toLocaleString("es-CO"))}</span><button class="secondary-action" type="button" data-save-context ${currentUser?.role !== "admin" ? 'disabled title="Solo admins pueden guardar"' : ""}>Guardar${currentUser?.role === "admin" ? " ✓" : " (solo admins)"}</button></footer>
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
    showToast("Contexto guardado.");
    await loadContextDocuments();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Guardar como admin";
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
// Convert LLM Markdown output to safe HTML — no external dependencies
function renderMarkdown(text) {
  if (!text) return "";
  // 1. Escape HTML entities first (XSS protection)
  let s = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Fenced code blocks (must run before inline code)
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.trimEnd()}</code></pre>`);

  // 3. Inline code
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 4. Line-by-line pass for headings, lists, blockquotes, HR
  const lines = s.split("\n");
  const out = [];
  let inUl = false, inOl = false;

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line))     { closeLists(); out.push(`<h4>${line.slice(4)}</h4>`); continue; }
    if (/^## /.test(line))      { closeLists(); out.push(`<h3>${line.slice(3)}</h3>`); continue; }
    if (/^# /.test(line))       { closeLists(); out.push(`<h3>${line.slice(2)}</h3>`); continue; }
    if (/^&gt; /.test(line))    { closeLists(); out.push(`<blockquote>${line.slice(5)}</blockquote>`); continue; }
    if (/^---+$/.test(line))    { closeLists(); out.push("<hr>"); continue; }
    if (/^[-*] /.test(line)) {
      if (!inUl) { if (inOl) { out.push("</ol>"); inOl = false; } out.push("<ul>"); inUl = true; }
      out.push(`<li>${line.slice(2)}</li>`); continue;
    }
    if (/^\d+\. /.test(line)) {
      if (!inOl) { if (inUl) { out.push("</ul>"); inUl = false; } out.push("<ol>"); inOl = true; }
      out.push(`<li>${line.replace(/^\d+\. /, "")}</li>`); continue;
    }
    closeLists();
    if (!line.trim()) { out.push(""); continue; }
    out.push(line);
  }
  closeLists();
  s = out.join("\n");

  // 5. Bold and italic (after line processing to avoid breaking list tags)
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  // 6. Wrap plain-text runs in <p>, convert single \n to <br> within paragraphs
  const blocks = s.split(/\n{2,}/);
  s = blocks.map((block) => {
    const t = block.trim();
    if (!t) return "";
    if (/^<(h[2-4]|ul|ol|pre|hr|blockquote)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return s;
}

function loadMessages(cycleId) {
  const cycle = cycles.find((c) => c.id === cycleId);
  const msgs = cycle?.messages ?? [];
  renderMessages(msgs);
}

function renderMessages(msgs) {
  messageStream.innerHTML = `<div class="stream-inner"></div>`;
  const inner = messageStream.querySelector(".stream-inner");
  if (!msgs || !msgs.length) {
    const cycle = getCurrentCycle();
    if (!cycle) {
      addAiNote("Bienvenido. Crea un nuevo ciclo desde Ciclos o usa /nuevo-ciclo para empezar.");
    } else {
      addAiNote(`Ciclo: "${escapeHtml(cycle.title)}" · ${escapeHtml(cycle.fase_actual ?? cycle.activePhase ?? "F0")}. ¿Cómo te puedo ayudar?`);
    }
    return;
  }
  msgs.forEach((m) => {
    if (m.role === "user") {
      inner.insertAdjacentHTML("beforeend", `<div class="user-message">${escapeHtml(m.content)}</div>`);
    } else {
      inner.insertAdjacentHTML("beforeend",
        `<article class="ai-message"><div class="ai-avatar">D</div><div class="ai-body">${renderMarkdown(m.content)}</div></article>`);
    }
  });
  messageStream.scrollTop = messageStream.scrollHeight;
}

// --- Chat ---
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  // Closed/discarded cycles are read-only
  const activeCycleCheck = getCurrentCycle();
  if (activeCycleCheck && activeCycleCheck.estado !== "activo") {
    showToast("Este ciclo está cerrado. Crea uno nuevo o reutiliza el patrón desde la Biblioteca.");
    return;
  }
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
    const res = await apiFetch("/api/chat", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ message: text, cycleId: currentCycleId }),
    });
    const data = await res.json();
    thinkingEl.classList.remove("thinking");
    const reply = data.reply ?? data.error ?? "Sin respuesta.";
    thinkingEl.innerHTML = renderMarkdown(reply);
    // Keep local cycle.messages in sync so history is correct on re-select
    const activeCycle = getCurrentCycle();
    if (activeCycle) {
      const now = new Date().toISOString();
      activeCycle.messages = [
        ...(activeCycle.messages ?? []),
        { id: `u-${Date.now()}`, role: "user", content: text, created_at: now },
        { id: `a-${Date.now()}`, role: "assistant", content: reply, created_at: now },
      ];
      cycles = cycles.map((c) => (c.id === currentCycleId ? activeCycle : c));
    }
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
  const advanceBtn = document.querySelector("#advancePhaseBtn");
  const isClean = advanceBtn?.dataset.clean === "1";
  const phases = getPhases().map((phase) => {
    if (phase.key === "F1") return { ...phase, state: "done", note: isClean ? "diagnóstico completo" : "riesgo aceptado" };
    if (phase.key === "F2") return { ...phase, state: "active", note: "diseñar intervención" };
    return { ...phase, state: phase.state === "active" ? "todo" : phase.state };
  });
  const patch = { phases, activePhase: "F2", fase_actual: "F2", riskAccepted: !isClean };
  await updateCycle(patch);
  // Update local state optimistically
  if (currentCycleId) {
    cycles = cycles.map((c) => c.id === currentCycleId ? { ...c, ...patch } : c);
  }
  setBriefProgress(Math.max(filled, 7));
  renderStepper();
  renderBriefState();
  const msg = isClean
    ? "Diagnóstico completo. Avanzamos a F2 · Design para definir la intervención."
    : "Avanzamos a F2 con riesgo explícito. El brief mantiene el tag para que no parezca un diagnóstico cerrado.";
  addAiNote(msg);
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

// --- Deep merge and path utilities ---
function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === "object" && !Array.isArray(source[k]) && target[k] && typeof target[k] === "object")
      out[k] = deepMerge(target[k], source[k]);
    else out[k] = source[k];
  }
  return out;
}

function setNestedPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = cur[keys[i]] ?? {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// Make a brief/experiment panel field inline-editable. cyclePath is "brief.behavior_statement", "sub_perfil", etc.
function makeFieldEditable(el, cyclePath) {
  if (!el) return;
  if (el.dataset.editableRegistered) return;
  el.dataset.editableRegistered = "1";
  el.style.cursor = "pointer";
  el.title = "Click para editar";
  el.addEventListener("click", () => {
    if (el.dataset.editing) return;
    el.dataset.editing = "1";
    const isConfirm = el.classList.contains("confirm-field");
    const current = isConfirm ? "" : el.textContent.trim();
    const input = document.createElement("input");
    input.className = "brief-inline-input";
    input.value = current;
    el.replaceWith(input);
    input.focus();
    const save = async () => {
      const val = input.value.trim();
      const patch = {};
      if (cyclePath === "sub_perfil") {
        patch.sub_perfil = val || null;
      } else {
        setNestedPath(patch, cyclePath, { value: val, confirmed: !!val });
      }
      if (currentCycleId) {
        cycles = cycles.map((c) => c.id === currentCycleId ? deepMerge(c, patch) : c);
        try { await updateCycle(patch); } catch { /* non-blocking */ }
      }
      renderActiveCycle();
    };
    input.addEventListener("blur", save);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = current; input.blur(); }
    });
  });
}

// Populate a brief panel DOM element with a real value or reset to [CONFIRMAR]
function setField(el, value) {
  if (!el) return;
  if (value) {
    el.textContent = value;
    el.classList.remove("confirm-field");
    el.classList.add("mono-value");
  } else {
    el.innerHTML = "<strong>[CONFIRMAR]</strong>";
    el.classList.add("confirm-field");
    el.classList.remove("mono-value");
  }
}

// Read cycle.brief{} and cycle top-level fields → populate all brief panel DOM elements
function loadBriefFromCycle(cycle) {
  const b = cycle?.brief ?? {};
  const causeMap = { M: "Motivación", A: "Ability", P: "Prompt" };

  // Brief panel fields
  const briefBehavior = document.querySelector("#briefBehavior");
  const briefSubProfile = document.querySelector("#briefSubProfile");
  const briefCogLevel = document.querySelector("#briefCogLevel");
  const briefEvidence = document.querySelector("#briefEvidence");

  setField(briefBehavior, b.behavior_statement?.value ?? null);
  setField(briefSubProfile, cycle?.sub_perfil?.replace(/_/g, " ") ?? null);
  setField(briefCogLevel, b.nivel_cognitivo?.value ?? (cycle?.transicion ? cycle.transicion.replace(/_/g, "→") : null));
  setField(briefEvidence, b.evidencia_primaria?.value ?? null);
  setField(secondSource, b.segunda_fuente?.value ?? null);
  setField(hypothesisField, b.hipotesis?.value ?? b.intervencion?.value ?? null);
  setField(metricField, b.senal_cuantitativa?.value ?? null);

  // B=MAP selector sync
  const activeCause = cycle?.causa;
  document.querySelectorAll(".bmap-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.cause === activeCause));

  // Experiment card — all fields
  const exp = cycle?.experiment ?? {};
  const expStr = (v) => v?.value ?? (typeof v === "string" ? v : null);
  const expHypothesis = document.querySelector("#experimentHypothesis");
  const expVariable = document.querySelector("#experimentVariable");
  const expMetric = document.querySelector("#experimentMetric");
  const expStop = document.querySelector("#experimentStop");
  const expSample = document.querySelector("#experimentSample");
  const expDuration = document.querySelector("#experimentDuration");
  const expTracking = document.querySelector("#experimentTracking");

  setField(expHypothesis, expStr(exp.hipotesis));
  setField(expVariable, expStr(exp.variable));
  setField(expMetric, expStr(exp.metrica_primaria));
  setField(expStop, expStr(exp.criterio_stop));
  setField(expSample, expStr(exp.tamano_muestra));
  setField(expDuration, expStr(exp.duracion));
  const trackVal = Array.isArray(exp.tracking_eventos) && exp.tracking_eventos.length
    ? exp.tracking_eventos.join(", ") : expStr(exp.tracking_eventos);
  setField(expTracking, trackVal);

  // Make brief fields inline-editable
  makeFieldEditable(briefBehavior, "brief.behavior_statement");
  makeFieldEditable(briefSubProfile, "sub_perfil");
  makeFieldEditable(briefCogLevel, "brief.nivel_cognitivo");
  makeFieldEditable(briefEvidence, "brief.evidencia_primaria");
  makeFieldEditable(secondSource, "brief.segunda_fuente");
  makeFieldEditable(hypothesisField, "brief.hipotesis");
  makeFieldEditable(metricField, "brief.senal_cuantitativa");

  // Make experiment fields inline-editable
  makeFieldEditable(expHypothesis, "experiment.hipotesis");
  makeFieldEditable(expVariable, "experiment.variable");
  makeFieldEditable(expMetric, "experiment.metrica_primaria");
  makeFieldEditable(expStop, "experiment.criterio_stop");
  makeFieldEditable(expSample, "experiment.tamano_muestra");
  makeFieldEditable(expDuration, "experiment.duracion");
  makeFieldEditable(expTracking, "experiment.tracking_eventos");

  // Progress: count confirmed fields (max 11)
  const trackFields = [
    b.behavior_statement, b.nivel_cognitivo, b.causa,
    b.evidencia_primaria, b.segunda_fuente, b.hipotesis, b.senal_cuantitativa,
  ];
  let cnt = trackFields.filter((f) => f?.confirmed).length;
  if (cycle?.sub_perfil) cnt++;
  if (cycle?.transicion) cnt++;
  if (cycle?.causa) cnt++;
  setBriefProgress(Math.min(cnt, 11));
}

function downloadBrief() {
  const cycle = getCurrentCycle();
  const b = cycle?.brief ?? {};
  const causeMap = { M: "Motivación", A: "Ability", P: "Prompt" };
  const title = cycle?.title ?? "[CONFIRMAR]";
  const behavior = b.behavior_statement?.value ?? "[CONFIRMAR]";
  const cause = b.causa?.value ?? (cycle?.causa ? `${cycle.causa} · ${causeMap[cycle.causa] ?? cycle.causa}` : "[CONFIRMAR]");
  const evidence = b.evidencia_primaria?.value ?? "[CONFIRMAR]";
  const source2 = b.segunda_fuente?.value ?? "[CONFIRMAR]";
  const hypothesis = b.hipotesis?.value ?? b.intervencion?.value ?? "[CONFIRMAR]";
  const metric = b.senal_cuantitativa?.value ?? "[CONFIRMAR]";
  const who = currentUser?.email ?? "usuario";
  const when = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

  const exp = cycle?.experiment ?? {};
  const expStr2 = (v) => v?.value ?? (typeof v === "string" ? v : null);
  const hasExperiment = Object.keys(exp).some((k) => expStr2(exp[k]));

  const lines = [
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
  ];

  if (hasExperiment) {
    lines.push(``, `## Experiment Card`);
    if (expStr2(exp.hipotesis)) lines.push(`**Hipótesis:** ${expStr2(exp.hipotesis)}`);
    if (expStr2(exp.variable)) lines.push(`**Variable:** ${expStr2(exp.variable)}`);
    if (expStr2(exp.metrica_primaria)) lines.push(`**Métrica primaria:** ${expStr2(exp.metrica_primaria)}`);
    if (expStr2(exp.criterio_stop)) lines.push(`**Criterio de stop:** ${expStr2(exp.criterio_stop)}`);
    if (expStr2(exp.tamano_muestra) || expStr2(exp.duracion))
      lines.push(`**Muestra:** ${expStr2(exp.tamano_muestra) || "—"} · **Duración:** ${expStr2(exp.duracion) || "—"}`);
    if (exp.tracking_eventos?.length)
      lines.push(`**Tracking:** ${Array.isArray(exp.tracking_eventos) ? exp.tracking_eventos.join(", ") : exp.tracking_eventos}`);
  }

  lines.push(
    ``,
    `## Riesgos asumidos`,
    isRiskAccepted()
      ? `- F1: Diagnóstico con 1 sola fuente. Riesgo aceptado por ${who} · ${when}.`
      : `- Sin riesgos aceptados.`,
    ``,
    `---`,
    `*Exportado por ${who} · ${when}*`,
  );

  const markdown = lines.join("\n");

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `intervention-brief-${(title).toLowerCase().replace(/\s+/g, "-").slice(0, 40)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// --- Toast ---
function showToast(message, isError = false) {
  const el = document.createElement("div");
  el.className = `toast${isError ? " is-error" : ""}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
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

// B=MAP cause selector
document.querySelector("#briefCauseSelector")?.addEventListener("click", async (e) => {
  const btn = e.target.closest(".bmap-btn");
  if (!btn || !currentCycleId) return;
  const cause = btn.dataset.cause;
  document.querySelectorAll(".bmap-btn").forEach((b) => b.classList.toggle("active", b === btn));
  const patch = { causa: cause, causa_source: "pm_confirmed", brief: { causa: { value: cause, confirmed: true } } };
  cycles = cycles.map((c) => c.id === currentCycleId ? deepMerge(c, patch) : c);
  await updateCycle(patch);
  renderActiveCycle();
});

// F1→F2 advance button
document.querySelector("#advancePhaseBtn")?.addEventListener("click", () => {
  if (!getCurrentCycle()) return;
  acceptRiskAndAdvance();
});

phaseStepper?.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-phase]");
  if (!row || !currentCycleId) return;
  const key = row.dataset.phase;
  const phases = getPhases().map((p) => ({ ...p, state: p.key === key ? "active" : p.state === "active" ? "todo" : p.state }));
  const patch = { phases, activePhase: key, fase_actual: key };
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
  if (command === "brief") {
    if (!getCurrentCycle()) { showToast("Selecciona un ciclo primero para exportar el brief."); }
    else downloadBrief();
  }
  if (command === "experiment") {
    if (!getCurrentCycle()) { showToast("Selecciona un ciclo primero para ver la Experiment Card."); }
    else setDeliverable("experiment");
  }
  if (command === "advance") {
    if (!getCurrentCycle()) { showToast("Selecciona un ciclo primero para avanzar de fase."); }
    else acceptRiskAndAdvance();
  }
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

// Library filters (in-memory, no fetch)
document.querySelector(".filter-row")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  document.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.filter ?? "all";
  const filtered = f === "all" ? patterns
    : (f === "patron" || f === "anti_patron") ? patterns.filter((p) => p.tipo === f)
    : patterns.filter((p) => (p.causa ?? "").toUpperCase() === f.toUpperCase());
  renderPatternsList(filtered);
});

// Pattern library search (in-memory, debounced 200ms)
let _searchTimer = null;
document.querySelector("#patternSearch")?.addEventListener("input", (e) => {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) { renderPatternsList(patterns); return; }
    renderPatternsList(patterns.filter((p) =>
      (p.nombre ?? "").toLowerCase().includes(term) ||
      (p.aprendizaje ?? "").toLowerCase().includes(term) ||
      (p.sub_perfil ?? "").toLowerCase().includes(term) ||
      (p.causa ?? "").toLowerCase().includes(term) ||
      (p.transicion ?? "").toLowerCase().includes(term)
    ));
  }, 200);
});

// Close cycle button
document.getElementById("closeCycleButton")?.addEventListener("click", closeCycle);

paletteSearch?.addEventListener("input", () => {
  const term = paletteSearch.value.toLowerCase();
  commandPalette.querySelectorAll("[data-palette-command]").forEach((button) => {
    button.classList.toggle("is-hidden", !button.textContent.toLowerCase().includes(term));
  });
});

// --- Start ---
init();
