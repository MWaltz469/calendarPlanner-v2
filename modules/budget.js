(function (global) {
  "use strict";

  var esc = global.TripModules.escapeHtml;
  var fmt = global.TripModules.formatCurrency;
  var STORAGE_PREFIX = "tripweek_platform";
  var INCLUSION_OPTIONS = ["Flights", "Accommodation", "Food & Drink", "Activities", "Transport", "Other"];

  function getSession(tripCode) {
    try {
      var raw = global.localStorage.getItem(STORAGE_PREFIX + ":session:" + tripCode);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /* ========= Input View ========= */

  function renderInputForm(existing) {
    var data = existing || {};
    var comfMin = data.comfortableMin || 500;
    var comfMax = data.comfortableMax || 3000;
    var ceiling = data.absoluteCeiling || 5000;
    var includes = data.includes || [];
    var notes = data.notes || "";

    var inclusionPills = "";
    for (var i = 0; i < INCLUSION_OPTIONS.length; i++) {
      var label = INCLUSION_OPTIONS[i];
      var key = label.toLowerCase().replace(/[^a-z]/g, "");
      var selected = includes.indexOf(key) !== -1;
      inclusionPills += global.TripModules.renderOptionPill(label, selected, 'data-inclusion="' + esc(key) + '"');
    }

    return '<div class="card p-5 grid gap-5">' +
      '<div class="flex items-center gap-3">' +
        '<a id="budgetBack" href="#" class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] cursor-pointer hover:bg-[var(--accent-bg)] no-underline">&larr;</a>' +
        '<h2 class="m-0 font-display font-extrabold text-[clamp(1.1rem,2vw,1.5rem)]">\uD83D\uDCB0 Budget</h2>' +
      '</div>' +
      '<p class="m-0 text-[var(--ink-soft)] text-sm">Share your comfortable budget range so the group can find a sweet spot.</p>' +

      '<div class="grid gap-4">' +
        global.TripModules.renderSectionLabel("Comfortable Range (per person)") +
        '<div class="grid gap-3">' +
          '<div class="grid grid-cols-2 gap-3">' +
            '<label class="grid gap-1">' +
              '<span class="text-xs text-[var(--ink-soft)] font-bold">Minimum</span>' +
              '<div class="flex items-center gap-2">' +
                '<span class="text-sm font-bold text-[var(--ink-soft)]">$</span>' +
                '<input id="budgetMin" type="number" min="0" max="50000" step="100" value="' + comfMin + '" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 font-bold focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" />' +
              '</div>' +
            '</label>' +
            '<label class="grid gap-1">' +
              '<span class="text-xs text-[var(--ink-soft)] font-bold">Maximum</span>' +
              '<div class="flex items-center gap-2">' +
                '<span class="text-sm font-bold text-[var(--ink-soft)]">$</span>' +
                '<input id="budgetMax" type="number" min="0" max="50000" step="100" value="' + comfMax + '" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 font-bold focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" />' +
              '</div>' +
            '</label>' +
          '</div>' +
          '<div class="grid gap-1">' +
            '<input id="budgetMinSlider" type="range" min="0" max="10000" step="100" value="' + comfMin + '" class="range-input" />' +
            '<input id="budgetMaxSlider" type="range" min="0" max="10000" step="100" value="' + comfMax + '" class="range-input" />' +
            '<div class="flex justify-between text-2xs font-bold text-[var(--ink-soft)]"><span>$0</span><span>$10,000</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="grid gap-2">' +
        global.TripModules.renderSectionLabel("Absolute Ceiling") +
        '<p class="m-0 text-sm text-[var(--ink-soft)]">The most you could stretch to, even if it\'s not ideal.</p>' +
        '<div class="flex items-center gap-2 max-w-[200px]">' +
          '<span class="text-sm font-bold text-[var(--ink-soft)]">$</span>' +
          '<input id="budgetCeiling" type="number" min="0" max="50000" step="100" value="' + ceiling + '" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 font-bold focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" />' +
        '</div>' +
      '</div>' +

      '<div class="grid gap-2">' +
        global.TripModules.renderSectionLabel("What\'s Included?") +
        '<p class="m-0 text-sm text-[var(--ink-soft)]">Select what your budget covers.</p>' +
        '<div id="inclusionPills" class="flex flex-wrap gap-2">' + inclusionPills + '</div>' +
      '</div>' +

      '<div class="grid gap-2">' +
        global.TripModules.renderSectionLabel("Notes (optional)") +
        '<textarea id="budgetNotes" class="w-full min-h-[80px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 text-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2 resize-y" maxlength="280" placeholder="Flexible if we find a deal...">' + esc(notes) + '</textarea>' +
        '<span class="text-2xs text-[var(--ink-soft)]"><span id="budgetNotesCount">' + notes.length + '</span>/280</span>' +
      '</div>' +

      '<div class="flex items-center gap-3 flex-wrap">' +
        '<button id="budgetSubmitBtn" class="inline-flex items-center justify-center min-h-11 px-5 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)] disabled:opacity-55 disabled:cursor-not-allowed" type="button">Save & View Results</button>' +
        '<span id="budgetSaveState" class="text-sm text-[var(--ink-soft)] font-semibold" aria-live="polite"></span>' +
      '</div>' +
    '</div>';
  }

  function bindInputEvents(container, tripCode, session, moduleId, backend) {
    var minInput = document.getElementById("budgetMin");
    var maxInput = document.getElementById("budgetMax");
    var minSlider = document.getElementById("budgetMinSlider");
    var maxSlider = document.getElementById("budgetMaxSlider");
    var ceilingInput = document.getElementById("budgetCeiling");
    var notesArea = document.getElementById("budgetNotes");
    var notesCount = document.getElementById("budgetNotesCount");
    var submitBtn = document.getElementById("budgetSubmitBtn");
    var saveState = document.getElementById("budgetSaveState");
    var backBtn = document.getElementById("budgetBack");

    if (backBtn) backBtn.href = "#/" + tripCode;

    // Sync sliders ↔ inputs
    function syncMinSlider() { minInput.value = minSlider.value; }
    function syncMaxSlider() { maxInput.value = maxSlider.value; }
    function syncMinInput() { minSlider.value = clamp(parseInt(minInput.value) || 0, 0, 10000); }
    function syncMaxInput() { maxSlider.value = clamp(parseInt(maxInput.value) || 0, 0, 10000); }

    minSlider.addEventListener("input", syncMinSlider);
    maxSlider.addEventListener("input", syncMaxSlider);
    minInput.addEventListener("input", syncMinInput);
    maxInput.addEventListener("input", syncMaxInput);

    // Inclusion pill toggles
    var pillsContainer = document.getElementById("inclusionPills");
    if (pillsContainer) {
      pillsContainer.addEventListener("click", function (e) {
        var pill = e.target.closest(".option-pill");
        if (!pill) return;
        var pressed = pill.getAttribute("aria-pressed") === "true";
        pill.setAttribute("aria-pressed", pressed ? "false" : "true");
      });
    }

    // Notes counter
    if (notesArea && notesCount) {
      notesArea.addEventListener("input", function () {
        notesCount.textContent = notesArea.value.length;
      });
    }

    // Submit
    submitBtn.addEventListener("click", function () {
      var comfMin = parseInt(minInput.value) || 0;
      var comfMax = parseInt(maxInput.value) || 0;
      var ceiling = parseInt(ceilingInput.value) || 0;

      if (comfMin > comfMax) {
        saveState.textContent = "Minimum must be less than maximum.";
        return;
      }
      if (comfMax > ceiling) {
        saveState.textContent = "Maximum can't exceed your ceiling.";
        return;
      }

      var selectedInclusions = [];
      var pills = pillsContainer.querySelectorAll('.option-pill[aria-pressed="true"]');
      for (var i = 0; i < pills.length; i++) {
        selectedInclusions.push(pills[i].getAttribute("data-inclusion"));
      }

      var payload = {
        comfortableMin: comfMin,
        comfortableMax: comfMax,
        absoluteCeiling: ceiling,
        includes: selectedInclusions,
        notes: (notesArea.value || "").trim().slice(0, 280)
      };

      submitBtn.disabled = true;
      saveState.textContent = "Saving...";

      backend.submitModule(moduleId, session.participantId, payload).then(function () {
        saveState.textContent = "Saved!";
        global.TripModules.showToast("Budget saved.", "good");
        setTimeout(function () {
          global.TripRouter.navigate(tripCode + "/budget/results");
        }, 500);
      }).catch(function (err) {
        submitBtn.disabled = false;
        saveState.textContent = err.message || "Save failed.";
        global.TripModules.showToast("Could not save budget.", "warn");
      });
    });
  }

  /* ========= Results View ========= */

  function computeSweetSpot(submissions) {
    if (!submissions.length) return null;

    var ranges = submissions.map(function (s) {
      var p = s.payload || {};
      return { min: p.comfortableMin || 0, max: p.comfortableMax || 0, ceiling: p.absoluteCeiling || 0, name: s.participant_name };
    });

    // Find the overlap region where the most people are comfortable
    var overlapMin = Math.max.apply(null, ranges.map(function (r) { return r.min; }));
    var overlapMax = Math.min.apply(null, ranges.map(function (r) { return r.max; }));

    var comfortableCount = 0;
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i].min <= overlapMax && ranges[i].max >= overlapMin) {
        comfortableCount++;
      }
    }

    if (overlapMin > overlapMax) {
      // No perfect overlap — find the range that covers the most people
      var bestMin = 0, bestMax = 0, bestCount = 0;
      for (var j = 0; j < ranges.length; j++) {
        for (var k = 0; k < ranges.length; k++) {
          var tryMin = ranges[j].min;
          var tryMax = ranges[k].max;
          if (tryMin > tryMax) continue;
          var cnt = 0;
          for (var m = 0; m < ranges.length; m++) {
            if (ranges[m].min <= tryMax && ranges[m].max >= tryMin) cnt++;
          }
          if (cnt > bestCount || (cnt === bestCount && (tryMax - tryMin) < (bestMax - bestMin))) {
            bestCount = cnt;
            bestMin = tryMin;
            bestMax = tryMax;
          }
        }
      }
      return { min: bestMin, max: bestMax, comfortable: bestCount, total: ranges.length };
    }

    return { min: overlapMin, max: overlapMax, comfortable: comfortableCount, total: ranges.length };
  }

  function renderResults(submissions, participantCount) {
    if (!submissions.length) {
      return global.TripModules.renderEmptyState("No budget submissions yet. Be the first!");
    }

    var sweetSpot = computeSweetSpot(submissions);
    var html = '<div class="grid gap-4">';

    // Sweet spot card
    if (sweetSpot) {
      var confidence = sweetSpot.comfortable + "/" + sweetSpot.total + " comfortable";
      html += '<div class="card p-5 border-2 border-[var(--module-open)] grid gap-2">' +
        '<span class="section-label">Sweet Spot</span>' +
        '<div class="font-display font-extrabold text-[clamp(1.4rem,3vw,2rem)] text-[var(--accent)]">' +
          fmt(sweetSpot.min) + ' &ndash; ' + fmt(sweetSpot.max) +
        '</div>' +
        '<span class="text-sm font-semibold text-[var(--ink-soft)]">per person &middot; ' + esc(confidence) + '</span>' +
      '</div>';
    }

    // Range chart
    html += '<div class="card p-4 grid gap-3">' +
      '<span class="section-label">Everyone\'s Range</span>';

    var maxCeiling = 0;
    for (var i = 0; i < submissions.length; i++) {
      var p = submissions[i].payload || {};
      if ((p.absoluteCeiling || 0) > maxCeiling) maxCeiling = p.absoluteCeiling;
    }
    if (maxCeiling < 100) maxCeiling = 10000;

    for (var j = 0; j < submissions.length; j++) {
      var sub = submissions[j];
      var payload = sub.payload || {};
      var pMin = payload.comfortableMin || 0;
      var pMax = payload.comfortableMax || 0;
      var pCeil = payload.absoluteCeiling || 0;
      var color = global.TripModules.getVisColor(j);

      var leftPct = ((pMin / maxCeiling) * 100).toFixed(1);
      var widthPct = (((pMax - pMin) / maxCeiling) * 100).toFixed(1);
      var ceilPct = ((pCeil / maxCeiling) * 100).toFixed(1);

      html += '<div class="grid gap-1">' +
        '<div class="flex items-center justify-between">' +
          '<span class="text-sm font-bold">' + esc(sub.participant_name) + '</span>' +
          '<span class="text-2xs text-[var(--ink-soft)]">' + fmt(pMin) + ' - ' + fmt(pMax) + ' (ceiling ' + fmt(pCeil) + ')</span>' +
        '</div>' +
        '<div class="relative h-5 bg-[var(--surface-muted)] rounded-full overflow-hidden">' +
          '<div class="absolute top-0 h-full rounded-full opacity-80" style="left:' + leftPct + '%;width:' + widthPct + '%;background:' + color + '"></div>' +
          '<div class="absolute top-0 h-full w-0.5 opacity-50" style="left:' + ceilPct + '%;background:var(--danger);" title="Ceiling: ' + fmt(pCeil) + '"></div>' +
        '</div>' +
      '</div>';
    }

    html += '<div class="flex justify-between text-2xs font-bold text-[var(--ink-soft)] mt-1"><span>$0</span><span>' + fmt(maxCeiling) + '</span></div>';

    // Legend
    html += '<div class="flex flex-wrap gap-3 text-2xs font-bold text-[var(--ink-soft)] mt-2">' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-[var(--accent)]"></span> Comfortable range</span>' +
      '<span class="inline-flex items-center gap-1"><span class="w-3 h-0.5 bg-[var(--danger)]"></span> Ceiling</span>' +
    '</div>';
    html += '</div>';

    // Inclusion consensus
    var inclusionCounts = {};
    for (var k = 0; k < submissions.length; k++) {
      var inc = (submissions[k].payload || {}).includes || [];
      for (var m = 0; m < inc.length; m++) {
        inclusionCounts[inc[m]] = (inclusionCounts[inc[m]] || 0) + 1;
      }
    }

    var inclusionKeys = Object.keys(inclusionCounts).sort(function (a, b) { return inclusionCounts[b] - inclusionCounts[a]; });
    if (inclusionKeys.length) {
      html += '<div class="card p-4 grid gap-3">' +
        '<span class="section-label">What Should Be Included?</span>';
      for (var n = 0; n < inclusionKeys.length; n++) {
        var iKey = inclusionKeys[n];
        var iCount = inclusionCounts[iKey];
        var iPct = ((iCount / submissions.length) * 100).toFixed(0);
        var iLabel = INCLUSION_OPTIONS.find(function (o) { return o.toLowerCase().replace(/[^a-z]/g, "") === iKey; }) || iKey;

        html += '<div class="grid gap-1">' +
          '<div class="flex items-center justify-between">' +
            '<span class="text-sm font-semibold">' + esc(iLabel) + '</span>' +
            '<span class="text-2xs text-[var(--ink-soft)]">' + iCount + '/' + submissions.length + ' (' + iPct + '%)</span>' +
          '</div>' +
          global.TripModules.renderConsensusBar([
            { count: iCount, color: "var(--accent)", label: "Yes" },
            { count: submissions.length - iCount, color: "var(--surface-sunken)", label: "No" }
          ]) +
        '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ========= Mount functions ========= */

  global.TripBudget = {
    mount: function (container, params) {
      var tripCode = (params.tripCode || "").toUpperCase();
      var session = getSession(tripCode);

      if (!session || !session.participantId) {
        container.innerHTML = '<div class="card p-5 text-center">' +
          '<p class="text-[var(--ink-soft)] font-bold">You need to join this trip first.</p>' +
          '<a href="#/' + esc(tripCode) + '" class="mt-3 inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full bg-[var(--accent)] text-white font-bold no-underline">&larr; Go to Dashboard</a>' +
        '</div>';
        return;
      }

      var backend = new global.PlannerBackend({
        apiBaseUrl: (global.CALENDAR_PLANNER_CONFIG || {}).apiBaseUrl || "/api"
      });

      var backBtn = document.getElementById("backToDashboard");
      if (backBtn) {
        backBtn.hidden = false;
        backBtn.href = "#/" + tripCode;
      }

      // Find the budget module ID
      container.innerHTML = '<div class="text-center py-12"><span class="text-[var(--ink-soft)] text-sm font-semibold">Loading budget module...</span></div>';

      backend.fetchModules(session.tripId).then(function (data) {
        var budgetMod = null;
        for (var i = 0; i < data.modules.length; i++) {
          if (data.modules[i].type === "budget") {
            budgetMod = data.modules[i];
            break;
          }
        }

        if (!budgetMod) {
          container.innerHTML = global.TripModules.renderEmptyState("Budget module not available for this trip.");
          return;
        }

        // Check for existing submission
        return backend.fetchModule(budgetMod.id).then(function (modData) {
          var existing = null;
          var subs = modData.submissions || [];
          for (var j = 0; j < subs.length; j++) {
            if (subs[j].participant_id === session.participantId) {
              existing = subs[j].payload;
              break;
            }
          }

          container.innerHTML = renderInputForm(existing);
          bindInputEvents(container, tripCode, session, budgetMod.id, backend);
        });
      }).catch(function (err) {
        container.innerHTML = '<div class="card p-5 text-center"><p class="text-[var(--danger)] font-bold">' + esc(err.message || "Failed to load.") + '</p></div>';
      });

      return function unmount() {
        if (backBtn) backBtn.hidden = true;
      };
    },

    mountResults: function (container, params) {
      var tripCode = (params.tripCode || "").toUpperCase();
      var session = getSession(tripCode);

      if (!session || !session.participantId) {
        container.innerHTML = '<div class="card p-5 text-center">' +
          '<p class="text-[var(--ink-soft)] font-bold">You need to join this trip first.</p>' +
          '<a href="#/' + esc(tripCode) + '" class="mt-3 inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full bg-[var(--accent)] text-white font-bold no-underline">&larr; Go to Dashboard</a>' +
        '</div>';
        return;
      }

      var backend = new global.PlannerBackend({
        apiBaseUrl: (global.CALENDAR_PLANNER_CONFIG || {}).apiBaseUrl || "/api"
      });
      var pollChannel = null;

      var backBtn = document.getElementById("backToDashboard");
      if (backBtn) {
        backBtn.hidden = false;
        backBtn.href = "#/" + tripCode;
      }

      container.innerHTML = '<div class="text-center py-12"><span class="text-[var(--ink-soft)] text-sm font-semibold">Loading results...</span></div>';

      function loadResults() {
        return backend.fetchModules(session.tripId).then(function (data) {
          var budgetMod = null;
          for (var i = 0; i < data.modules.length; i++) {
            if (data.modules[i].type === "budget") { budgetMod = data.modules[i]; break; }
          }
          if (!budgetMod) {
            container.innerHTML = global.TripModules.renderEmptyState("Budget module not found.");
            return;
          }
          return backend.fetchModule(budgetMod.id).then(function (modData) {
            container.innerHTML = '<div class="grid gap-4">' +
              '<div class="flex items-center gap-3">' +
                '<a href="#/' + esc(tripCode) + '" class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] cursor-pointer hover:bg-[var(--accent-bg)] no-underline">&larr;</a>' +
                '<h2 class="m-0 font-display font-extrabold text-[clamp(1.1rem,2vw,1.5rem)]">\uD83D\uDCB0 Budget Results</h2>' +
                '<a href="#/' + esc(tripCode) + '/budget" class="ml-auto inline-flex items-center min-h-9 px-3 py-1 text-sm rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] font-bold no-underline">Edit My Budget</a>' +
              '</div>' +
              renderResults(modData.submissions || [], data.participantCount) +
            '</div>';
          });
        });
      }

      loadResults().catch(function (err) {
        container.innerHTML = '<div class="card p-5 text-center"><p class="text-[var(--danger)] font-bold">' + esc(err.message || "Failed to load results.") + '</p></div>';
      });

      // Poll for updates
      pollChannel = backend.subscribeToModules(session.tripId, function () {
        return loadResults();
      });

      return function unmount() {
        if (pollChannel) {
          backend.removeSubscription(pollChannel);
          pollChannel = null;
        }
        if (backBtn) backBtn.hidden = true;
      };
    }
  };
})(window);
