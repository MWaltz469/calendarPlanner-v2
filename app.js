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

  const AVATAR_COLORS = [
    "#0f766e", "#0369a1", "#7c3aed", "#c026d3", "#db2777",
    "#dc2626", "#ea580c", "#d97706", "#65a30d", "#059669"
  ];

  function nameColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function avatarHtml(name) {
    const initial = (name || "?").charAt(0).toUpperCase();
    const bg = nameColor(name);
    return `<span class="avatar" style="background:${bg}">${escapeHtml(initial)}</span>`;
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
  const WINDOW_DAYS_MIN = 2;
  const WINDOW_DAYS_MAX = 14;
  const WEEKDAY_BY_DAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const VALID_START_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const START_DAY_LABELS = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };
  const STATUS_SEQUENCE = ["unselected", "available", "maybe"];
  const SCORE_MAP = { available: 100, maybe: 0, unselected: 0 };
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
    selectedMonth: null,
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
    overlaySummary: document.getElementById("overlaySummary"),
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
    resultsSummary: document.getElementById("resultsSummary"),
    participantSummary: document.getElementById("participantSummary"),
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

    const rejoinTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), 10000)
    );

    try {
      await Promise.race([state.backend.healthCheck(), rejoinTimeout]);

      const tripResult = await Promise.race([
        state.backend.joinTrip({
          shareCode: tripCode,
          name: participantName,
          year: YEAR,
          startDay: session.windowStartDay || state.windowConfig.startDay,
          days: session.windowDays || state.windowConfig.days
        }),
        rejoinTimeout
      ]);

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
      const isNotFound = detail.toLowerCase().includes("not found");
      if (isNotFound) {
        // Trip no longer exists — clear stale session so we don't retry
        try { localStorage.removeItem(key); } catch {}
        setJoinState(`Trip code "${tripCode}" no longer exists. Enter a valid code.`, false);
      } else {
        setJoinState(`Could not reconnect${detail}. Click Join Trip to retry.`, false);
      }
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
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = dayMap[startDay] !== undefined ? dayMap[startDay] : 6;
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
    const v = String(value || "").toLowerCase();
    return VALID_START_DAYS.includes(v) ? v : "sat";
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
    return `${START_DAY_LABELS[startDay] || "Saturday"} start, ${days}-day windows`;
  }

  function parseTripWindowConfig(weekFormat, tripLength) {
    const normalized = typeof weekFormat === "string" ? weekFormat.toLowerCase() : "";

    const startMatch = normalized.match(/^(\w+)_start$/);
    if (startMatch && VALID_START_DAYS.includes(startMatch[1])) {
      return { startDay: startMatch[1], days: normalizeWindowDays(tripLength) };
    }

    // Legacy formats
    if (normalized === "sun_to_sat") return { startDay: "sun", days: 7 };
    if (normalized === "sat_to_sat") return { startDay: "sat", days: 8 };
    if (normalized === "sat_to_sun") return { startDay: "sat", days: 9 };
    if (normalized === "sun_to_sun") return { startDay: "sun", days: 8 };
    if (normalized === "sat_to_fri") return { startDay: "sat", days: 7 };

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

    // Check URL params for direct trip code link
    const urlParams = new URLSearchParams(window.location.search);
    const urlTripCode = normalizeTripCode(urlParams.get("trip") || "");

    if (!profile && !urlTripCode) return;

    els.tripCodeInput.value = urlTripCode || normalizeTripCode((profile && profile.tripCode) || "");
    els.nameInput.value = sanitizeName((profile && profile.participantName) || "");
    els.windowStartInput.value = normalizeWindowStartDay((profile && profile.windowStartDay) || DEFAULT_WINDOW_START_DAY);
    els.windowDaysInput.value = String(normalizeWindowDays((profile && profile.windowDays) || DEFAULT_WINDOW_DAYS));
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
    if (!els.windowStartInput || !els.windowDaysInput) return;

    const startValue = normalizeWindowStartDay(state.windowConfig.startDay);
    const daysValue = normalizeWindowDays(state.windowConfig.days);
    els.windowStartInput.value = startValue;
    els.windowDaysInput.value = String(daysValue);
    els.windowStartInput.disabled = state.tripSettingsLocked;
    els.windowDaysInput.disabled = state.tripSettingsLocked;

    const toggle = els.windowConfigDetails ? els.windowConfigDetails.querySelector(".window-config-toggle") : null;

    if (state.tripSettingsLocked) {
      if (els.windowConfigDetails) els.windowConfigDetails.open = false;
      if (toggle) toggle.textContent = `Trip window locked: ${getWindowConfigSummary(state.windowConfig)}`;
      if (els.windowConfigState) els.windowConfigState.textContent = "These settings were set by the trip creator and cannot be changed.";
      return;
    }

    if (toggle) toggle.textContent = "Trip window settings (only for new trip codes)";
    if (els.windowConfigState) els.windowConfigState.textContent = "These only apply when creating a brand new trip code. Existing trips keep their saved settings.";
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

      let joinMessage = `Joined trip (${configSummary}). Live collaboration connected.`;
      if (!hasRemoteData && localSelections.some((s) => s.status === "available" || s.status === "maybe")) {
        joinMessage += " Your previous selections were restored.";
      }
      setJoinState(joinMessage, true);
      setSaveState("saved");
      setSyncState("live_ready");
      showToast("Connected. Real-time results are live.", "good");
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

  function getMonthsWithWeeks() {
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const months = [];
    const seen = new Set();
    state.weeks.forEach((week, index) => {
      const m = week.start.getMonth();
      if (!seen.has(m)) {
        seen.add(m);
        months.push({ monthIndex: m, name: MONTH_NAMES[m], firstWeekIndex: index });
      }
    });
    return months;
  }

  function getWeeksForMonth(monthIndex) {
    return state.weeks
      .map((week, index) => ({ week, index }))
      .filter(({ week }) => week.start.getMonth() === monthIndex);
  }

  function renderMonthBar() {
    const months = getMonthsWithWeeks();
    els.monthBar.innerHTML = "";

    if (state.selectedMonth === undefined || state.selectedMonth === null) {
      const now = new Date();
      const currentMonth = now.getFullYear() === YEAR ? now.getMonth() : 0;
      const hasMonth = months.some((m) => m.monthIndex === currentMonth);
      state.selectedMonth = hasMonth ? currentMonth : months[0].monthIndex;
    }

    months.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "month-btn";
      if (m.monthIndex === state.selectedMonth) btn.classList.add("month-active");

      const monthWeeks = getWeeksForMonth(m.monthIndex);
      const selectedCount = monthWeeks.filter(({ index }) =>
        state.selections[index] && state.selections[index].status !== "unselected"
      ).length;

      btn.textContent = selectedCount > 0 ? `${m.name} (${selectedCount})` : m.name;
      btn.setAttribute("aria-label", `Show ${m.name} weeks`);
      btn.addEventListener("click", () => {
        state.selectedMonth = m.monthIndex;
        renderMonthBar();
        renderWeekCards();
        updateWeekCards();
      });
      els.monthBar.appendChild(btn);
    });
  }

  function renderWeekCards() {
    els.weekGrid.innerHTML = "";
    const monthWeeks = state.selectedMonth !== null && state.selectedMonth !== undefined
      ? getWeeksForMonth(state.selectedMonth)
      : state.weeks.map((week, index) => ({ week, index }));

    monthWeeks.forEach(({ week, index }) => {
      const card = document.createElement("div");
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
        <button type="button" class="wc-row">
          <div class="wc-main">
            <span class="wc-headline">W${week.weekNumber} <span class="wc-date">${week.rangeText}</span></span>
            <span class="wc-sub">${week.weekdayRangeText} &middot; ${week.days} days</span>
          </div>
          <div class="wc-badges">
            <span class="status-pill">Unselected</span>
            <span class="rank-pill" hidden>#1</span>
          </div>
        </button>
        <div class="wc-detail" hidden>
          <div class="window-flow">
            <span class="flow-point start">From ${week.startDisplay}</span>
            <span class="flow-arrow" aria-hidden="true">&rarr;</span>
            <span class="flow-point end">To ${week.endDisplay}</span>
          </div>
          <div class="day-strip ${dayCountClass}" aria-hidden="true">${stripMarkup}</div>
        </div>
      `;

      const row = card.querySelector(".wc-row");
      row.addEventListener("click", () => toggleWeekStatus(index));
      card.addEventListener("contextmenu", (event) => showWeekContextMenu(event, index));
      let longPressTimer = null;
      let longPressFired = false;
      card.addEventListener("touchstart", (event) => {
        longPressFired = false;
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          longPressFired = true;
          const touch = event.touches[0];
          showWeekContextMenu({ preventDefault: () => {}, clientX: touch.clientX, clientY: touch.clientY }, index);
        }, 500);
      }, { passive: true });
      card.addEventListener("touchend", (event) => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        if (longPressFired) { event.preventDefault(); longPressFired = false; }
      });
      card.addEventListener("touchmove", () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
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
    cards.forEach((card) => {
      const index = Number(card.dataset.index);
      const selection = state.selections[index];
      if (!selection) return;
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
        `Week ${index + 1}. ${state.weeks[index].rangeText}. Status ${statusLabel}${selection.rank ? `. Rank ${selection.rank}` : ""}. Click to cycle.`
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

    const card = els.weekGrid.querySelector(`.week-card[data-index="${index}"]`);
    const anchor = card ? (card.querySelector(".status-pill") || card) : null;

    if (anchor) {
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let x = anchorRect.left;
      let y = anchorRect.bottom + 4;
      if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 8;
      }
      if (y + menuRect.height > window.innerHeight) {
        y = anchorRect.top - menuRect.height - 4;
      }
      menu.style.left = `${Math.max(4, x)}px`;
      menu.style.top = `${Math.max(4, y)}px`;
    } else {
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
        className: state.validation.missingRanks.length === 0 ? "ok" : "ok",
        text: state.validation.missingRanks.length === 0
          ? "Top 5 ranks completed."
          : `Ranking is optional \u2014 ${MAX_RANK - state.validation.missingRanks.length} of ${MAX_RANK} slots filled. (not required)`
      },
      {
        className: state.hasSavedOnce ? "ok" : "warn",
        text: state.hasSavedOnce ? "Submitted at least once. Results are unlocked." : "Submit your availability to unlock group results."
      },
      {
        className: state.syncState === "live_ready" ? "ok" : "warn",
        text: state.syncState === "live_ready"
          ? "Real-time group results are live."
          : state.syncState === "cloud_checking"
            ? "Connecting to group results..."
            : state.syncState === "cloud_required"
              ? "Connection required to share results with your group."
              : "Connection unavailable. Results may be outdated."
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
      els.connectionBadge.hidden = true;
      return;
    }

    if (normalizedMode === "cloud_checking") {
      els.connectionBadge.hidden = true;
      return;
    }

    els.connectionBadge.hidden = false;


    if (normalizedMode === "cloud_unavailable") {
      els.connectionBadge.classList.add("degraded");
      els.connectionBadge.textContent = "Offline";
      return;
    }

    els.connectionBadge.classList.add("required");
    els.connectionBadge.textContent = "Connection required";
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

    if (els.overlaySummary) {
      const parts = [];
      if (metrics.available) parts.push(`${metrics.available} avail`);
      if (metrics.maybe) parts.push(`${metrics.maybe} maybe`);
      parts.push(`${metrics.unselected} left`);
      els.overlaySummary.textContent = parts.join(" \u00B7 ");
    }
    syncSelectionOverlayVisibility();
  }

  function syncSelectionOverlayVisibility() {
    if (!els.selectionOverlay) return;
    const onStep2 = state.currentStep === 2;
    els.selectionOverlay.hidden = !onStep2;
  }

  function renderResultsGate() {
    const unlocked = state.hasSavedOnce;
    els.resultsLocked.hidden = unlocked;
    els.resultsSection.hidden = !unlocked;

    // Auto-collapse checklist post-submission to save scroll space
    const checklist = document.querySelector(".review-checklist");
    if (checklist && unlocked) {
      checklist.classList.add("checklist-collapsed");
    } else if (checklist) {
      checklist.classList.remove("checklist-collapsed");
    }
  }

  function computeAggregates() {
    /** @type {Participant[]} */
    const participants = state.participants.length
      ? state.participants
      : [{ id: "local", name: state.participantName || "You", submitted_at: state.hasSavedOnce ? new Date().toISOString() : null, last_active_step: state.currentStep }];

    const selectionRows = state.groupSelections.length
      ? state.groupSelections
      : state.selections.map((selection) => ({
          participant_id: participants[0].id,
          week_number: selection.weekNumber,
          status: selection.status,
          rank: selection.rank
        }));

    const participantMap = new Map();
    participants.forEach((p) => participantMap.set(p.id, p));

    const map = new Map();
    state.weeks.forEach((week) => {
      map.set(week.weekNumber, {
        weekNumber: week.weekNumber,
        availableCount: 0,
        maybeCount: 0,
        unavailableCount: 0,
        notSubmittedCount: 0,
        score: 0,
        avgRank: null,
        rankTotal: 0,
        rankCount: 0,
        people: []
      });
    });

    // Index selections by participant+week for fast lookup
    const selectionIndex = new Map();
    selectionRows.forEach((row) => {
      selectionIndex.set(`${row.participant_id}:${row.week_number}`, row);
    });

    // For each week, populate ALL participants
    map.forEach((aggregate) => {
      participants.forEach((p) => {
        const sel = selectionIndex.get(`${p.id}:${aggregate.weekNumber}`);
        const submitted = Boolean(p.submitted_at);
        const rawStatus = sel ? (STATUS_SEQUENCE.includes(sel.status) ? sel.status : "unselected") : "unselected";
        const rank = sel && sel.rank ? sel.rank : null;

        aggregate.people.push({
          id: p.id,
          name: p.name,
          status: rawStatus,
          rank,
          submitted
        });

        if (rawStatus === "available") aggregate.availableCount += 1;
        else if (rawStatus === "maybe") aggregate.maybeCount += 1;
        else if (submitted) aggregate.unavailableCount += 1;
        else aggregate.notSubmittedCount += 1;

        if (rank) {
          aggregate.rankTotal += rank;
          aggregate.rankCount += 1;
        }
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

  /**
   * Break down a week aggregate's people into submission-aware groups.
   * Only submitted participants get availability labels.
   */
  function getWeekBreakdown(entry) {
    const available = entry.people.filter((p) => p.submitted && p.status === "available");
    const maybe = entry.people.filter((p) => p.submitted && p.status === "maybe");
    const unavailable = entry.people.filter((p) => p.submitted && p.status !== "available" && p.status !== "maybe");
    const notSubmitted = entry.people.filter((p) => !p.submitted);
    return { available, maybe, unavailable, notSubmitted };
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

    // --- Narrative summary (personalized to viewer) ---
    if (els.resultsSummary) {
      const best = topWeek;
      const bestWeekData = best ? state.weeks[best.weekNumber - 1] : null;
      const bestPct = best && totalPeople > 0 ? Math.round((best.availableCount / totalPeople) * 100) : 0;
      const bestLabel = bestWeekData ? bestWeekData.rangeText : `Week ${best ? best.weekNumber : ""}`;

      if (best && best.score > 0) {
        const bk = getWeekBreakdown(best);
        const myId = state.participantId || "local";
        const myPerson = best.people.find((p) => p.id === myId);
        const myStatus = myPerson ? myPerson.status : "unselected";
        const mySubmitted = myPerson ? myPerson.submitted : false;

        let html = `<div class="admin-narrative">`;

        // Lead sentence — personalized
        html += `<p class="admin-narrative-lead">`;
        if (bestPct === 100 && submittedCount === totalPeople && totalPeople > 1) {
          html += `Everyone is available for <strong>${bestLabel}</strong>. You\u2019re all set!`;
        } else if (myStatus === "available") {
          const others = bk.available.filter((p) => p.id !== myId).length;
          if (others > 0) {
            html += `The top week is <strong>${bestLabel}</strong> \u2014 you\u2019re free, and so ${others === 1 ? "is" : "are"} <strong>${others} other${others === 1 ? "" : "s"}</strong>.`;
          } else {
            html += `The top week is <strong>${bestLabel}</strong> \u2014 you\u2019re the only one free so far.`;
          }
        } else if (myStatus === "maybe") {
          html += `The top week is <strong>${bestLabel}</strong> with <strong>${bk.available.length}</strong> available. You marked this as tentative \u2014 confirm if you can make it.`;
        } else if (mySubmitted) {
          html += `The top week is <strong>${bestLabel}</strong> with <strong>${bk.available.length}</strong> available, but <strong>you\u2019re not free</strong> this week.`;
          const myBest = aggregates.find((a) => {
            const me = a.people.find((p) => p.id === myId);
            return me && me.status === "available" && a.availableCount > 0;
          });
          if (myBest && myBest.weekNumber !== best.weekNumber) {
            const myBestWeek = state.weeks[myBest.weekNumber - 1];
            html += ` Your best overlap is <strong>${myBestWeek ? myBestWeek.rangeText : `Week ${myBest.weekNumber}`}</strong> (${myBest.availableCount} available).`;
          }
        } else {
          html += `The top week is <strong>${bestLabel}</strong> with <strong>${bk.available.length}</strong> available (${bestPct}% of submitted).`;
        }
        html += `</p>`;

        // Completeness indicator
        if (submittedCount < totalPeople) {
          html += `<p class="admin-narrative-pending">Based on <strong>${submittedCount} of ${totalPeople}</strong> submissions. Waiting on: <strong>${bk.notSubmitted.map((p) => escapeHtml(p.name)).join(", ") || participants.filter((p) => !p.submitted_at).map((p) => escapeHtml(p.name)).join(", ")}</strong>.</p>`;
        } else if (totalPeople > 1) {
          html += `<p class="admin-narrative-pending" style="color:var(--ok-text)">All ${totalPeople} participants have submitted.</p>`;
        }

        // People breakdown — submission-aware
        if (totalPeople > 1) {
          const parts = [];
          if (bk.available.length) parts.push(`<span class="wd-badge wd-badge-available">${bk.available.map((p) => escapeHtml(p.name)).join(", ")}</span> ${bk.available.length === 1 ? "is" : "are"} free`);
          if (bk.maybe.length) parts.push(`<span class="wd-badge wd-badge-maybe">${bk.maybe.map((p) => escapeHtml(p.name)).join(", ")}</span> ${bk.maybe.length === 1 ? "is" : "are"} tentative`);
          if (bk.unavailable.length) parts.push(`<span class="wd-badge wd-badge-unselected">${bk.unavailable.map((p) => escapeHtml(p.name)).join(", ")}</span> ${bk.unavailable.length === 1 ? "is" : "are"} unavailable`);
          if (bk.notSubmitted.length) parts.push(`<span class="wd-badge" style="background:var(--surface-muted);color:var(--ink-soft);border:1px solid var(--border);">${bk.notSubmitted.map((p) => escapeHtml(p.name)).join(", ")}</span> haven\u2019t submitted yet`);
          if (parts.length) {
            html += `<p class="admin-narrative-detail">${parts.join(". ")}.</p>`;
          }
        }

        html += `</div>`;
        els.resultsSummary.innerHTML = html;
      } else {
        els.resultsSummary.innerHTML = "";
      }
    }

    els.heatmap.innerHTML = "";
    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const monthGroups = new Map();
    aggregates
      .slice()
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .forEach((entry) => {
        const week = state.weeks[entry.weekNumber - 1];
        if (!week) return;
        const monthIdx = week.start.getMonth();
        if (!monthGroups.has(monthIdx)) monthGroups.set(monthIdx, []);
        monthGroups.get(monthIdx).push(entry);
      });

    for (const [monthIdx, entries] of monthGroups) {
      const hasActivity = entries.some((e) => e.availableCount > 0 || e.maybeCount > 0);
      const row = document.createElement("div");
      row.className = `hm-row${hasActivity ? "" : " hm-row-empty"}`;

      const label = document.createElement("span");
      label.className = "hm-label";
      label.textContent = MONTH_LABELS[monthIdx] || "";
      row.appendChild(label);

      const cells = document.createElement("div");
      cells.className = "hm-cells";

      entries.forEach((entry) => {
        const week = state.weeks[entry.weekNumber - 1];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "hm-cell";
        if (state.selectedDetailWeek === entry.weekNumber) btn.classList.add("active");

        const hasAvailable = entry.availableCount > 0;
        const hasMaybeOnly = !hasAvailable && entry.maybeCount > 0;
        const intensity = totalPeople > 0 ? entry.availableCount / totalPeople : 0;

        if (hasAvailable) {
          btn.style.background = heatColor(intensity);
          if (intensity >= 0.6) btn.classList.add("hm-hot");
        } else if (hasMaybeOnly) {
          btn.style.background = `color-mix(in srgb, var(--maybe) 12%, var(--surface-muted))`;
        }

        const day = week.start.getDate();
        const countLabel = entry.availableCount ? entry.availableCount : (entry.maybeCount ? `${entry.maybeCount}?` : "");
        btn.innerHTML = `<span class="hm-day">${day}</span><span class="hm-count">${countLabel || "\u00B7"}</span>`;
        btn.setAttribute(
          "aria-label",
          `${MONTH_LABELS[monthIdx]} ${day}, Week ${entry.weekNumber}. ${entry.availableCount} available, ${entry.maybeCount} maybe`
        );

        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const rect = btn.getBoundingClientRect();
          state.selectedDetailWeek = entry.weekNumber;
          persistSession();
          showHeatPopover(rect, entry, week, participants);
          renderResults();
        });

        cells.appendChild(btn);
      });

      row.appendChild(cells);
      els.heatmap.appendChild(row);
    }

    els.participantList.innerHTML = "";
    participants.forEach((participant) => {
      const li = document.createElement("li");
      const done = Boolean(participant.submitted_at);
      li.className = done ? "done" : "";
      const nameWrap = document.createElement("span");
      nameWrap.className = "participant-name";
      nameWrap.innerHTML = `${avatarHtml(participant.name)} ${escapeHtml(participant.name)}`;
      const statusSpan = document.createElement("span");
      statusSpan.textContent = done ? "Submitted" : "Not submitted";
      li.append(nameWrap, statusSpan);
      els.participantList.appendChild(li);
    });
    if (els.participantSummary) {
      els.participantSummary.textContent = `${submittedCount} of ${totalPeople} submitted`;
    }

    // Add nudge button if there are pending participants
    const pendingPeople = participants.filter((p) => !p.submitted_at);
    if (pendingPeople.length > 0 && participants.length > 1) {
      const nudge = document.createElement("div");
      nudge.className = "participant-nudge";
      const names = pendingPeople.map((p) => escapeHtml(p.name)).join(", ");
      const tripLink = `${window.location.origin}/planner.html?trip=${encodeURIComponent(state.tripCode)}`;
      const reminderText = `Hey! We\u2019re planning our trip on TripWeek \u2014 can you submit your availability? ${tripLink}`;
      nudge.innerHTML = `
        <span class="participant-nudge-text">Waiting on: <strong>${names}</strong></span>
        <button class="btn btn-sm participant-nudge-btn" type="button">Copy reminder</button>
      `;
      nudge.querySelector(".participant-nudge-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(reminderText).then(() => {
          showToast("Reminder copied to clipboard.", "good");
        }).catch(() => {
          showToast("Could not copy. Long-press to copy manually.", "warn");
        });
      });
      els.participantList.parentElement.insertBefore(nudge, els.participantList);
    }

    els.leaderboard.innerHTML = "";
    aggregates.slice(0, 5).forEach((entry, index) => {
      const week = state.weeks[entry.weekNumber - 1];
      const row = document.createElement("button");
      row.type = "button";
      row.className = "lb-row";
      if (index === 0 && entry.score > 0) row.classList.add("lb-top-pick");
      if (state.selectedDetailWeek === entry.weekNumber) row.classList.add("lb-active");
      const width = (entry.score / maxScore) * 100;
      const totalPeople = (state.participants.length || 1);
      const availPct = submittedCount > 0 ? Math.round((lbk.available.length / submittedCount) * 100) : 0;

      // Build people context for this week (submission-aware)
      const lbk = getWeekBreakdown(entry);
      const availPeople = lbk.available;
      const rankedPeople = entry.people.filter((p) => p.rank && p.submitted);
      const availNames = availPeople.map((p) => `${avatarHtml(p.name)} ${escapeHtml(p.name)}`);

      const myId = state.participantId || "local";
      const MAX_RANK_VISIBLE = 2;
      const sortedRanked = rankedPeople.slice().sort((a, b) => a.rank - b.rank);
      const rankParts = sortedRanked.slice(0, MAX_RANK_VISIBLE).map((p) =>
        p.id === myId ? `Your #${p.rank}` : `${avatarHtml(p.name)} ${escapeHtml(p.name)}\u2019s #${p.rank}`
      );
      const rankOverflow = sortedRanked.length - MAX_RANK_VISIBLE;
      if (rankOverflow > 0) rankParts.push(`+${rankOverflow} more`);
      const rankContext = rankParts.join(", ");

      row.innerHTML = `
        <div class="lb-header">
          <span class="lb-rank">#${index + 1}</span>
          <div class="lb-info">
            <span class="lb-dates">${week ? `${week.startDisplay} \u2192 ${week.endDisplay}` : ""}</span>
            <span class="lb-meta">Week ${entry.weekNumber} \u00B7 ${week ? week.days : ""} days</span>
          </div>
        </div>
        ${availNames.length ? `<div class="lb-who"><span class="lb-who-label">Available:</span> ${availNames.join(", ")}</div>` : ""}
        ${rankContext ? `<div class="lb-who lb-who-ranked"><span class="lb-who-label">Ranked:</span> ${rankContext}</div>` : ""}
        <div class="lb-stats">
          ${lbk.available.length ? `<span class="lb-stat available">${lbk.available.length} of ${submittedCount} available</span>` : ""}
          ${lbk.maybe.length ? `<span class="lb-stat maybe">${lbk.maybe.length} maybe</span>` : ""}
          ${availPct ? `<span class="lb-stat pct">${availPct}%</span>` : ""}
          ${lbk.notSubmitted.length ? `<span class="lb-stat" style="border-style:dashed">${lbk.notSubmitted.length} pending</span>` : ""}
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

  // --- Heatmap color scale (cool→warm) ---

  // Warm color scale: amber → orange → red-orange → red
  function heatColor(intensity) {
    const curved = Math.sqrt(intensity);
    if (intensity <= 0) return "var(--surface-muted)";
    if (intensity <= 0.33) {
      const pct = Math.round(15 + curved * 55);
      return `color-mix(in srgb, #f59e0b ${pct}%, var(--surface-muted))`;
    }
    if (intensity <= 0.66) {
      const pct = Math.round(20 + curved * 60);
      return `color-mix(in srgb, #ea580c ${pct}%, var(--surface-muted))`;
    }
    const pct = Math.round(30 + curved * 55);
    return `color-mix(in srgb, #dc2626 ${pct}%, var(--surface-muted))`;
  }

  // --- Heatmap popover ---

  let activeHeatDismiss = null;

  function showHeatPopover(anchorRect, entry, week) {
    const popover = document.getElementById("heatPopover");
    if (!popover) return;

    // Clean up previous dismiss listener
    if (activeHeatDismiss) {
      document.removeEventListener("click", activeHeatDismiss);
      activeHeatDismiss = null;
    }

    const bk = getWeekBreakdown(entry);

    const section = (label, people, cls) => {
      if (!people.length) return "";
      const rows = people.map((p) =>
        `<span class="hp-person">${avatarHtml(p.name)} ${escapeHtml(p.name)}${p.rank ? ` <span class="wd-person-rank">#${p.rank}</span>` : ""}</span>`
      ).join("");
      return `<div class="hp-group"><span class="hp-group-label ${cls}">${label}</span>${rows}</div>`;
    };

    popover.innerHTML = `
      <div class="hp-header">
        <strong>${week.rangeText}</strong>
        <span class="hp-meta">W${entry.weekNumber}</span>
      </div>
      ${section(`${bk.available.length} available`, bk.available, "hp-avail")}
      ${section(`${bk.maybe.length} maybe`, bk.maybe, "hp-maybe")}
      ${section(`${bk.unavailable.length} unavailable`, bk.unavailable, "hp-unavail")}
      ${section(`${bk.notSubmitted.length} pending`, bk.notSubmitted, "hp-pending")}
    `;

    // Position: show popover off-screen first to measure, then place
    popover.style.left = "0px";
    popover.style.top = "0px";
    popover.hidden = false;
    const popRect = popover.getBoundingClientRect();

    let x = anchorRect.left + anchorRect.width / 2 - popRect.width / 2;
    let y = anchorRect.bottom + 8;
    if (x + popRect.width > window.innerWidth - 8) x = window.innerWidth - popRect.width - 8;
    if (x < 8) x = 8;
    if (y + popRect.height > window.innerHeight - 8) y = anchorRect.top - popRect.height - 8;
    if (y < 8) y = 8;
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;

    activeHeatDismiss = (e) => {
      if (!popover.contains(e.target)) {
        popover.hidden = true;
        document.removeEventListener("click", activeHeatDismiss);
        activeHeatDismiss = null;
      }
    };
    setTimeout(() => document.addEventListener("click", activeHeatDismiss), 50);
  }

  function renderWeekDetail(aggregates) {
    const target = aggregates.find((entry) => entry.weekNumber === state.selectedDetailWeek);
    if (!target) {
      els.weekDetail.hidden = true;
      return;
    }
    els.weekDetail.hidden = false;

    const week = state.weeks[target.weekNumber - 1];
    const sortedPeople = target.people
      .slice()
      .sort((a, b) => {
        const weight = { available: 0, maybe: 1, unselected: 2 };
        if (weight[a.status] !== weight[b.status]) {
          return weight[a.status] - weight[b.status];
        }
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.rank) return -1;
        if (b.rank) return 1;
        return a.name.localeCompare(b.name);
      });

    const statusBadge = (person) => {
      if (!person.submitted) {
        return `<span class="wd-badge" style="background:var(--surface-muted);color:var(--ink-soft);border:1px solid var(--border);">Not submitted</span>`;
      }
      const cls = person.status === "available" ? "wd-badge-available" : person.status === "maybe" ? "wd-badge-maybe" : "wd-badge-unselected";
      const labels = { available: "Available", maybe: "Maybe", unselected: "Unavailable" };
      return `<span class="wd-badge ${cls}">${labels[person.status] || "Unavailable"}</span>`;
    };

    const rankLabel = (rank) => {
      if (!rank) return "";
      const labels = { 1: "Top pick", 2: "2nd pick", 3: "3rd pick", 4: "4th pick", 5: "5th pick" };
      return `<span class="wd-person-rank">${labels[rank] || `#${rank}`}</span>`;
    };

    const peopleRows = sortedPeople.length
      ? sortedPeople
          .map((person) =>
            `<div class="wd-person${person.rank ? " wd-person-ranked" : ""}${!person.submitted ? " wd-person-pending" : ""}">` +
              `<span class="wd-person-name">${avatarHtml(person.name)} ${escapeHtml(person.name)}</span>` +
              `<div class="wd-person-status">` +
                `${rankLabel(person.rank)}` +
                `${statusBadge(person)}` +
              `</div>` +
            `</div>`
          )
          .join("")
      : `<p class="wd-empty">No participant details yet.</p>`;

    // Build a personalized insight sentence using submission-aware breakdown
    const wbk = getWeekBreakdown(target);
    const myName = state.participantName || "";
    const myPerson = sortedPeople.find((p) => p.name === myName);
    const myStatus = myPerson ? myPerson.status : "unselected";
    const mySubmitted = myPerson ? myPerson.submitted : false;
    const myRank = myPerson ? myPerson.rank : null;
    const otherAvail = wbk.available.filter((p) => p.name !== myName);
    const maybeNames = wbk.maybe.map((p) => escapeHtml(p.name));
    const rankedHere = sortedPeople.filter((p) => p.rank);

    let insight = "";
    if (target.people.length > 1) {
      // Your status first
      if (myStatus === "available") {
        insight = `You\u2019re free this week.`;
        if (otherAvail.length) {
          insight += ` So ${otherAvail.length === 1 ? "is" : "are"} <strong>${otherAvail.map((p) => escapeHtml(p.name)).join("</strong> and <strong>")}</strong>.`;
        } else {
          insight += ` No one else is available yet.`;
        }
      } else if (myStatus === "maybe") {
        insight = `You marked this as tentative.`;
        if (otherAvail.length) {
          insight += ` <strong>${otherAvail.map((p) => escapeHtml(p.name)).join("</strong> and <strong>")}</strong> ${otherAvail.length === 1 ? "is" : "are"} free.`;
        }
      } else if (!mySubmitted) {
        insight = `You haven\u2019t submitted yet.`;
        if (wbk.available.length) {
          insight += ` <strong>${wbk.available.map((p) => escapeHtml(p.name)).join("</strong> and <strong>")}</strong> ${wbk.available.length === 1 ? "is" : "are"} free.`;
        }
      } else {
        insight = `You\u2019re not available this week.`;
        if (wbk.available.length) {
          insight += ` <strong>${wbk.available.map((p) => escapeHtml(p.name)).join("</strong> and <strong>")}</strong> ${wbk.available.length === 1 ? "is" : "are"} free without you.`;
        }
      }
      if (maybeNames.length) {
        insight += ` ${maybeNames.join(" and ")} might work.`;
      }
      if (myRank) {
        const rankLabels = { 1: "your top pick", 2: "your 2nd pick", 3: "your 3rd pick", 4: "your 4th pick", 5: "your 5th pick" };
        insight += ` This is ${rankLabels[myRank] || `your #${myRank}`}.`;
      }
      const otherRanked = rankedHere.filter((p) => p.name !== myName);
      if (otherRanked.length) {
        const bits = otherRanked.sort((a, b) => a.rank - b.rank).map((p) => `${escapeHtml(p.name)} ranked it #${p.rank}`);
        insight += ` ${bits.join("; ")}.`;
      }
    }

    els.weekDetail.innerHTML = `
      <div class="wd-header">
        <strong>Week ${target.weekNumber}</strong>
        <span class="wd-dates">${week ? week.rangeText : ""}</span>
      </div>
      <div class="wd-summary">
        <span class="lb-stat available">${wbk.available.length} available</span>
        <span class="lb-stat maybe">${wbk.maybe.length} maybe</span>
        <span class="lb-stat">${wbk.unavailable.length} unavailable</span>
        ${wbk.notSubmitted.length ? `<span class="lb-stat" style="border-style:dashed">${wbk.notSubmitted.length} pending</span>` : ""}
      </div>
      ${insight ? `<p class="wd-insight">${insight}</p>` : ""}
      <div class="wd-people">${peopleRows}</div>
    `;
  }

  function renderAll() {
    updateValidation();
    renderWindowConfigControls();
    renderStepper();
    renderPanels();
    renderCounts();
    renderMonthBar();
    renderWeekCards();
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
