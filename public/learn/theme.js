export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

export function initThemeToggle(buttonEl) {
  const saved = localStorage.getItem("theme");
  applyTheme(saved || "dark"); // ✅ dark default

  buttonEl?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}
