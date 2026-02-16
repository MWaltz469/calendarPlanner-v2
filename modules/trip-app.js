(function (global) {
  "use strict";

  /* Trip App — wires the hash router to module views.
   * Loaded on trip.html only. */

  var appRoot = null;

  function ready(fn) {
    if (document.readyState !== "loading") {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  ready(function () {
    appRoot = document.getElementById("app-root");
    if (!appRoot) return;

    var Router = global.TripRouter;
    if (!Router) {
      console.error("TripRouter not loaded.");
      return;
    }

    /* Dashboard route: #/:tripCode */
    Router.onRoute(":tripCode", function (params) {
      return global.TripDashboard.mount(appRoot, params);
    });

    /* When module: #/:tripCode/when */
    Router.onRoute(":tripCode/when", function (params) {
      return global.TripWhen.mount(appRoot, params);
    });

    /* Budget module: #/:tripCode/budget */
    Router.onRoute(":tripCode/budget", function (params) {
      if (global.TripBudget) {
        return global.TripBudget.mount(appRoot, params);
      }
      appRoot.innerHTML = global.TripModules.renderEmptyState("Budget module coming soon.");
    });

    /* Budget results: #/:tripCode/budget/results */
    Router.onRoute(":tripCode/budget/results", function (params) {
      if (global.TripBudget) {
        return global.TripBudget.mountResults(appRoot, params);
      }
      appRoot.innerHTML = global.TripModules.renderEmptyState("Budget results coming soon.");
    });

    /* Fallback: no hash or empty → show landing prompt */
    Router.onRoute("", function () {
      appRoot.innerHTML = '<div class="card p-5 text-center max-w-[480px] mx-auto">' +
        '<h2 class="m-0 font-display font-extrabold text-[clamp(1.1rem,2vw,1.5rem)]">Welcome to TripWeek</h2>' +
        '<p class="mt-2 mb-0 text-[var(--ink-soft)] text-sm">Enter a trip code in the URL to get started.</p>' +
        '<p class="mt-2 mb-0 text-[var(--ink-soft)] text-sm">Example: <code class="bg-[var(--surface-muted)] px-1.5 py-0.5 rounded text-xs font-bold">trip.html#/SQUAD2026</code></p>' +
        '<a href="/" class="mt-4 inline-flex items-center justify-center min-h-11 px-5 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold no-underline hover:bg-[var(--accent-strong)]">&larr; Back to Home</a>' +
      '</div>';
    });

    /* Start the router */
    Router.start();
  });
})(window);
