(function () {
  "use strict";

  var STORAGE_KEY = "examples-theme";
  var TOGGLE_ID = "examples-theme-toggle";

  function readStoredTheme() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" ? stored : null;
    } catch (err) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* localStorage unavailable; theme still applies for the current page. */
    }
  }

  function systemTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  }

  if (document.getElementById(TOGGLE_ID)) {
    return;
  }

  var currentTheme = applyTheme(readStoredTheme() || systemTheme());
  var mediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function renderToggle() {
    var btn = document.getElementById(TOGGLE_ID);
    if (!btn) return;
    btn.textContent = currentTheme === "dark" ? "淺色" : "深色";
    btn.title = currentTheme === "dark" ? "目前深色主題，點擊切換為淺色主題" : "目前淺色主題，點擊切換為深色主題";
    btn.setAttribute("aria-label", currentTheme === "dark" ? "切換到淺色主題" : "切換到深色主題");
  }

  function createToggle() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = TOGGLE_ID;
    btn.className = "theme-toggle";
    btn.addEventListener("click", function () {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      writeStoredTheme(currentTheme);
      renderToggle();
    });
    (document.body || document.documentElement).appendChild(btn);
    renderToggle();
  }

  function syncWithSystem(e) {
    if (readStoredTheme()) return;
    currentTheme = e && e.matches ? "dark" : "light";
    applyTheme(currentTheme);
    renderToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggle);
  } else {
    createToggle();
  }

  if (mediaQuery) {
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncWithSystem);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(syncWithSystem);
    }
  }
})();
