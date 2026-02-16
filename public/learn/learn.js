import { LESSONS } from "./learn-data.js";


const LS_KEY = "cao_learn_progress_v1";

const grid = document.getElementById("lessonGrid");
const progressPctEl = document.getElementById("progressPct");
const completedCountEl = document.getElementById("completedCount");
const totalCountEl = document.getElementById("totalCount");
const learnStatus = document.getElementById("learnStatus");
const resetBtn = document.getElementById("resetProgressBtn");
const themeBtn = document.getElementById("themeBtn");

function setStatus(text) {
  if (learnStatus) learnStatus.textContent = text;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { done: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { done: {} };
  } catch {
    return { done: {} };
  }
}

function saveProgress(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/* ---------- Theme toggle (inline, no external dependency) ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore
  }
}

function initThemeToggleInline(btn) {
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}

/* ---------- Render ---------- */
function render() {
  if (!grid) {
    setStatus("Error: #lessonGrid not found");
    return;
  }

  if (!Array.isArray(LESSONS) || LESSONS.length === 0) {
    grid.innerHTML = "";
    if (totalCountEl) totalCountEl.textContent = "0";
    if (completedCountEl) completedCountEl.textContent = "0";
    if (progressPctEl) progressPctEl.textContent = "0";
    setStatus("Error: LESSONS not loaded");
    return;
  }

  const state = loadProgress();
  const done = state.done || {};

  grid.innerHTML = "";
  if (totalCountEl) totalCountEl.textContent = String(LESSONS.length);

  let completed = 0;

  for (const lesson of LESSONS) {
    const isDone = !!done[lesson.id];
    if (isDone) completed++;

    const card = document.createElement("article");
    card.className = "card lessonCard";

    const ill = lesson.illustration || "mempool";
    const canvasId = `ill-${lesson.id}`;

    card.innerHTML = `
      <div class="lessonTop">
        <div class="lessonTopLeft">
          <div class="lessonTag">${lesson.level}</div>
          <h3 class="lessonTitleSmall">${lesson.title}</h3>
        </div>

        <canvas class="lessonMiniCanvas" id="${canvasId}" data-ill="${ill}" aria-hidden="true"></canvas>
      </div>

      <p class="lessonDesc">${lesson.description}</p>

      <div class="lessonActions">
        <a class="btn" href="/learn/lesson.html?id=${encodeURIComponent(lesson.id)}">Open lesson</a>
        ${lesson.dashboardLink ? `<a class="btn btnGhost" href="${lesson.dashboardLink}">Go to Dashboard</a>` : ""}
        <button class="btn btnGhost" type="button" data-toggle="${lesson.id}">
          ${isDone ? "Mark as not done" : "Mark as done"}
        </button>

        <span class="pillSmall" title="Completion status">
          <span class="check" aria-hidden="true">${isDone ? "✓" : ""}</span>
          <span>${isDone ? "Completed" : "Not completed"}</span>
        </span>
      </div>
    `;

    grid.appendChild(card);
  }

  if (completedCountEl) completedCountEl.textContent = String(completed);

  const pct = LESSONS.length ? Math.round((completed / LESSONS.length) * 100) : 0;
  if (progressPctEl) progressPctEl.textContent = String(pct);

  setStatus(`Progress: ${pct}%`);
}

/* ---------- Events ---------- */
function bindEvents() {
  if (grid) {
    grid.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-toggle]");
      if (!btn) return;

      const id = btn.getAttribute("data-toggle");
      if (!id) return;

      const state = loadProgress();
      state.done = state.done || {};
      state.done[id] = !state.done[id];
      saveProgress(state);

      render();
      // try restart illustrations after re-render
      startIllustrationsBestEffort();
    });
  }

  resetBtn?.addEventListener("click", () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    render();
    startIllustrationsBestEffort();
    setStatus("Progress reset");
  });
}

/* ---------- Mini illustrations (optional) ---------- */
let illustrationsStarted = false;

async function startIllustrationsBestEffort() {
  if (illustrationsStarted) return;

  // Only start if canvases exist
  const canvases = Array.from(document.querySelectorAll("canvas[data-ill]"));
  if (!canvases.length) return;

  try {
    const mod = await import("./illustrations.js");
    if (typeof mod.startIllustrationLoop !== "function") return;

    illustrationsStarted = true;

    mod.startIllustrationLoop(() => {
      return Array.from(document.querySelectorAll("canvas[data-ill]")).map((c) => ({
        canvas: c,
        kind: c.getAttribute("data-ill") || "mempool",
      }));
    });
  } catch {
    // If illustrations.js is missing or fails, do nothing (Lessons still work)
  }
}

/* ---------- Boot ---------- */
(function boot() {
  try {
    initThemeToggleInline(themeBtn);
    bindEvents();
    render();
    startIllustrationsBestEffort();
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err?.message || err}`);
  }
})();
