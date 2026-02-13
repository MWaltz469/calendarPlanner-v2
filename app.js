(function () {
  "use strict";

  /**
   * @typedef {Object} Selection
   * @property {number} weekNumber
   * @property {'available'|'maybe'|'unselected'} status
   * @property {number|null} rank
   */

  /**
   * @typedef {Object} Participant
   * @property {string} id
   * @property {string} name
   * @property {string|null} submitted_at
   * @property {number} last_active_step
   */

  /**
   * @typedef {Object} WizardState
   * @property {number} currentStep
   * @property {boolean} isJoined
   * @property {boolean} hasSavedOnce
   * @property {{hasAvailable:boolean, rankedCount:number, missingRanks:number[]}} validation
   */

  /**
   * @typedef {Object} WeekAggregate
   * @property {number} weekNumber
   * @property {number} availableCount
   * @property {number} maybeCount
   * @property {number} unselectedCount
   * @property {number} score
   * @property {number|null} avgRank
   * @property {Array<{name:string,status:string,rank:number|null}>} people
   */

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      showToast("Could not save to local storage. Storage may be full.", "warn");
    }
  }

  const APP_CONFIG = window.CALENDAR_PLANNER_CONFIG || {};
  const YEAR = Number(APP_CONFIG.appYear) || 2026;
  const MAX_RANK = 5;
  const WINDOW_DAYS_MIN = 6;
  const WINDOW_DAYS_MAX = 9;
  const WEEKDAY_BY_DAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const STATUS_SEQUENCE = ["unselected", "available", "maybe"];
  const SCORE_MAP = { available: 100, maybe: 25, unselected: 0 };
  const RANK_BONUS = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 };
  const AUTO_SAVE_DELAY_MS = 4000;
  const STORAGE_PREFIX = "calendar_planner_wizard_v1";
  const OLD_STORAGE_PREFIX = "trip_week_planner_v1";
  const THEME_STORAGE_KEY = `${STORAGE_PREFIX}:theme`;
  const DEFAULT_WINDOW_START_DAY = normalizeWindowStartDay(APP_CONFIG.defaultWindowStartDay);
  const DEFAULT_WINDOW_DAYS = normalizeWindowDays(APP_CONFIG.defaultWindowDays);
  const DEFAULT_THEME_PREFERENCE = normalizeThemePreference(APP_CONFIG.themePreference || "system");
  const DEFAULT_THEME_TRANSITION_MS = normalizeThemeTransitionMs(APP_CONFIG.themeTransitionMs);

  const state = {
    weeks: [],
    selections: [],
    currentStep: 1,
    isJoined: false,
    hasSavedOnce: false,
    tripCode: "",
    participantName: "",
    tripId: null,
    participantId: null,
    participants: [],
    groupSelections: [],
    selectedDetailWeek: null,
    saveState: "idle",
    backend: null,
    syncState: "cloud_unavailable",
    tripSettingsLocked: false,
    themePreference: DEFAULT_THEME_PREFERENCE,
    windowConfig: {
      startDay: DEFAULT_WINDOW_START_DAY,
      days: DEFAULT_WINDOW_DAYS
    },
    realtimeChannel: null,
    realtimeTimer: null,
    syncing: false,
    autoSaveTimer: null,
    validation: {
      hasAvailable: false,
      rankedCount: 0,
      missingRanks: [1, 2, 3, 4, 5]
    }
  };

  const els = {
    connectionBadge: document.getElementById("connectionBadge"),
    themeSelect: document.getElementById("themeSelect"),
    stepper: document.getElementById("stepper"),
    stepButtons: Array.from(document.querySelectorAll("#stepper .stepper-btn")),
    joinState: document.getElementById("joinState"),
    tripCodeInput: document.getElementById("tripCodeInput"),
    nameInput: document.getElementById("nameInput"),
    windowStartInput: document.getElementById("windowStartInput"),
    windowDaysInput: document.getElementById("windowDaysInput"),
    windowConfigDetails: document.getElementById("windowConfigDetails"),
    windowConfigState: document.getElementById("windowConfigState"),
    joinButton: document.getElementById("joinButton"),
    submitButton: document.getElementById("submitButton"),
    exportButton: document.getElementById("exportButton"),
    clearButton: document.getElementById("clearButton"),
    saveState: document.getElementById("saveState"),
    availableCount: document.getElementById("availableCount"),
    maybeCount: document.getElementById("maybeCount"),
    rankedCount: document.getElementById("rankedCount"),
    step2CountRow: document.getElementById("step2CountRow"),
    selectionOverlay: document.getElementById("selectionOverlay"),
    overlaySelectedCount: document.getElementById("overlaySelectedCount"),
    overlayAvailableCount: document.getElementById("overlayAvailableCount"),
    overlayMaybeCount: document.getElementById("overlayMaybeCount"),
    overlayUnselectedCount: document.getElementById("overlayUnselectedCount"),
    monthBar: document.getElementById("monthBar"),
    overlayPrevStep: document.getElementById("overlayPrevStep"),
    overlayScrollTop: document.getElementById("overlayScrollTop"),
    overlayNextStep: document.getElementById("overlayNextStep"),
    skipToReviewBtn: document.getElementById("skipToReviewBtn"),
    weekGrid: document.getElementById("weekGrid"),
    rankRows: document.getElementById("rankRows"),
    rankNote: document.getElementById("rankNote"),
    reviewList: document.getElementById("reviewList"),
    resultsLocked: document.getElementById("resultsLocked"),
    resultsSection: document.getElementById("resultsSection"),
    scoreChips: document.getElementById("scoreChips"),
    heatmap: document.getElementById("heatmap"),
    participantList: document.getElementById("participantList"),
    leaderboard: document.getElementById("leaderboard"),
    weekDetail: document.getElementById("weekDetail"),
    weekContextMenu: document.getElementById("weekContextMenu"),
    toastArea: document.getElementById("toastArea"),
    panels: {
      1: document.getElementById("step-1"),
      2: document.getElementById("step-2"),
      3: document.getElementById("step-3"),
      4: document.getElementById("step-4")
    }
  };

  init();

  function init() {
    state.weeks = buildWeeks(YEAR, state.windowConfig);
    state.selections = createEmptySelections();
    document.documentElement.style.setProperty("--theme-transition-ms", `${DEFAULT_THEME_TRANSITION_MS}ms`);
    state.backend = new window.PlannerBackend({
      apiBaseUrl: APP_CONFIG.apiBaseUrl || "/api"
    });
    setSyncState(state.backend.isEnabled() ? "cloud_checking" : "cloud_required");

    restoreThemePreference();
    enableThemeTransitionsAfterPaint();
    restoreProfile();
    bindEvents();
    renderWeekCards();
    renderMonthBar();
    renderRankRows();
    updateValidation();
    renderAll();

    const willAutoRejoin = hasResumableSession();
    if (willAutoRejoin) {
      void attemptAutoRejoin();
    } else {
      void probeCloudHealth();
    }
  }

  function hasResumableSession() {
    const tripCode = normalizeTripCode(els.tripCodeInput.value);
    const name = sanitizeName(els.nameInput.value);
    if (!tripCode || !name || !state.backend.isEnabled()) return false;

    const key = `${STORAGE_PREFIX}:session:${YEAR}:${tripCode}:${name}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const session = JSON.parse(raw);
      return Boolean(session && session.isJoined && session.tripId && session.participantId);
    } catch {
      return false;
    }
  }

  async function attemptAutoRejoin() {
    const tripCode = normalizeTripCode(els.tripCodeInput.value);
    const participantName = sanitizeName(els.nameInput.value);
    if (!tripCode || !participantName || !state.backend.isEnabled()) return;

    state.tripCode = tripCode;
    state.participantName = participantName;
    const key = sessionKey();
    if (!key) return;

    let session = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) session = JSON.parse(raw);
    } catch {
      return;
    }

    if (!session || !session.isJoined || !session.tripId || !session.participantId) return;

    setJoinState("Reconnecting...", true);
    els.joinButton.disabled = true;
    els.joinButton.textContent = "Reconnecting...";
    els.joinButton.classList.add("loading");

    try {
      await state.backend.healthCheck();

      const tripResult = await state.backend.joinTrip({
        shareCode: tripCode,
        name: participantName,
        year: YEAR,
        startDay: session.windowStartDay || state.windowConfig.startDay,
        days: session.windowDays || state.windowConfig.days
      });

      const trip = tripResult.trip;
      const resolvedWindowConfig = parseTripWindowConfig(trip.week_format, trip.trip_length);

      state.tripSettingsLocked = true;
      applyWindowConfig(resolvedWindowConfig, { preserveSelections: true });
      state.tripId = trip.id;
      state.participantId = tripResult.participant.id;
      state.isJoined = true;
      state.hasSavedOnce = Boolean(tripResult.participant.submitted_at);
      state.currentStep = Math.max(2, clampStep(tripResult.participant.last_active_step || session.currentStep || 2));

      state.selections = createEmptySelections();
      const remoteSelections = Array.isArray(tripResult.selections) ? tripResult.selections : [];
      remoteSelections.forEach((item) => {
        const index = Number(item.week_number) - 1;
        if (index < 0 || index >= state.selections.length) return;
        state.selections[index] = {
          weekNumber: index + 1,
          status: STATUS_SEQUENCE.includes(item.status) ? item.status : "unselected",
          rank: item.rank && item.rank >= 1 && item.rank <= MAX_RANK ? item.rank : null
        };
      });

      enforceRankConsistency();
      await refreshGroupData();
      setupRealtime();

      setSyncState("live_ready");
      setSaveState("saved");
      setJoinState(`Welcome back, ${participantName}. Live collaboration reconnected.`, true);
      showToast("Session restored.", "good");
    } catch (error) {
      const detail = error && error.message ? `: ${error.message}` : "";
      setJoinState(`Could not reconnect${detail}. Click Join Trip to retry.`, false);
      setSyncState("cloud_unavailable");
      setSaveState("idle");
    } finally {
      els.joinButton.disabled = false;
      els.joinButton.textContent = "Join Trip";
      els.joinButton.classList.remove("loading");
    }

    updateValidation();
    if (state.isJoined) {
      persistSession();
    }
    renderAll();
  }

  function bindEvents() {
    els.joinButton.addEventListener("click", handleJoinTrip);
    els.tripCodeInput.addEventListener("input", handleTripCodeEdit);
    els.tripCodeInput.addEventListener("change", handleTripCodeEdit);
    els.nameInput.addEventListener("change", persistProfile);
    els.tripCodeInput.addEventListener("keydown", handleJoinFieldKeydown);
    els.nameInput.addEventListener("keydown", handleJoinFieldKeydown);
    els.windowStartInput.addEventListener("change", handleWindowConfigInputChange);
    els.windowDaysInput.addEventListener("change", handleWindowConfigInputChange);
    els.themeSelect.addEventListener("change", handleThemeSelection);

    els.stepButtons.forEach((button) => {
      button.addEventListener("click", () => {
        goToStep(Number(button.dataset.step));
      });
    });
    els.submitButton.addEventListener("click", () => saveAvailability(true));
    els.exportButton.addEventListener("click", exportSummary);
    els.clearButton.addEventListener("click", clearSelections);
    els.overlayPrevStep.addEventListener("click", () => goToStep(state.currentStep - 1));
    els.overlayScrollTop.addEventListener("click", () => {
      const target = els.step2CountRow || els.panels[state.currentStep];
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.overlayNextStep.addEventListener("click", () => goToStep(state.currentStep + 1));
    els.skipToReviewBtn.addEventListener("click", () => goToStep(4));

    els.weekContextMenu.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => handleContextMenuSelection(btn.dataset.status));
    });
    document.addEventListener("click", (event) => {
      if (!els.weekContextMenu.hidden && !els.weekContextMenu.contains(event.target)) {
        hideWeekContextMenu();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.weekContextMenu.hidden) {
        hideWeekContextMenu();
      }
    });

    if (window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      if (media.addEventListener) {
        media.addEventListener("change", handleSystemThemeChange);
      }
    }

    window.addEventListener("scroll", syncSelectionOverlayVisibility, { passive: true });
    window.addEventListener("resize", syncSelectionOverlayVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
  }

  function handleJoinFieldKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleJoinTrip();
    }
  }

  function handleTripCodeEdit() {
    const candidateCode = normalizeTripCode(els.tripCodeInput.value);
    if (state.tripSettingsLocked && (!state.isJoined || candidateCode !== state.tripCode)) {
      state.tripSettingsLocked = false;
      renderWindowConfigControls();
    }
    persistProfile();
  }

  async function probeCloudHealth() {
    if (!state.backend.isEnabled()) {
      setSyncState("cloud_required");
      return;
    }

    try {
      await state.backend.healthCheck();
      setSyncState("live_ready");
    } catch {
      setSyncState("cloud_unavailable");
    }
  }

  function buildWeeks(year, windowConfig) {
    const startDay = normalizeWindowStartDay(windowConfig && windowConfig.startDay);
    const days = normalizeWindowDays(windowConfig && windowConfig.days);
    const firstWeekStart = getFirstStartDay(year, startDay);
    return Array.from({ length: 52 }, (_, index) => {
      const start = new Date(firstWeekStart);
      start.setDate(firstWeekStart.getDate() + index * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + days - 1);
      const dayTokens = [];
      for (let offset = 0; offset < days; offset += 1) {
        const cursor = new Date(start);
        cursor.setDate(start.getDate() + offset);
        dayTokens.push({
          label: formatWeekday(cursor),
          date: formatDate(cursor, false)
        });
      }
      return {
        weekNumber: index + 1,
        start,
        end,
        days,
        startDay,
        startDisplay: `${formatWeekday(start)} ${formatDate(start, false)}`,
        endDisplay: `${formatWeekday(end)} ${formatDate(end, false)}`,
        weekdayRangeText: `From ${formatWeekday(start)} to ${formatWeekday(end)}`,
        dayTokens,
        rangeText: `${formatDate(start)} - ${formatDate(end, true)}`
      };
    });
  }

  function getFirstStartDay(year, startDay) {
    const targetDay = startDay === "sun" ? 0 : 6;
    const date = new Date(year, 0, 1);
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  function formatWeekday(date) {
    return WEEKDAY_BY_DAY_INDEX[date.getDay()];
  }

  function formatDate(date, includeYear) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" } : {})
    });
  }

  function normalizeWindowStartDay(value) {
    return value === "sun" ? "sun" : "sat";
  }

  function normalizeWindowDays(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
      return 7;
    }
    return Math.min(WINDOW_DAYS_MAX, Math.max(WINDOW_DAYS_MIN, numeric));
  }

  function normalizeThemePreference(value) {
    return value === "light" || value === "dark" ? value : "system";
  }

  function normalizeThemeTransitionMs(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 220;
    }
    return Math.min(600, Math.max(0, Math.round(numeric)));
  }

  function getResolvedTheme(preference) {
    if (preference === "light" || preference === "dark") {
      return preference;
    }
    if (window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  function applyThemePreference(preference, shouldPersist) {
    state.themePreference = normalizeThemePreference(preference);
    const resolved = getResolvedTheme(state.themePreference);
    document.documentElement.setAttribute("data-theme", resolved);
    els.themeSelect.value = state.themePreference;
    if (shouldPersist) {
      safeSetItem(THEME_STORAGE_KEY, state.themePreference);
    }
  }

  function restoreThemePreference() {
    const saved = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY) || state.themePreference);
    applyThemePreference(saved, false);
  }

  function handleThemeSelection() {
    applyThemePreference(els.themeSelect.value, true);
  }

  function handleSystemThemeChange() {
    if (state.themePreference === "system") {
      applyThemePreference("system", false);
    }
  }

  function enableThemeTransitionsAfterPaint() {
    const ready = () => document.documentElement.classList.add("theme-ready");
    if (!window.requestAnimationFrame) {
      setTimeout(ready, 0);
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(ready);
    });
  }

  function getWindowConfigSummary(windowConfig) {
    const startDay = normalizeWindowStartDay(windowConfig.startDay);
    const days = normalizeWindowDays(windowConfig.days);
    return `${startDay === "sun" ? "Sunday" : "Saturday"} start, ${days}-day windows`;
  }

  function parseTripWindowConfig(weekFormat, tripLength) {
    const normalized = typeof weekFormat === "string" ? weekFormat.toLowerCase() : "";

    if (normalized === "sun_start") {
      return { startDay: "sun", days: normalizeWindowDays(tripLength) };
    }
    if (normalized === "sat_start") {
      return { startDay: "sat", days: normalizeWindowDays(tripLength) };
    }
    if (normalized === "sun_to_sat") {
      return { startDay: "sun", days: 7 };
    }
    if (normalized === "sat_to_sat") {
      return { startDay: "sat", days: 8 };
    }
    if (normalized === "sat_to_sun") {
      return { startDay: "sat", days: 9 };
    }
    if (normalized === "sun_to_sun") {
      return { startDay: "sun", days: 8 };
    }
    if (normalized === "sat_to_fri") {
      return { startDay: "sat", days: 7 };
    }

    return {
      startDay: normalizeWindowStartDay(state.windowConfig.startDay),
      days: normalizeWindowDays(tripLength || state.windowConfig.days)
    };
  }

  function createEmptySelections() {
    return state.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      status: "unselected",
      rank: null
    }));
  }

  function normalizeTripCode(value) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  }

  function sanitizeName(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function profileKey() {
    return `${STORAGE_PREFIX}:profile`;
  }

  function sessionKey() {
    if (!state.tripCode || !state.participantName) return "";
    return `${STORAGE_PREFIX}:session:${YEAR}:${state.tripCode}:${state.participantName}`;
  }

  function oldSessionKey() {
    if (!state.tripCode || !state.participantName) return "";
    return `${OLD_STORAGE_PREFIX}:selections:${YEAR}:${state.tripCode}:${state.participantName}`;
  }

  function persistProfile() {
    safeSetItem(
      profileKey(),
      JSON.stringify({
        tripCode: normalizeTripCode(els.tripCodeInput.value),
        participantName: sanitizeName(els.nameInput.value),
        windowStartDay: normalizeWindowStartDay(els.windowStartInput.value),
        windowDays: normalizeWindowDays(els.windowDaysInput.value)
      })
    );
  }

  function restoreProfile() {
    let profile = null;

    const raw = localStorage.getItem(profileKey());
    if (raw) {
      try {
        profile = JSON.parse(raw);
      } catch {
        profile = null;
      }
    }

    if (!profile) {
      const legacy = localStorage.getItem(`${OLD_STORAGE_PREFIX}:profile`);
      if (legacy) {
        try {
          profile = JSON.parse(legacy);
        } catch {
          profile = null;
        }
      }
    }

    if (!profile) {
      const name = localStorage.getItem("user_name_2026");
      if (name) {
        profile = { participantName: name, tripCode: "" };
      }
    }

    if (!profile) return;

    els.tripCodeInput.value = normalizeTripCode(profile.tripCode || "");
    els.nameInput.value = sanitizeName(profile.participantName || "");
    els.windowStartInput.value = normalizeWindowStartDay(profile.windowStartDay || DEFAULT_WINDOW_START_DAY);
    els.windowDaysInput.value = String(normalizeWindowDays(profile.windowDays || DEFAULT_WINDOW_DAYS));
    applyWindowConfig(
      {
        startDay: els.windowStartInput.value,
        days: Number(els.windowDaysInput.value)
      },
      { preserveSelections: true, rerenderCards: false }
    );
  }

  function handleWindowConfigInputChange() {
    if (state.tripSettingsLocked) {
      renderWindowConfigControls();
      return;
    }

    applyWindowConfig(
      {
        startDay: els.windowStartInput.value,
        days: Number(els.windowDaysInput.value)
      },
      { preserveSelections: true }
    );
    persistProfile();
    renderAll();
  }

  function applyWindowConfig(nextConfig, options) {
    const incoming = options || {};
    const normalized = {
      startDay: normalizeWindowStartDay(nextConfig && nextConfig.startDay),
      days: normalizeWindowDays(nextConfig && nextConfig.days)
    };
    const previous = state.windowConfig;
    const changed = previous.startDay !== normalized.startDay || previous.days !== normalized.days;
    state.windowConfig = normalized;

    if (changed) {
      const priorSelections = state.selections.length ? state.selections : createEmptySelections();
      state.weeks = buildWeeks(YEAR, state.windowConfig);
      state.selections = incoming.preserveSelections === false
        ? createEmptySelections()
        : normalizeSelections(priorSelections);
      state.selectedDetailWeek = null;
      if (incoming.rerenderCards !== false) {
        renderWeekCards();
        renderMonthBar();
      }
    }

    renderWindowConfigControls();
  }

  function renderWindowConfigControls() {
    const startValue = normalizeWindowStartDay(state.windowConfig.startDay);
    const daysValue = normalizeWindowDays(state.windowConfig.days);
    els.windowStartInput.value = startValue;
    els.windowDaysInput.value = String(daysValue);
    els.windowStartInput.disabled = state.tripSettingsLocked;
    els.windowDaysInput.disabled = state.tripSettingsLocked;

    if (state.tripSettingsLocked) {
      els.windowConfigDetails.open = false;
      els.windowConfigDetails.querySelector(".window-config-toggle").textContent =
        `Trip window locked: ${getWindowConfigSummary(state.windowConfig)}`;
      els.windowConfigState.textContent = "These settings were set by the trip creator and cannot be changed.";
      return;
    }

    els.windowConfigDetails.querySelector(".window-config-toggle").textContent =
      "Trip window settings (only for new trip codes)";
    els.windowConfigState.textContent = "These only apply when creating a brand new trip code. Existing trips keep their saved settings.";
  }

  function migrateLegacySelectionsIfPresent() {
    const normalizedCode = normalizeTripCode(els.tripCodeInput.value);
    const normalizedName = sanitizeName(els.nameInput.value);
    if (!normalizedCode || !normalizedName) {
      return;
    }

    state.tripCode = normalizedCode;
    state.participantName = normalizedName;
    loadSession();
  }

  function loadSession() {
    state.selections = createEmptySelections();
    state.hasSavedOnce = false;
    state.selectedDetailWeek = null;

    const key = sessionKey();
    const oldKey = oldSessionKey();
    const raw = key ? localStorage.getItem(key) : null;

    if (raw) {
      try {
        applySessionData(JSON.parse(raw));
        return;
      } catch {
        // Continue to legacy fallback.
      }
    }

    const oldRaw = oldKey ? localStorage.getItem(oldKey) : null;
    if (oldRaw) {
      try {
        const legacySelections = JSON.parse(oldRaw);
        state.selections = normalizeSelections(legacySelections);
        return;
      } catch {
        // Continue to oldest fallback.
      }
    }

    const olderSelected = [];
    for (let i = 0; i < 52; i += 1) {
      if (localStorage.getItem(`week2026-${i}`) === "true") {
        olderSelected.push(i);
      }
    }

    if (olderSelected.length) {
      state.selections = createEmptySelections();
      olderSelected.forEach((index) => {
        state.selections[index].status = "available";
      });
      enforceRankConsistency();
    }
  }

  function applySessionData(payload) {
    if (!state.tripSettingsLocked) {
      applyWindowConfig(
        {
          startDay: payload.windowStartDay || state.windowConfig.startDay,
          days: payload.windowDays || state.windowConfig.days
        },
        { preserveSelections: true }
      );
    }

    const selections = Array.isArray(payload.selections) ? payload.selections : [];
    state.selections = normalizeSelections(selections);
    state.currentStep = clampStep(payload.currentStep || 1);
    state.hasSavedOnce = Boolean(payload.hasSavedOnce);
    state.selectedDetailWeek = payload.selectedDetailWeek || null;
    state.isJoined = Boolean(payload.isJoined);
    state.tripId = payload.tripId || null;
    state.participantId = payload.participantId || null;
  }

  function normalizeSelections(inputSelections) {
    const normalized = createEmptySelections();

    inputSelections.forEach((entry, index) => {
      const weekNumber = Number(entry.weekNumber || index + 1);
      if (weekNumber < 1 || weekNumber > normalized.length) return;

      const status = STATUS_SEQUENCE.includes(entry.status) ? entry.status : "unselected";
      const rank = Number(entry.rank);

      normalized[weekNumber - 1] = {
        weekNumber,
        status,
        rank: Number.isInteger(rank) && rank >= 1 && rank <= MAX_RANK ? rank : null
      };
    });

    return normalizeRankUniqueness(normalized);
  }

  function normalizeRankUniqueness(selections) {
    const seen = new Set();
    selections.forEach((selection) => {
      if (selection.status !== "available") {
        selection.rank = null;
        return;
      }

      if (!selection.rank || selection.rank < 1 || selection.rank > MAX_RANK || seen.has(selection.rank)) {
        selection.rank = null;
        return;
      }

      seen.add(selection.rank);
    });
    return selections;
  }

  function persistSession() {
    const key = sessionKey();
    if (!key) return;

    const payload = {
      selections: state.selections,
      currentStep: state.currentStep,
      hasSavedOnce: state.hasSavedOnce,
      selectedDetailWeek: state.selectedDetailWeek,
      isJoined: state.isJoined,
      tripId: state.tripId,
      participantId: state.participantId,
      windowStartDay: state.windowConfig.startDay,
      windowDays: state.windowConfig.days
    };

    safeSetItem(key, JSON.stringify(payload));
  }

  function clampStep(step) {
    return Math.min(4, Math.max(1, step));
  }

  function goToStep(step) {
    const next = clampStep(step);
    if (!state.isJoined && next > 1) {
      showToast("Join trip first in Step 1.", "warn");
      return;
    }

    if (next === state.currentStep) {
      return;
    }

    const prev = state.currentStep;
    state.currentStep = next;
    if (state.backend.isEnabled() && state.participantId) {
      state.backend.updateParticipantProgress(state.participantId, state.currentStep).catch(() => {
        // Non-blocking sync best effort.
      });
    }

    persistSession();
    renderAll();
    const targetPanel = els.panels[next];
    if (targetPanel) {
      targetPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function handleJoinTrip() {
    if (els.joinButton.disabled) return;

    const tripCode = normalizeTripCode(els.tripCodeInput.value);
    const participantName = sanitizeName(els.nameInput.value);
    const requestedWindowConfig = {
      startDay: normalizeWindowStartDay(els.windowStartInput.value),
      days: normalizeWindowDays(els.windowDaysInput.value)
    };

    if (!tripCode || !participantName) {
      setJoinState("Enter both trip code and name.", false);
      showToast("Trip code and name are required.", "warn");
      return;
    }

    if (!state.backend.isEnabled()) {
      state.isJoined = false;
      state.currentStep = 1;
      setSyncState("cloud_required");
      setSaveState("error");
      setJoinState("Cloud connection is required. Set apiBaseUrl in config.js.", false);
      showToast("Cloud API configuration is required before attendees can submit votes.", "warn");
      renderAll();
      return;
    }

    els.joinButton.disabled = true;
    els.joinButton.textContent = "Connecting...";
    els.joinButton.classList.add("loading");

    const isSameIdentity = state.tripCode === tripCode && state.participantName === participantName;
    const localSelections = isSameIdentity
      ? state.selections.slice().map((s) => ({ ...s }))
      : createEmptySelections();
    cleanupRealtime();
    state.tripCode = tripCode;
    state.participantName = participantName;
    state.tripId = null;
    state.participantId = null;
    state.participants = [];
    state.groupSelections = [];
    state.isJoined = false;
    state.currentStep = 1;
    state.hasSavedOnce = false;
    state.tripSettingsLocked = false;

    applyWindowConfig(requestedWindowConfig, { preserveSelections: true });
    persistProfile();
    setSaveState("saving");
    setJoinState("Connecting to cloud trip...", true);

    try {
      const tripResult = await state.backend.joinTrip({
        shareCode: state.tripCode,
        name: state.participantName,
        year: YEAR,
        startDay: requestedWindowConfig.startDay,
        days: requestedWindowConfig.days
      });
      const trip = tripResult.trip;
      const resolvedWindowConfig = parseTripWindowConfig(trip.week_format, trip.trip_length);

      state.tripSettingsLocked = true;
      applyWindowConfig(resolvedWindowConfig, { preserveSelections: true });
      state.tripId = trip.id;
      const participant = tripResult.participant;
      state.isJoined = true;
      state.participantId = participant.id;
      state.hasSavedOnce = Boolean(participant.submitted_at);
      state.currentStep = Math.max(2, clampStep(participant.last_active_step || 2));
      state.selections = createEmptySelections();

      const remoteSelections = Array.isArray(tripResult.selections) ? tripResult.selections : [];
      const hasRemoteData = remoteSelections.some((item) =>
        item.status === "available" || item.status === "maybe"
      );

      if (hasRemoteData) {
        remoteSelections.forEach((item) => {
          const index = Number(item.week_number) - 1;
          if (index < 0 || index >= state.selections.length) return;
          state.selections[index] = {
            weekNumber: index + 1,
            status: STATUS_SEQUENCE.includes(item.status) ? item.status : "unselected",
            rank: item.rank && item.rank >= 1 && item.rank <= MAX_RANK ? item.rank : null
          };
        });
      } else {
        const hasLocalData = localSelections.some((s) => s.status === "available" || s.status === "maybe");
        if (hasLocalData) {
          state.selections = normalizeSelections(localSelections);
          state.backend.upsertSelections(state.participantId, state.selections).catch(() => {});
        }
      }

      enforceRankConsistency();
      await refreshGroupData();
      setupRealtime();
      await state.backend.updateParticipantProgress(state.participantId, state.currentStep);

      const configSummary = getWindowConfigSummary(resolvedWindowConfig);
      const configChanged =
        requestedWindowConfig.startDay !== resolvedWindowConfig.startDay ||
        requestedWindowConfig.days !== resolvedWindowConfig.days;

      let joinMessage = tripResult.created
        ? `Trip created (${configSummary}). Live collaboration connected.`
        : `Joined existing trip (${configSummary}). Live collaboration connected.`;
      if (!hasRemoteData && localSelections.some((s) => s.status === "available" || s.status === "maybe")) {
        joinMessage += " Your previous selections were restored.";
      }
      setJoinState(joinMessage, true);
      setSaveState("saved");
      setSyncState("live_ready");

      if (tripResult.created) {
        showToast(`Trip created — ${configSummary}.`, "good");
      } else if (configChanged) {
        showToast(`Joined trip. Window adjusted to match trip: ${configSummary}.`, "good");
      } else {
        showToast("Connected to cloud voting.", "good");
      }
    } catch (error) {
      console.error(error);
      cleanupRealtime();
      state.isJoined = false;
      state.tripId = null;
      state.participantId = null;
      state.participants = [];
      state.groupSelections = [];
      state.currentStep = 1;
      state.hasSavedOnce = false;
      state.selections = createEmptySelections();
      state.tripSettingsLocked = false;
      setSaveState("error");
      const detail = error && error.message ? `: ${error.message}` : "";
      setJoinState(`Cloud connection failed${detail}.`, false);
      setSyncState("cloud_unavailable");
      showToast(`Could not connect to cloud${detail}.`, "warn");
    }

    els.joinButton.disabled = false;
    els.joinButton.textContent = "Join Trip";
    els.joinButton.classList.remove("loading");
    updateValidation();
    persistProfile();
    persistSession();
    renderAll();
  }

  function renderMonthBar() {
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthFirstWeek = new Map();
    state.weeks.forEach((week, index) => {
      const month = week.start.getMonth();
      if (!monthFirstWeek.has(month)) {
        monthFirstWeek.set(month, index);
      }
    });

    els.monthBar.innerHTML = "";
    MONTH_NAMES.forEach((name, monthIndex) => {
      const weekIndex = monthFirstWeek.get(monthIndex);
      if (weekIndex === undefined) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "month-btn";
      btn.textContent = name;
      btn.setAttribute("aria-label", `Jump to ${name}`);
      btn.addEventListener("click", () => {
        const card = els.weekGrid.children[weekIndex];
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      els.monthBar.appendChild(btn);
    });
  }

  function renderWeekCards() {
    els.weekGrid.innerHTML = "";
    state.weeks.forEach((week, index) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "week-card";
      card.dataset.index = String(index);
      card.setAttribute("role", "listitem");
      const stripMarkup = week.dayTokens
        .map((token, tokenIndex) => {
          const classes = [];
          if (tokenIndex === 0) classes.push("start");
          if (tokenIndex === week.dayTokens.length - 1) classes.push("end");
          const classMarkup = classes.length ? ` class="${classes.join(" ")}"` : "";
          return `<span${classMarkup}>${token.label.slice(0, 2)}</span>`;
        })
        .join("");
      const dayCountClass = `days-${week.dayTokens.length}`;

      card.innerHTML = `
        <div class="week-title"><span>Week ${week.weekNumber}</span><span>W${week.weekNumber}</span></div>
        <div class="window-flow">
          <span class="flow-point start">From ${week.startDisplay}</span>
          <span class="flow-arrow" aria-hidden="true">&rarr;</span>
          <span class="flow-point end">To ${week.endDisplay}</span>
        </div>
        <div class="range">${week.rangeText}</div>
        <div class="weekday-range">${week.weekdayRangeText} &middot; ${week.days} days</div>
        <div class="day-strip ${dayCountClass}" aria-hidden="true">${stripMarkup}</div>
        <span class="status-pill">Unselected</span>
        <span class="rank-pill" hidden>#1</span>
      `;

      card.addEventListener("click", () => toggleWeekStatus(index));
      card.addEventListener("contextmenu", (event) => showWeekContextMenu(event, index));
      card.addEventListener("keydown", (event) => {
        if (event.key >= "1" && event.key <= "5") {
          event.preventDefault();
          assignRank(index + 1, Number(event.key));
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          clearWeekRank(index + 1);
        }
      });

      els.weekGrid.appendChild(card);
    });
  }

  function updateWeekCards() {
    const cards = els.weekGrid.querySelectorAll(".week-card");
    cards.forEach((card, index) => {
      const selection = state.selections[index];
      const status = selection.status;
      card.dataset.status = status;

      const statusPill = card.querySelector(".status-pill");
      const rankPill = card.querySelector(".rank-pill");

      const statusLabel = status === "available" ? "Available" : status === "maybe" ? "Maybe" : "Unselected";
      statusPill.textContent = statusLabel;

      if (selection.rank) {
        rankPill.hidden = false;
        rankPill.textContent = `#${selection.rank}`;
      } else {
        rankPill.hidden = true;
      }

      card.setAttribute(
        "aria-label",
        `Week ${index + 1}. From ${state.weeks[index].startDisplay} to ${state.weeks[index].endDisplay}. ${state.weeks[index].days} days. Status ${statusLabel}${selection.rank ? `. Rank ${selection.rank}` : ""}`
      );
      card.setAttribute("aria-pressed", String(status !== "unselected"));
    });
  }

  let contextMenuWeekIndex = null;

  function showWeekContextMenu(event, index) {
    event.preventDefault();
    contextMenuWeekIndex = index;
    const menu = els.weekContextMenu;
    menu.hidden = false;

    const menuRect = menu.getBoundingClientRect();
    let x = event.clientX;
    let y = event.clientY;
    if (x + menuRect.width > window.innerWidth) {
      x = window.innerWidth - menuRect.width - 8;
    }
    if (y + menuRect.height > window.innerHeight) {
      y = window.innerHeight - menuRect.height - 8;
    }
    menu.style.left = `${Math.max(4, x)}px`;
    menu.style.top = `${Math.max(4, y)}px`;
  }

  function hideWeekContextMenu() {
    els.weekContextMenu.hidden = true;
    contextMenuWeekIndex = null;
  }

  function handleContextMenuSelection(status) {
    if (contextMenuWeekIndex === null) return;
    const index = contextMenuWeekIndex;
    hideWeekContextMenu();
    state.selections[index].status = status;
    if (status !== "available") {
      state.selections[index].rank = null;
    }
    enforceRankConsistency();
    updateValidation();
    setSaveState("dirty");
    persistSession();
    renderAll();
  }

  function toggleWeekStatus(index) {
    const current = state.selections[index].status;
    const next = STATUS_SEQUENCE[(STATUS_SEQUENCE.indexOf(current) + 1) % STATUS_SEQUENCE.length];
    state.selections[index].status = next;
    if (next !== "available") {
      state.selections[index].rank = null;
    }

    enforceRankConsistency();
    updateValidation();
    setSaveState("dirty");
    persistSession();
    renderAll();
  }

  function renderRankRows() {
    els.rankRows.innerHTML = "";

    for (let rank = 1; rank <= MAX_RANK; rank += 1) {
      const row = document.createElement("div");
      row.className = "rank-row";

      const chip = document.createElement("span");
      chip.className = "rank-chip";
      chip.textContent = `#${rank}`;

      const select = document.createElement("select");
      select.className = "rank-select";
      select.dataset.rank = String(rank);
      select.setAttribute("aria-label", `Rank ${rank}`);
      select.addEventListener("change", (event) => {
        const value = Number(event.target.value);
        assignRankByWeekNumber(value || null, rank);
      });

      row.append(chip, select);
      els.rankRows.appendChild(row);
    }
  }

  function updateRankRows() {
    const availableWeeks = state.weeks.filter((_, index) => state.selections[index].status === "available");
    const selects = els.rankRows.querySelectorAll(".rank-select");

    selects.forEach((select) => {
      const rank = Number(select.dataset.rank);
      const currentWeek = findWeekByRank(rank);

      select.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Not set";
      select.appendChild(empty);

      availableWeeks.forEach((week) => {
        const option = document.createElement("option");
        option.value = String(week.weekNumber);
        const sel = state.selections[week.weekNumber - 1];
        const assignedRank = sel && sel.rank;
        const isThisRank = assignedRank === rank;
        const isOtherRank = assignedRank && !isThisRank;
        let label = `W${String(week.weekNumber).padStart(2, "0")} - ${week.rangeText}`;
        if (isThisRank) {
          label = `\u2713 ${label}`;
        } else if (isOtherRank) {
          label = `${label}  (#${assignedRank})`;
        }
        option.textContent = label;
        if (isOtherRank) {
          option.style.color = "#9ca3af";
        }
        select.appendChild(option);
      });

      select.value = currentWeek ? String(currentWeek) : "";
      select.classList.toggle("rank-filled", Boolean(currentWeek));
    });

    const missing = state.validation.missingRanks;
    els.rankNote.textContent = missing.length
      ? `Open rank slots: ${missing.map((item) => `#${item}`).join(", ")}`
      : "All rank slots are filled.";
  }

  function assignRank(weekNumber, rank) {
    const index = weekNumber - 1;
    const selection = state.selections[index];
    if (!selection || selection.status !== "available") {
      showToast("Only available weeks can be ranked.", "warn");
      return;
    }

    state.selections.forEach((item) => {
      if (item.rank === rank) item.rank = null;
    });

    selection.rank = rank;
    enforceRankConsistency();
    updateValidation();
    setSaveState("dirty");
    persistSession();
    renderAll();
  }

  function assignRankByWeekNumber(weekNumber, rank) {
    state.selections.forEach((item) => {
      if (item.rank === rank) item.rank = null;
    });

    if (weekNumber) {
      const index = weekNumber - 1;
      const selection = state.selections[index];
      if (!selection || selection.status !== "available") {
        showToast("Pick an available week for this rank.", "warn");
      } else {
        selection.rank = rank;
      }
    }

    enforceRankConsistency();
    updateValidation();
    setSaveState("dirty");
    persistSession();
    renderAll();
  }

  function clearWeekRank(weekNumber) {
    const index = weekNumber - 1;
    if (!state.selections[index]) return;

    state.selections[index].rank = null;
    enforceRankConsistency();
    updateValidation();
    setSaveState("dirty");
    persistSession();
    renderAll();
  }

  function enforceRankConsistency() {
    normalizeRankUniqueness(state.selections);
  }

  function findWeekByRank(rank) {
    const found = state.selections.find((selection) => selection.rank === rank);
    return found ? found.weekNumber : null;
  }

  function updateValidation() {
    const availableCount = state.selections.filter((selection) => selection.status === "available").length;
    const maybeCount = state.selections.filter((selection) => selection.status === "maybe").length;
    const rankedCount = state.selections.filter((selection) => selection.rank !== null).length;

    const missingRanks = [];
    for (let rank = 1; rank <= MAX_RANK; rank += 1) {
      if (!findWeekByRank(rank)) {
        missingRanks.push(rank);
      }
    }

    state.validation = {
      hasAvailable: availableCount > 0,
      rankedCount,
      missingRanks,
      availableCount,
      maybeCount
    };
  }

  function renderReviewChecklist() {
    const list = [
      {
        className: state.isJoined ? "ok" : "warn",
        text: state.isJoined
          ? `Joined trip ${state.tripCode} as ${state.participantName}.`
          : "Join trip with code and name."
      },
      {
        className: state.validation.hasAvailable ? "ok" : "warn",
        text: state.validation.hasAvailable
          ? `${state.validation.availableCount} available week(s) selected.`
          : "No available weeks selected yet."
      },
      {
        className: "ok",
        text: `Trip window: ${getWindowConfigSummary(state.windowConfig)}.`
      },
      {
        className: state.validation.missingRanks.length === 0 ? "ok" : "info",
        text: state.validation.missingRanks.length === 0
          ? "Top 5 ranks completed."
          : `Ranking is optional \u2014 ${MAX_RANK - state.validation.missingRanks.length} of ${MAX_RANK} slots filled.`
      },
      {
        className: state.hasSavedOnce ? "ok" : "warn",
        text: state.hasSavedOnce ? "Submitted at least once. Results are unlocked." : "Save once to unlock group results."
      },
      {
        className: state.syncState === "live_ready" ? "ok" : "warn",
        text: state.syncState === "live_ready"
          ? "Cloud voting is active."
          : state.syncState === "cloud_checking"
            ? "Checking cloud availability..."
            : state.syncState === "cloud_required"
              ? "Cloud connection is required before attendees can vote."
              : "Cloud connection is currently unavailable."
      }
    ];

    els.reviewList.innerHTML = "";
    list.forEach((item) => {
      const li = document.createElement("li");
      li.className = item.className;
      const icon = item.className === "ok" ? "\u2713" : item.className === "info" ? "\u2014" : "\u25CB";
      li.innerHTML = `<span class="checklist-icon">${icon}</span><span>${item.text}</span>`;
      els.reviewList.appendChild(li);
    });
  }

  function scheduleAutoSave() {
    cancelAutoSave();
    if (!state.isJoined || !state.backend.isEnabled() || !state.participantId) return;
    state.autoSaveTimer = setTimeout(async () => {
      state.autoSaveTimer = null;
      if (state.saveState !== "dirty") return;
      setSaveState("saving");
      try {
        await state.backend.upsertSelections(state.participantId, state.selections);
        await state.backend.updateParticipantProgress(state.participantId, state.currentStep);
        setSaveState("saved");
        setSyncState("live_ready");
        persistSession();
      } catch {
        setSaveState("dirty");
      }
    }, AUTO_SAVE_DELAY_MS);
  }

  function cancelAutoSave() {
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
      state.autoSaveTimer = null;
    }
  }

  async function saveAvailability(isFinalSubmit) {
    if (els.submitButton.disabled) return;

    if (!state.isJoined) {
      showToast("Join trip first.", "warn");
      goToStep(1);
      return;
    }

    cancelAutoSave();
    els.submitButton.disabled = true;
    els.submitButton.textContent = "Saving...";
    els.submitButton.classList.add("loading");
    setSaveState("saving");
    persistSession();

    if (!state.backend.isEnabled() || !state.participantId) {
      setSaveState("error");
      setSyncState(state.backend.isEnabled() ? "cloud_unavailable" : "cloud_required");
      showToast("Cloud submission is required. Reconnect and try again.", "warn");
      return;
    }

    try {
      await state.backend.upsertSelections(state.participantId, state.selections);
      if (isFinalSubmit) {
        await state.backend.markSubmitted(state.participantId);
      }

      await state.backend.updateParticipantProgress(state.participantId, state.currentStep);
      await refreshGroupData();

      state.hasSavedOnce = true;
      setSaveState("saved");
      setSyncState("live_ready");
      persistSession();
      renderAll();
      showToast("Availability submitted.", "good");
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setSyncState("cloud_unavailable");
      const detail = error && error.message ? `: ${error.message}` : "";
      showToast(`Cloud save failed${detail}. Please retry.`, "warn");
    } finally {
      els.submitButton.disabled = false;
      els.submitButton.textContent = "Submit Availability";
      els.submitButton.classList.remove("loading");
    }
  }

  async function refreshGroupData() {
    if (!state.backend.isEnabled() || !state.tripId) {
      state.participants = [];
      state.groupSelections = [];
      return;
    }

    const data = await state.backend.fetchGroupData(state.tripId);
    state.participants = data.participants;
    state.groupSelections = data.selections;
  }

  function setupRealtime() {
    cleanupRealtime();
    if (!state.backend.isEnabled() || !state.tripId) {
      return;
    }

    state.realtimeChannel = state.backend.subscribeToTrip(state.tripId, () => {
      if (state.realtimeTimer) return;
      state.realtimeTimer = setTimeout(async () => {
        state.realtimeTimer = null;
        if (state.syncing) return;

        state.syncing = true;
        try {
          await refreshGroupData();
          renderResults();
          const now = new Date();
          setJoinState(`Live update received at ${now.toLocaleTimeString()}.`, true);
          setSyncState("live_ready");
        } catch (error) {
          console.error(error);
          setSyncState("cloud_unavailable");
        } finally {
          state.syncing = false;
        }
      }, 220);
    });
  }

  function handleBeforeUnload(event) {
    cleanupRealtime();
    if (state.saveState === "dirty") {
      event.preventDefault();
    }
  }

  function cleanupRealtime() {
    cancelAutoSave();
    if (state.realtimeTimer) {
      clearTimeout(state.realtimeTimer);
      state.realtimeTimer = null;
    }

    if (state.backend && state.realtimeChannel) {
      state.backend.removeSubscription(state.realtimeChannel).catch(() => {
        // Best effort cleanup.
      });
    }

    state.realtimeChannel = null;
  }

  function setJoinState(message, positive) {
    els.joinState.textContent = message;
    els.joinState.classList.remove("hint--positive", "hint--error", "hint--muted");
    els.joinState.classList.add(positive ? "hint--positive" : "hint--muted");
  }

  function setSaveState(mode) {
    state.saveState = mode;
    const text = {
      idle: "Not saved yet.",
      dirty: "Unsaved changes.",
      saving: "Saving...",
      saved: "Saved.",
      error: "Save failed."
    };
    els.saveState.textContent = text[mode] || text.idle;
    els.saveState.classList.remove("hint--positive", "hint--error", "hint--muted");
    if (mode === "saved") {
      els.saveState.classList.add("hint--positive");
    } else if (mode === "error") {
      els.saveState.classList.add("hint--error");
    } else {
      els.saveState.classList.add("hint--muted");
    }
    if (mode === "dirty") {
      scheduleAutoSave();
    }
  }

  function setSyncState(mode) {
    const normalizedMode =
      mode === "live_ready" || mode === "cloud_unavailable" || mode === "cloud_checking"
        ? mode
        : "cloud_required";
    state.syncState = normalizedMode;

    els.connectionBadge.classList.remove("online", "degraded", "required", "checking");
    if (normalizedMode === "live_ready") {
      els.connectionBadge.classList.add("online");
      els.connectionBadge.textContent = "Cloud connected";
      return;
    }

    if (normalizedMode === "cloud_checking") {
      els.connectionBadge.classList.add("checking");
      els.connectionBadge.textContent = "Checking cloud...";
      return;
    }

    if (normalizedMode === "cloud_unavailable") {
      els.connectionBadge.classList.add("degraded");
      els.connectionBadge.textContent = "Cloud unavailable";
      return;
    }

    els.connectionBadge.classList.add("required");
    els.connectionBadge.textContent = "Cloud connection required";
  }

  function renderStepper() {
    const items = els.stepper.querySelectorAll("li");
    items.forEach((item) => {
      const button = item.querySelector(".stepper-btn");
      if (!button) return;
      const step = Number(button.dataset.step);
      item.classList.toggle("active", step === state.currentStep);
      item.classList.toggle("complete", step < state.currentStep && state.isJoined);
      button.disabled = !state.isJoined && step > 1;
      button.setAttribute("aria-current", step === state.currentStep ? "step" : "false");
    });
  }

  function renderPanels() {
    Object.entries(els.panels).forEach(([step, panel]) => {
      panel.hidden = Number(step) !== state.currentStep;
    });
    syncSelectionOverlayVisibility();
  }

  function getSelectionMetrics() {
    const available = state.validation.availableCount || 0;
    const maybe = state.validation.maybeCount || 0;
    const selected = available + maybe;
    const total = state.weeks.length || 0;
    return {
      available,
      maybe,
      selected,
      unselected: Math.max(0, total - selected)
    };
  }

  function renderCounts() {
    const metrics = getSelectionMetrics();
    els.availableCount.textContent = String(metrics.available);
    els.maybeCount.textContent = String(metrics.maybe);
    els.rankedCount.textContent = `${state.validation.rankedCount || 0} / ${MAX_RANK}`;
    if (els.overlaySelectedCount) {
      els.overlaySelectedCount.textContent = String(metrics.selected);
    }
    if (els.overlayAvailableCount) {
      els.overlayAvailableCount.textContent = String(metrics.available);
    }
    if (els.overlayMaybeCount) {
      els.overlayMaybeCount.textContent = String(metrics.maybe);
    }
    if (els.overlayUnselectedCount) {
      els.overlayUnselectedCount.textContent = String(metrics.unselected);
    }
    syncSelectionOverlayVisibility();
  }

  function syncSelectionOverlayVisibility() {
    if (!els.selectionOverlay) return;
    const onStep2 = state.currentStep === 2;
    els.selectionOverlay.hidden = !onStep2;
    if (onStep2) {
      els.overlayPrevStep.textContent = "\u2190 Join Trip";
      els.overlayNextStep.textContent = "Rank Top 5 \u2192";
    }
  }

  function renderResultsGate() {
    const unlocked = state.hasSavedOnce;
    els.resultsLocked.hidden = unlocked;
    els.resultsSection.hidden = !unlocked;
  }

  function computeAggregates() {
    /** @type {Participant[]} */
    const participants = state.participants.length
      ? state.participants
      : [{ id: "local", name: state.participantName || "You", submitted_at: null, last_active_step: state.currentStep }];

    const selectionRows = state.groupSelections.length
      ? state.groupSelections
      : state.selections.map((selection) => ({
          participant_id: participants[0].id,
          week_number: selection.weekNumber,
          status: selection.status,
          rank: selection.rank
        }));

    const map = new Map();
    state.weeks.forEach((week) => {
      map.set(week.weekNumber, {
        weekNumber: week.weekNumber,
        availableCount: 0,
        maybeCount: 0,
        unselectedCount: 0,
        score: 0,
        avgRank: null,
        rankTotal: 0,
        rankCount: 0,
        people: []
      });
    });

    selectionRows.forEach((row) => {
      const aggregate = map.get(row.week_number);
      if (!aggregate) return;

      const status = STATUS_SEQUENCE.includes(row.status) ? row.status : "unselected";
      if (status === "available") aggregate.availableCount += 1;
      if (status === "maybe") aggregate.maybeCount += 1;
      if (status === "unselected") aggregate.unselectedCount += 1;

      if (row.rank) {
        aggregate.rankTotal += row.rank;
        aggregate.rankCount += 1;
      }

      const person = participants.find((entry) => entry.id === row.participant_id);
      aggregate.people.push({
        name: person ? person.name : "Unknown",
        status,
        rank: row.rank || null
      });
    });

    const aggregates = Array.from(map.values());
    aggregates.forEach((entry) => {
      let rankBonus = 0;
      entry.people.forEach((person) => {
        if (person.rank) {
          rankBonus += RANK_BONUS[person.rank] || 0;
        }
      });

      entry.score = entry.availableCount * SCORE_MAP.available + entry.maybeCount * SCORE_MAP.maybe + rankBonus;
      entry.avgRank = entry.rankCount ? entry.rankTotal / entry.rankCount : null;
    });

    aggregates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.availableCount !== a.availableCount) return b.availableCount - a.availableCount;
      const aRank = a.avgRank === null ? Number.POSITIVE_INFINITY : a.avgRank;
      const bRank = b.avgRank === null ? Number.POSITIVE_INFINITY : b.avgRank;
      if (aRank !== bRank) return aRank - bRank;
      return a.weekNumber - b.weekNumber;
    });

    return aggregates;
  }

  function renderResults() {
    if (!state.hasSavedOnce) {
      return;
    }

    const aggregates = computeAggregates();
    const topWeek = aggregates[0] || null;
    const maxScore = Math.max(1, ...aggregates.map((item) => item.score));
    const maxAvailable = Math.max(1, ...aggregates.map((item) => item.availableCount));

    const topWeekData = topWeek ? state.weeks[topWeek.weekNumber - 1] : null;
    const participants = state.participants.length
      ? state.participants
      : [{ id: "local", name: state.participantName || "You", submitted_at: state.hasSavedOnce ? new Date().toISOString() : null }];
    const totalPeople = participants.length;
    const submittedCount = participants.filter((p) => p.submitted_at).length;
    const topAvailPct = topWeek && totalPeople > 0
      ? Math.round((topWeek.availableCount / totalPeople) * 100)
      : 0;

    const scoreCards = [
      { label: "Participants", value: String(totalPeople) },
      { label: "Best Week", value: topWeek ? `W${topWeek.weekNumber}` : "-", sub: topWeekData ? topWeekData.rangeText : "" },
      { label: "Best Overlap", value: topWeek ? `${topWeek.availableCount} of ${totalPeople}` : "-", sub: topAvailPct ? `${topAvailPct}% available` : "" },
      { label: "Submissions", value: `${submittedCount} of ${totalPeople}` }
    ];

    els.scoreChips.innerHTML = "";
    scoreCards.forEach((card) => {
      const item = document.createElement("article");
      item.className = "score-chip";
      item.innerHTML = `<span>${card.label}</span><strong>${card.value}</strong>${card.sub ? `<span class="score-chip-sub">${card.sub}</span>` : ""}`;
      els.scoreChips.appendChild(item);
    });

    els.heatmap.innerHTML = "";
    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let lastMonth = -1;

    aggregates
      .slice()
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .forEach((entry) => {
        const week = state.weeks[entry.weekNumber - 1];
        const month = week ? week.start.getMonth() : -1;
        if (month !== lastMonth) {
          lastMonth = month;
          const label = document.createElement("div");
          label.className = "heat-month-label";
          label.textContent = MONTH_LABELS[month] || "";
          els.heatmap.appendChild(label);
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "heat-cell";
        if (state.selectedDetailWeek === entry.weekNumber) {
          button.classList.add("active");
        }

        const intensity = entry.availableCount / maxAvailable;
        const alpha = 0.12 + intensity * 0.7;
        button.style.background = `rgba(22, 163, 74, ${alpha.toFixed(2)})`;
        button.textContent = `W${entry.weekNumber}`;
        button.title = week ? `${week.rangeText} — ${entry.availableCount} avail, ${entry.maybeCount} maybe` : "";
        button.setAttribute(
          "aria-label",
          `Week ${entry.weekNumber}${week ? `, ${week.rangeText}` : ""}, ${entry.availableCount} available, ${entry.maybeCount} maybe`
        );

        button.addEventListener("click", () => {
          state.selectedDetailWeek = entry.weekNumber;
          persistSession();
          renderResults();
        });

        els.heatmap.appendChild(button);
      });

    els.participantList.innerHTML = "";
    participants.forEach((participant) => {
      const li = document.createElement("li");
      const done = Boolean(participant.submitted_at);
      li.className = done ? "done" : "";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = participant.name;
      const statusSpan = document.createElement("span");
      statusSpan.textContent = done ? "Submitted" : "Not submitted";
      li.append(nameSpan, statusSpan);
      els.participantList.appendChild(li);
    });

    els.leaderboard.innerHTML = "";
    aggregates.slice(0, 10).forEach((entry, index) => {
      const week = state.weeks[entry.weekNumber - 1];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lb-row";
      if (index === 0 && entry.score > 0) row.classList.add("lb-top-pick");
      if (state.selectedDetailWeek === entry.weekNumber) row.classList.add("lb-active");
      const width = (entry.score / maxScore) * 100;
      const totalPeople = (state.participants.length || 1);
      const availPct = totalPeople > 0 ? Math.round((entry.availableCount / totalPeople) * 100) : 0;
      row.innerHTML = `
        <div class="lb-header">
          <span class="lb-rank">#${index + 1}</span>
          <div class="lb-info">
            <span class="lb-title">Week ${entry.weekNumber}</span>
            <span class="lb-dates">${week ? week.rangeText : ""}</span>
          </div>
        </div>
        <div class="lb-stats">
          <span class="lb-stat available">${entry.availableCount} available</span>
          <span class="lb-stat maybe">${entry.maybeCount} maybe</span>
          <span class="lb-stat pct">${availPct}% of group</span>
        </div>
        <div class="lb-bar"><span style="width:${width.toFixed(1)}%"></span></div>
      `;
      row.addEventListener("click", () => {
        state.selectedDetailWeek = entry.weekNumber;
        persistSession();
        renderResults();
      });
      els.leaderboard.appendChild(row);
    });

    if (!state.selectedDetailWeek && topWeek) {
      state.selectedDetailWeek = topWeek.weekNumber;
    }

    renderWeekDetail(aggregates);
  }

  function renderWeekDetail(aggregates) {
    const target = aggregates.find((entry) => entry.weekNumber === state.selectedDetailWeek);
    if (!target) {
      els.weekDetail.innerHTML = `<span class="wd-empty">Click a week in the heatmap or leaderboard to see who's available.</span>`;
      return;
    }

    const week = state.weeks[target.weekNumber - 1];
    const sortedPeople = target.people
      .slice()
      .sort((a, b) => {
        const weight = { available: 0, maybe: 1, unselected: 2 };
        if (weight[a.status] !== weight[b.status]) {
          return weight[a.status] - weight[b.status];
        }
        return a.name.localeCompare(b.name);
      });

    const statusBadge = (status) => {
      const cls = status === "available" ? "wd-badge-available" : status === "maybe" ? "wd-badge-maybe" : "wd-badge-unselected";
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      return `<span class="wd-badge ${cls}">${label}</span>`;
    };

    const peopleRows = sortedPeople.length
      ? sortedPeople
          .map((person) =>
            `<div class="wd-person">` +
              `<span class="wd-person-name">${escapeHtml(person.name)}</span>` +
              `${statusBadge(person.status)}` +
              `${person.rank ? `<span class="wd-person-rank">#${person.rank}</span>` : ""}` +
            `</div>`
          )
          .join("")
      : `<p class="wd-empty">No participant details yet.</p>`;

    els.weekDetail.innerHTML = `
      <div class="wd-header">
        <strong>Week ${target.weekNumber}</strong>
        <span class="wd-dates">${week ? week.rangeText : ""}</span>
      </div>
      <div class="wd-summary">
        <span class="lb-stat available">${target.availableCount} available</span>
        <span class="lb-stat maybe">${target.maybeCount} maybe</span>
        <span class="lb-stat">${target.unselectedCount} unselected</span>
      </div>
      <div class="wd-people">${peopleRows}</div>
    `;
  }

  function renderAll() {
    updateValidation();
    renderWindowConfigControls();
    renderStepper();
    renderPanels();
    renderCounts();
    updateWeekCards();
    updateRankRows();
    renderReviewChecklist();
    renderResultsGate();
    renderResults();
  }

  async function clearSelections() {
    const confirmed = window.confirm("Clear all week statuses and rankings for your profile?");
    if (!confirmed) return;

    state.selections = createEmptySelections();
    state.selectedDetailWeek = null;
    updateValidation();
    persistSession();
    renderAll();

    if (state.isJoined && state.backend.isEnabled() && state.participantId) {
      setSaveState("saving");
      try {
        await state.backend.upsertSelections(state.participantId, state.selections);
        setSaveState("saved");
        setSyncState("live_ready");
        showToast("Selections cleared and synced.", "good");
      } catch {
        setSaveState("error");
        showToast("Cleared locally but cloud sync failed.", "warn");
      }
    } else {
      setSaveState("dirty");
    }
    persistSession();
  }

  function exportSummary() {
    if (!state.isJoined) {
      showToast("Join trip first.", "warn");
      return;
    }

    const available = state.selections.filter((selection) => selection.status === "available");
    const maybe = state.selections.filter((selection) => selection.status === "maybe");

    if (!available.length && !maybe.length) {
      showToast("Nothing selected yet.", "warn");
      return;
    }

    const ranked = state.selections
      .filter((selection) => selection.rank)
      .sort((a, b) => (a.rank || 0) - (b.rank || 0));

    const lines = [];
    lines.push(`${YEAR} TRIP AVAILABILITY`);
    lines.push(`Trip Code: ${state.tripCode}`);
    lines.push(`Name: ${state.participantName}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("=".repeat(36));
    lines.push("");

    lines.push("Top Ranked Weeks:");
    if (ranked.length) {
      ranked.forEach((selection) => {
        lines.push(
          `#${selection.rank}: Week ${selection.weekNumber} (${state.weeks[selection.weekNumber - 1].rangeText})`
        );
      });
    } else {
      lines.push("No ranked picks yet.");
    }

    lines.push("");
    lines.push("Available Weeks:");
    if (available.length) {
      available.forEach((selection) => {
        lines.push(`- Week ${selection.weekNumber}: ${state.weeks[selection.weekNumber - 1].rangeText}`);
      });
    } else {
      lines.push("None");
    }

    lines.push("");
    lines.push("Maybe Weeks:");
    if (maybe.length) {
      maybe.forEach((selection) => {
        lines.push(`- Week ${selection.weekNumber}: ${state.weeks[selection.weekNumber - 1].rangeText}`);
      });
    } else {
      lines.push("None");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${YEAR}_${state.tripCode}_${state.participantName.replace(/\s+/g, "_")}_availability.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 200);
  }

  function showToast(message, tone) {
    const toast = document.createElement("div");
    toast.className = `toast ${tone || ""}`.trim();
    toast.textContent = message;
    els.toastArea.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2500);
  }
})();
