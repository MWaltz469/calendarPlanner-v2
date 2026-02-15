(function () {
  var THEME_KEY = "calendar_planner_wizard_v1:theme";
  var CYCLE = ["system", "light", "dark"];
  var ICONS = { system: "\u25D1", light: "\u2600", dark: "\u263E" };
  var LABELS = { system: "Auto", light: "Light", dark: "Dark" };

  var saved = "system";
  try { saved = localStorage.getItem(THEME_KEY) || "system"; } catch (e) {}
  if (CYCLE.indexOf(saved) === -1) saved = "system";

  function resolve(pref) {
    if (pref === "light" || pref === "dark") return pref;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.documentElement.setAttribute("data-theme", resolve(saved));

  document.addEventListener("DOMContentLoaded", function () {
    // Support both old <select> and new <button> patterns
    var sel = document.getElementById("themeSelect");
    var btn = document.getElementById("themeToggle");

    if (sel) {
      sel.value = saved;
      sel.addEventListener("change", function () {
        saved = sel.value;
        document.documentElement.setAttribute("data-theme", resolve(saved));
        try { localStorage.setItem(THEME_KEY, saved); } catch (e) {}
        if (btn) updateBtn();
      });
    }

    if (btn) {
      updateBtn();
      btn.addEventListener("click", function () {
        var idx = (CYCLE.indexOf(saved) + 1) % CYCLE.length;
        saved = CYCLE[idx];
        document.documentElement.setAttribute("data-theme", resolve(saved));
        try { localStorage.setItem(THEME_KEY, saved); } catch (e) {}
        updateBtn();
        if (sel) sel.value = saved;
      });
    }

    function updateBtn() {
      if (!btn) return;
      btn.textContent = ICONS[saved] || ICONS.system;
      btn.setAttribute("aria-label", "Theme: " + (LABELS[saved] || "Auto"));
      btn.title = LABELS[saved] || "Auto";
    }
  });
})();
