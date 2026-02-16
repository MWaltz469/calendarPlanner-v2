(function (global) {
  "use strict";

  /* The When module wrapper for the trip dashboard.
   * Renders the existing planner HTML into a container and calls WhenModule.mount(). */

  var PLANNER_TEMPLATE = '<header class="card p-4">' +
    '<div class="flex items-center justify-between gap-2">' +
      '<h2 class="m-0 font-display font-extrabold text-[clamp(1.1rem,2vw,1.5rem)]">When &mdash; Week Availability</h2>' +
    '</div>' +
    '<p class="mt-2 mb-0 text-[var(--ink-soft)]">Pick which weeks work for you. The app finds the best overlap.</p>' +
  '</header>' +

  '<section class="card grid gap-4 p-3.5" aria-label="Availability wizard">' +
    '<ol id="stepper" class="list-none m-0 p-0 flex gap-2 overflow-x-auto scrollbar-none" aria-label="Setup progress">' +
      '<li class="m-0 p-0 flex-1 min-w-0"><button class="stepper-btn w-full border-none rounded-lg bg-[var(--surface-muted)] text-[var(--ink-soft)] text-xs font-bold leading-tight px-2 py-1.5 grid gap-0.5 text-center cursor-pointer whitespace-nowrap min-w-[3.5rem] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" data-step="1" type="button" aria-current="step"><span class="stepper-num w-6 h-6 mx-auto rounded-full inline-grid place-items-center bg-[var(--surface)] text-[var(--ink-soft)] font-extrabold text-xs">1</span><span>Join Trip</span></button></li>' +
      '<li class="m-0 p-0 flex-1 min-w-0"><button class="stepper-btn w-full border-none rounded-lg bg-[var(--surface-muted)] text-[var(--ink-soft)] text-xs font-bold leading-tight px-2 py-1.5 grid gap-0.5 text-center cursor-pointer whitespace-nowrap min-w-[3.5rem] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" data-step="2" type="button"><span class="stepper-num w-6 h-6 mx-auto rounded-full inline-grid place-items-center bg-[var(--surface)] text-[var(--ink-soft)] font-extrabold text-xs">2</span><span>Pick Weeks</span></button></li>' +
      '<li class="m-0 p-0 flex-1 min-w-0"><button class="stepper-btn w-full border-none rounded-lg bg-[var(--surface-muted)] text-[var(--ink-soft)] text-xs font-bold leading-tight px-2 py-1.5 grid gap-0.5 text-center cursor-pointer whitespace-nowrap min-w-[3.5rem] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" data-step="3" type="button"><span class="stepper-num w-6 h-6 mx-auto rounded-full inline-grid place-items-center bg-[var(--surface)] text-[var(--ink-soft)] font-extrabold text-xs">3</span><span>Rank Top 5</span></button></li>' +
      '<li class="m-0 p-0 flex-1 min-w-0"><button class="stepper-btn w-full border-none rounded-lg bg-[var(--surface-muted)] text-[var(--ink-soft)] text-xs font-bold leading-tight px-2 py-1.5 grid gap-0.5 text-center cursor-pointer whitespace-nowrap min-w-[3.5rem] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" data-step="4" type="button"><span class="stepper-num w-6 h-6 mx-auto rounded-full inline-grid place-items-center bg-[var(--surface)] text-[var(--ink-soft)] font-extrabold text-xs">4</span><span>Submit</span></button></li>' +
    '</ol>' +

    '<section id="step-1" class="step-panel" aria-labelledby="step1-heading">' +
      '<h2 id="step1-heading" class="m-0 font-display text-[clamp(1.05rem,2vw,1.35rem)]">Step 1: Join your trip</h2>' +
      '<p class="m-0 text-[var(--ink-soft)] text-base">Enter the trip code your organizer shared with you and your name.</p>' +
      '<details class="wtf-inline"><summary>New here? What is this?</summary><p>Your trip organizer created a code for your group. Enter it below with your name, then you\'ll pick which weeks work for you. The app figures out the best overlap for everyone. That\'s it.</p></details>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<label class="grid gap-1"><span class="text-xs text-[var(--ink-soft)] uppercase font-bold tracking-wide">Trip code</span><input id="tripCodeInput" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" type="text" maxlength="18" placeholder="SQUAD2026" autocomplete="off" style="text-transform:uppercase;" /></label>' +
        '<label class="grid gap-1"><span class="text-xs text-[var(--ink-soft)] uppercase font-bold tracking-wide">Your name</span><input id="nameInput" class="w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2" type="text" maxlength="64" placeholder="Alex Smith" autocomplete="name" /></label>' +
      '</div>' +
      '<div id="windowConfigDetails" hidden><select id="windowStartInput"><option value="sat" selected>Saturday</option></select><select id="windowDaysInput"><option value="7" selected>7</option></select><p id="windowConfigState"></p></div>' +
      '<div class="flex items-center gap-2">' +
        '<button id="joinButton" class="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)] disabled:opacity-55 disabled:cursor-not-allowed" type="button">Join Trip</button>' +
        '<span id="joinState" class="text-sm text-[var(--ink-soft)] font-semibold" aria-live="polite"></span>' +
      '</div>' +
    '</section>' +

    '<section id="step-2" class="step-panel" aria-labelledby="step2-heading" hidden>' +
      '<h2 id="step2-heading" class="m-0 font-display text-[clamp(1.05rem,2vw,1.35rem)]">Step 2: Pick your available weeks</h2>' +
      '<p class="m-0 text-[var(--ink-soft)] text-base"><span class="touch-copy">Tap</span><span class="pointer-copy">Click</span> a week card to cycle status: <strong>Unselected &rarr; Available &rarr; Maybe</strong>.</p>' +
      '<div id="step2CountRow" class="grid grid-cols-3 gap-2" aria-label="Selection counts">' +
        '<article class="rounded-xl bg-[var(--surface-muted)] p-3 grid gap-1"><span class="uppercase tracking-wide text-2xs text-[var(--ink-soft)] font-bold">Available</span><strong id="availableCount" class="font-display text-base">0</strong></article>' +
        '<article class="rounded-xl bg-[var(--surface-muted)] p-3 grid gap-1"><span class="uppercase tracking-wide text-2xs text-[var(--ink-soft)] font-bold">Maybe</span><strong id="maybeCount" class="font-display text-base">0</strong></article>' +
        '<article class="rounded-xl bg-[var(--surface-muted)] p-3 grid gap-1"><span class="uppercase tracking-wide text-2xs text-[var(--ink-soft)] font-bold">Ranked</span><strong id="rankedCount" class="font-display text-base">0 / 5</strong></article>' +
      '</div>' +
      '<div class="flex flex-wrap gap-2 text-[var(--ink-soft)] text-xs font-bold"><span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-full bg-[var(--neutral-text)]" aria-hidden="true"></i>Unselected</span><span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-full bg-[var(--available)]" aria-hidden="true"></i>Available</span><span class="inline-flex items-center gap-1.5"><i class="w-2.5 h-2.5 rounded-full bg-[var(--maybe)]" aria-hidden="true"></i>Maybe</span></div>' +
      '<p class="text-xs text-[var(--ink)] dark:text-[var(--ink-soft)] font-semibold italic touch-copy">Tip: Long-press a card to set status directly.</p>' +
      '<p class="text-xs text-[var(--ink)] dark:text-[var(--ink-soft)] font-semibold italic pointer-copy">Tip: Right-click a card to set status directly. Focus a card and press 1&ndash;5 to rank, Delete to clear rank.</p>' +
      '<aside id="selectionOverlay" class="selection-overlay" aria-live="polite" hidden><div class="flex items-center gap-2 justify-between"><span id="overlaySummary" class="text-sm font-bold text-[var(--ink)] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">0 selected</span><div class="flex gap-1.5 shrink-0"><button id="overlayPrevStep" class="ov-nav-btn" type="button"><span class="text-lg leading-none">&larr;</span><span class="text-xs leading-none">Back</span></button><button id="overlayScrollTop" class="ov-nav-btn" type="button"><span class="text-lg leading-none">&uarr;</span><span class="text-xs leading-none">Top</span></button><button id="overlayNextStep" class="ov-nav-btn ov-nav-primary" type="button"><span class="text-lg leading-none">&rarr;</span><span class="text-xs leading-none">Next</span></button></div></div><nav id="monthBar" class="month-bar" aria-label="Jump to month"></nav></aside>' +
      '<div id="weekGrid" class="week-grid" role="list" aria-label="52 weeks"></div>' +
    '</section>' +

    '<section id="step-3" class="step-panel" aria-labelledby="step3-heading" hidden>' +
      '<h2 id="step3-heading" class="m-0 font-display text-[clamp(1.05rem,2vw,1.35rem)]">Step 3: Rank your top 5 preferred weeks</h2>' +
      '<p class="m-0 text-[var(--ink-soft)] text-base">This step is <strong>optional</strong>. Ranking helps the organizer see your strongest preferences, but you can skip it if you have no preference.</p>' +
      '<details class="wtf-inline" id="rankingExplainer"><summary>How does ranking affect results?</summary><p>Weeks are sorted by availability first &mdash; more people free = higher rank. When two weeks have the same overlap, your top picks break the tie. A #1 pick adds more weight than a #5, so the group\'s strongest preferences float to the top.</p></details>' +
      '<div id="rankRows" class="rank-rows" aria-label="Rank assignments"></div>' +
      '<p id="rankNote" class="text-sm text-[var(--ink-soft)] font-semibold" aria-live="polite"></p>' +
      '<div class="flex items-center gap-2"><button id="skipToReviewBtn" class="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)]" type="button">Continue to Review &rarr;</button><span class="text-sm text-[var(--ink-soft)] font-semibold">You can always come back to rank later.</span></div>' +
    '</section>' +

    '<section id="step-4" class="step-panel" aria-labelledby="step4-heading" hidden>' +
      '<h2 id="step4-heading" class="m-0 font-display text-[clamp(1.05rem,2vw,1.35rem)]">Step 4: Review and submit</h2>' +
      '<p class="m-0 text-[var(--ink-soft)] text-base">You can submit now or go back to refine. Results unlock after your first submission.</p>' +
      '<details class="group border-none bg-[var(--surface-muted)] rounded-xl p-4" aria-label="Readiness checklist" id="checklistDetails" open><summary class="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><h3 class="m-0 text-base flex items-center gap-2"><span class="text-sm text-[var(--ink-soft)] transition-transform duration-150 group-open:rotate-90 inline-block leading-none">&#9656;</span>Readiness checklist</h3></summary><ul id="reviewList" class="list-none p-0 m-0 mt-3 grid gap-1"></ul></details>' +
      '<div class="flex items-center gap-2 flex-wrap">' +
        '<button id="submitButton" class="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)] disabled:opacity-55 disabled:cursor-not-allowed" type="button">Submit Availability</button>' +
        '<button id="exportButton" class="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] font-bold cursor-pointer dark:bg-[#1a2b3b] dark:border-[#34506a] dark:text-[#d7e6f2]" type="button">Export Summary</button>' +
        '<button id="clearButton" class="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-full border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] font-bold cursor-pointer sm:ml-auto" type="button">Clear My Selections</button>' +
      '</div>' +
      '<span id="saveState" class="text-sm text-[var(--ink-soft)] font-semibold" aria-live="polite">Not saved yet.</span>' +
      '<article id="resultsLocked" class="border border-dashed border-[var(--border)] rounded-xl bg-[var(--surface-muted)] text-[var(--ink-soft)] p-3 text-sm" aria-live="polite">Submit your availability to unlock group results.</article>' +
      '<section id="resultsSection" class="grid gap-3" hidden><div id="resultsSummary"></div>' +
        '<article class="border-none rounded-xl bg-[var(--surface)] shadow-sm p-4 grid gap-4"><h3 class="m-0 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-[var(--ink-soft)] pb-2 border-b border-[var(--border)]">Top Weeks <span class="font-body text-2xs font-semibold text-[var(--ink-soft)] normal-case tracking-normal ml-2">Ranked by overlap and preference</span></h3><div id="leaderboard" class="grid gap-2"></div></article>' +
        '<article class="border-none rounded-xl bg-[var(--surface)] shadow-sm p-4 grid gap-4 hidden lg:grid"><h3 class="m-0 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-[var(--ink-soft)] pb-2 border-b border-[var(--border)]">Snapshot</h3><div id="scoreChips" class="grid grid-cols-2 gap-2"></div></article>' +
        '<details class="group border-none rounded-xl bg-[var(--surface)] shadow-sm p-4 grid gap-4 cursor-default" id="heatmapSection"><summary class="cursor-pointer list-none flex items-center [&::-webkit-details-marker]:hidden"><h3 class="m-0 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-[var(--ink-soft)] flex items-center gap-2"><span class="text-sm text-[var(--ink-soft)] transition-transform duration-150 group-open:rotate-90 inline-block leading-none">&#9656;</span>Heatmap <span class="font-body text-2xs font-semibold text-[var(--ink-soft)] normal-case tracking-normal ml-2">Explore all weeks by month</span></h3></summary><div class="mt-3"><div class="flex flex-wrap gap-2 items-center mb-3"><span class="flex items-center gap-1 text-2xs font-bold text-[var(--ink-soft)]"><span class="w-3 h-3 rounded-sm border border-[var(--border)] shrink-0" style="background:var(--surface-muted)"></span> No overlap</span><span class="flex items-center gap-1 text-2xs font-bold text-[var(--ink-soft)]"><span class="w-3 h-3 rounded-sm border border-[var(--border)] shrink-0" style="background:#f59e0b"></span> Low</span><span class="flex items-center gap-1 text-2xs font-bold text-[var(--ink-soft)]"><span class="w-3 h-3 rounded-sm border border-[var(--border)] shrink-0" style="background:#ea580c"></span> Medium</span><span class="flex items-center gap-1 text-2xs font-bold text-[var(--ink-soft)]"><span class="w-3 h-3 rounded-sm border border-[var(--border)] shrink-0" style="background:#dc2626"></span> High</span><span class="flex items-center gap-1 text-2xs font-semibold text-[var(--ink-soft)] italic">Tap a cell to see who</span></div><div id="heatmap" class="grid gap-0.5 border border-[var(--border)] rounded-xl p-3 bg-[var(--surface)]" role="listbox" aria-label="Group overlap heatmap"></div></div></details>' +
        '<details class="group border-none rounded-xl bg-[var(--surface)] shadow-sm p-4 grid gap-4 cursor-default" id="participantSection"><summary class="cursor-pointer list-none flex items-center [&::-webkit-details-marker]:hidden"><h3 class="m-0 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-[var(--ink-soft)] flex items-center gap-2"><span class="text-sm text-[var(--ink-soft)] transition-transform duration-150 group-open:rotate-90 inline-block leading-none">&#9656;</span>Participants <span id="participantSummary" class="font-body text-2xs font-semibold text-[var(--ink-soft)] normal-case tracking-normal ml-2"></span></h3></summary><div class="mt-3"><ul id="participantList" class="list-none m-0 p-0 grid gap-2"></ul></div></details>' +
      '</section>' +
    '</section>' +
  '</section>' +
  '<div id="heatPopover" class="fixed z-30 border border-[var(--border)] rounded-xl bg-[var(--surface)] shadow-lg p-3 min-w-[180px] max-w-[280px] grid gap-2" hidden></div>' +
  '<div id="weekContextMenu" class="fixed z-[25] border border-[var(--border)] rounded-lg bg-[var(--surface)] shadow-[0_10px_24px_rgba(0,0,0,0.18)] p-1 grid gap-0.5 min-w-[140px]" hidden>' +
    '<button type="button" data-status="available" class="border-none rounded-lg bg-transparent text-[var(--available)] text-sm font-bold p-3 px-4 min-h-11 text-left cursor-pointer hover:bg-[var(--accent-bg)]">Available</button>' +
    '<button type="button" data-status="maybe" class="border-none rounded-lg bg-transparent text-[var(--maybe)] text-sm font-bold p-3 px-4 min-h-11 text-left cursor-pointer hover:bg-[var(--accent-bg)]">Maybe</button>' +
    '<button type="button" data-status="unselected" class="border-none rounded-lg bg-transparent text-[var(--ink-soft)] text-sm font-bold p-3 px-4 min-h-11 text-left cursor-pointer hover:bg-[var(--accent-bg)]">Unselected</button>' +
  '</div>';

  global.TripWhen = {
    mount: function (container, config) {
      container.innerHTML = PLANNER_TEMPLATE;

      var backBtn = document.getElementById("backToDashboard");
      if (backBtn) {
        backBtn.hidden = false;
        backBtn.href = "#/" + (config.tripCode || "");
      }

      if (config && config.tripCode) {
        var codeInput = document.getElementById("tripCodeInput");
        if (codeInput) codeInput.value = config.tripCode;
      }

      global.WhenModule.mount(container, config);

      return function unmount() {
        global.WhenModule.unmount();
        if (backBtn) backBtn.hidden = true;
      };
    }
  };
})(window);
