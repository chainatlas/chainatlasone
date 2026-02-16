import { LESSONS } from "./learn-data.js";
import { initThemeToggle } from "./theme.js";
import { startIllustrationLoop } from "./illustrations.js";

const LS_KEY = "cao_learn_progress_v1";

const grid = document.getElementById("lessonGrid");
const progressPctEl = document.getElementById("progressPct");
const completedCountEl = document.getElementById("completedCount");
const totalCountEl = document.getElementById("totalCount");
const learnStatus = document.getElementById("learnStatus");
const resetBtn = document.getElementById("resetProgressBtn");

initThemeToggle(document.getElementById("themeBtn"));

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
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function setStatus(text) {
  if (learnStatus) learnStatus.textContent = text;
}

function render() {
  const state = loadProgress();
  const done = state.done || {};

  grid.innerHTML = "";
  totalCountEl.textContent = String(LESSONS.length);

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

  completedCountEl.textContent = String(completed);
  const pct = LESSONS.length ? Math.round((completed / LESSONS.length) * 100) : 0;
  progressPctEl.textContent = String(pct);

  setStatus(`Progress: ${pct}%`);
}

grid.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-toggle]");
  if (!btn) return;

  const id = btn.getAttribute("data-toggle");
  const state = loadProgress();
  state.done = state.done || {};
  state.done[id] = !state.done[id];
  saveProgress(state);

  render();
});

resetBtn?.addEventListener("click", () => {
  localStorage.removeItem(LS_KEY);
  render();
  setStatus("Progress reset");
});

render();

// Start canvas mini-illustrations loop
startIllustrationLoop(() => {
  return Array.from(document.querySelectorAll("canvas[data-ill]")).map((c) => ({
    canvas: c,
    kind: c.getAttribute("data-ill") || "mempool",
  }));
});
