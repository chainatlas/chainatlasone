import { LESSONS } from "./learn-data.js";
import { LESSON_CONTENT } from "./lesson-content.js";
import { initThemeToggle } from "./theme.js";
import { startIllustrationLoop } from "./illustrations.js";
requestAnimationFrame(() => {
  document.body.classList.add("css-ready");
});

const LS_KEY = "cao_learn_progress_v1";

const levelEl = document.getElementById("lessonLevel");
const titleEl = document.getElementById("lessonTitle");
const introEl = document.getElementById("lessonIntro");
const bulletsEl = document.getElementById("lessonBullets");
const exampleEl = document.getElementById("lessonExample");
const toggleBtn = document.getElementById("toggleDoneBtn");
const dashLink = document.getElementById("dashLink");
const pillEl = document.getElementById("lessonPill");

const lessonCanvas = document.getElementById("lessonCanvas");

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

function getLessonId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id");
}

function setDoneUI(isDone) {
  toggleBtn.textContent = isDone ? "Mark as not done" : "Mark as done";
  pillEl.textContent = isDone ? "Completed" : "Not completed";
  pillEl.classList.toggle("pos", isDone);
  pillEl.classList.toggle("neg", !isDone);
}

const id = getLessonId();
const lesson = LESSONS.find((l) => l.id === id);

let illustrationKind = "mempool";

if (!lesson) {
  titleEl.textContent = "Lesson not found";
  introEl.textContent = "Return to the Learn overview and select a lesson.";
  toggleBtn.disabled = true;
  dashLink.href = "/learn/";
  setDoneUI(false);
} else {
  illustrationKind = lesson.illustration || "mempool";

  const content = LESSON_CONTENT[id];
  levelEl.textContent = lesson.level;
  titleEl.textContent = lesson.title;
  introEl.textContent = content?.intro || lesson.description;

  bulletsEl.innerHTML = "";
  for (const b of content?.bullets || []) {
    const li = document.createElement("li");
    li.textContent = b;
    bulletsEl.appendChild(li);
  }

  exampleEl.textContent = content?.example || "";
  dashLink.href = lesson.dashboardLink || "/";

  const state = loadProgress();
  const isDone = !!state.done?.[id];
  setDoneUI(isDone);

  toggleBtn.addEventListener("click", () => {
    const s = loadProgress();
    s.done = s.done || {};
    s.done[id] = !s.done[id];
    saveProgress(s);
    setDoneUI(!!s.done[id]);
  });
}

// Big canvas illustration loop (single canvas)
startIllustrationLoop(() => [{ canvas: lessonCanvas, kind: illustrationKind }]);
