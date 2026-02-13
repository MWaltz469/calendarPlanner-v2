(function () {
  var THEME_KEY = "calendar_planner_wizard_v1:theme";
  var saved = "system";
  try { saved = localStorage.getItem(THEME_KEY) || "system"; } catch (e) {}
  var resolved = saved;
  if (saved === "system" || (saved !== "light" && saved !== "dark")) {
    resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", resolved);
  document.addEventListener("DOMContentLoaded", function () {
    var sel = document.getElementById("themeSelect");
    if (!sel) return;
    sel.value = saved === "light" || saved === "dark" ? saved : "system";
    sel.addEventListener("change", function () {
      var pref = sel.value;
      var res = pref;
      if (pref === "system") {
        res = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", res);
      try { localStorage.setItem(THEME_KEY, pref); } catch (e) {}
    });
  });
})();
