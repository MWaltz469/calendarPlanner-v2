(function (global) {
  "use strict";

  var STORAGE_PREFIX = "tripweek_platform";
  var esc = global.TripModules.escapeHtml;

  function renderJoinForm(tripCode) {
    return '<div class="card p-5 grid gap-4 max-w-[480px] mx-auto">' +
      '<h2 class="m-0 font-display font-extrabold text-[clamp(1.1rem,2vw,1.5rem)] text-center">Join Trip</h2>' +
      '<p class="m-0 text-[var(--ink-soft)] text-sm text-center">Enter the trip code and your name to get started.</p>' +
      '<label class="grid gap-1">' +
        '<span class="text-xs text-[var(--ink-soft)] uppercase font-bold tracking-wide">Trip code</span>' +
        '<input id="dashTripCode" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 font-bold uppercase focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" type="text" maxlength="18" placeholder="SQUAD2026" autocomplete="off" value="' + esc(tripCode) + '" />' +
      '</label>' +
      '<label class="grid gap-1">' +
        '<span class="text-xs text-[var(--ink-soft)] uppercase font-bold tracking-wide">Your name</span>' +
        '<input id="dashName" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" type="text" maxlength="64" placeholder="Alex Smith" autocomplete="name" />' +
      '</label>' +
      '<div class="flex items-center gap-2">' +
        '<button id="dashJoinBtn" class="inline-flex items-center justify-center min-h-11 px-5 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)] disabled:opacity-55 disabled:cursor-not-allowed" type="button">Join Trip</button>' +
        '<span id="dashJoinState" class="text-sm text-[var(--ink-soft)] font-semibold" aria-live="polite"></span>' +
      '</div>' +
    '</div>';
  }

  function renderDashboard(session, modules, participantCount) {
    var trip = session.trip;
    var header = '<header class="card p-5 grid gap-3">' +
      '<div class="flex items-start justify-between gap-3 flex-wrap">' +
        '<div>' +
          '<h1 class="m-0 font-display font-extrabold text-[clamp(1.2rem,2.5vw,1.6rem)]">' + esc(trip.name) + '</h1>' +
          '<p class="m-0 mt-1 text-sm text-[var(--ink-soft)]">Welcome back, <strong>' + esc(session.participantName) + '</strong></p>' +
        '</div>' +
        '<div class="flex items-center gap-2 shrink-0">' +
          '<span class="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent-text)]">' + esc(trip.share_code) + '</span>' +
          '<button id="copyCodeBtn" class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] cursor-pointer hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)] transition-colors duration-100" type="button" aria-label="Copy trip code" title="Copy trip code">\uD83D\uDCCB</button>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-4 text-sm text-[var(--ink-soft)] font-semibold">' +
        '<span>' + esc(participantCount) + ' participant' + (participantCount !== 1 ? 's' : '') + '</span>' +
        '<span>' + esc(trip.trip_year) + '</span>' +
      '</div>' +
    '</header>';

    var grid = '<section class="grid gap-3" aria-label="Trip modules">';
    for (var i = 0; i < modules.length; i++) {
      var mod = modules[i];
      grid += global.TripModules.renderModuleCard(mod, {
        submittedCount: mod.submitted_count || 0,
        totalCount: participantCount,
        hasSubmitted: false
      });
    }
    grid += '</section>';

    return header + grid;
  }

  function getSession(tripCode) {
    var key = STORAGE_PREFIX + ":session:" + tripCode;
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(tripCode, data) {
    var key = STORAGE_PREFIX + ":session:" + tripCode;
    global.localStorage.setItem(key, JSON.stringify(data));
  }

  global.TripDashboard = {
    mount: function (container, params) {
      var tripCode = (params.tripCode || "").toUpperCase();
      var backend = new global.PlannerBackend({
        apiBaseUrl: (global.CALENDAR_PLANNER_CONFIG || {}).apiBaseUrl || "/api"
      });
      var pollChannel = null;
      var mounted = true;

      var backBtn = global.document.getElementById("backToDashboard");
      if (backBtn) backBtn.hidden = true;

      var session = getSession(tripCode);

      if (session && session.tripId && session.participantId) {
        loadDashboard(session);
      } else {
        showJoinForm();
      }

      function showJoinForm() {
        container.innerHTML = renderJoinForm(tripCode);
        var codeInput = global.document.getElementById("dashTripCode");
        var nameInput = global.document.getElementById("dashName");
        var joinBtn = global.document.getElementById("dashJoinBtn");
        var stateEl = global.document.getElementById("dashJoinState");

        // Try loading name from old planner session
        tryRestoreName(tripCode, nameInput);

        joinBtn.addEventListener("click", function () {
          var code = (codeInput.value || "").trim().toUpperCase();
          var name = (nameInput.value || "").trim();
          if (!code || !name) {
            stateEl.textContent = "Both fields are required.";
            return;
          }

          joinBtn.disabled = true;
          stateEl.textContent = "Joining...";

          backend.joinTrip({ shareCode: code, name: name }).then(function (result) {
            if (!mounted) return;
            var sess = {
              tripId: result.trip.id,
              participantId: result.participant.id,
              participantName: result.participant.name,
              trip: result.trip,
              modules: result.modules || []
            };
            saveSession(code, sess);
            session = sess;
            // Update hash to match the code
            if (tripCode !== code) {
              global.TripRouter.navigate(code);
            } else {
              loadDashboard(sess);
            }
          }).catch(function (err) {
            if (!mounted) return;
            joinBtn.disabled = false;
            stateEl.textContent = err.message || "Join failed.";
          });
        });
      }

      function loadDashboard(sess) {
        container.innerHTML = '<div class="text-center py-12"><span class="text-[var(--ink-soft)] text-sm font-semibold">Loading dashboard...</span></div>';

        backend.fetchModules(sess.tripId).then(function (data) {
          if (!mounted) return;
          container.innerHTML = renderDashboard(sess, data.modules, data.participantCount);
          bindDashboardEvents(sess, data.modules);
          startPolling(sess);
        }).catch(function (err) {
          if (!mounted) return;
          container.innerHTML = '<div class="card p-5 text-center">' +
            '<p class="text-[var(--danger)] font-bold">' + esc(err.message || "Failed to load dashboard.") + '</p>' +
            '<button id="retryDashBtn" class="mt-3 inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)]" type="button">Retry</button>' +
          '</div>';
          var retryBtn = global.document.getElementById("retryDashBtn");
          if (retryBtn) retryBtn.addEventListener("click", function () { loadDashboard(sess); });
        });
      }

      function bindDashboardEvents(sess, modules) {
        var copyBtn = global.document.getElementById("copyCodeBtn");
        if (copyBtn) {
          copyBtn.addEventListener("click", function () {
            global.navigator.clipboard.writeText(sess.trip.share_code).then(function () {
              global.TripModules.showToast("Trip code copied!", "good");
            }).catch(function () {
              global.TripModules.showToast("Could not copy.", "warn");
            });
          });
        }

        var cards = container.querySelectorAll("[data-module-type]");
        for (var i = 0; i < cards.length; i++) {
          cards[i].addEventListener("click", function () {
            var type = this.getAttribute("data-module-type");
            global.TripRouter.navigate(tripCode + "/" + type);
          });
          cards[i].addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this.click();
            }
          });
        }
      }

      function startPolling(sess) {
        if (pollChannel) return;
        pollChannel = backend.subscribeToModules(sess.tripId, function () {
          return backend.fetchModules(sess.tripId).then(function (data) {
            if (!mounted) return;
            container.innerHTML = renderDashboard(sess, data.modules, data.participantCount);
            bindDashboardEvents(sess, data.modules);
          });
        });
      }

      function tryRestoreName(code, nameInput) {
        var APP_CONFIG = global.CALENDAR_PLANNER_CONFIG || {};
        var year = APP_CONFIG.appYear || new Date().getFullYear();
        var prefix = "calendar_planner_wizard_v1:session:" + year + ":" + code;
        try {
          var keys = Object.keys(global.localStorage);
          for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf(prefix) === 0) {
              var parts = keys[i].split(":");
              var name = parts[parts.length - 1];
              if (name && nameInput) {
                nameInput.value = name;
                break;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      return function unmount() {
        mounted = false;
        if (pollChannel) {
          backend.removeSubscription(pollChannel);
          pollChannel = null;
        }
      };
    }
  };
})(window);
