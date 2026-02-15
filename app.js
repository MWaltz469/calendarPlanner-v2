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

  /* Tailwind class constants — avoids repeating long utility strings */
  const TW = {
    /* Buttons */
    btn: "inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] font-bold cursor-pointer dark:bg-[#1a2b3b] dark:border-[#34506a] dark:text-[#d7e6f2] disabled:opacity-55 disabled:cursor-not-allowed",
    btnPrimary: "inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-full border border-transparent bg-[var(--accent)] text-white font-bold cursor-pointer hover:bg-[var(--accent-strong)] disabled:opacity-55 disabled:cursor-not-allowed",
    btnDanger: "inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-full border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] font-bold cursor-pointer",
    btnSm: "inline-flex items-center justify-center min-h-[36px] px-3 py-1 text-sm rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] font-bold cursor-pointer dark:bg-[#1a2b3b] dark:border-[#34506a] dark:text-[#d7e6f2]",
    btnDangerSm: "inline-flex items-center justify-center min-h-[36px] px-3 py-1 text-sm rounded-full border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] font-bold cursor-pointer",
    /* Week card */
    weekCard: "border-none border-l-4 border-l-transparent rounded-xl bg-[var(--surface)] shadow-sm min-w-0 overflow-hidden select-none",
    wcRow: "flex items-center gap-3 w-full border-none bg-transparent px-4 py-3 text-left cursor-pointer min-h-[56px]",
    wcRowCompact: "flex items-center gap-3 w-full border-none bg-transparent px-4 py-2 text-left cursor-pointer min-h-[44px]",
    wcMain: "flex-1 min-w-0 grid gap-0.5",
    wcHeadline: "font-extrabold text-[0.9375rem] text-[var(--ink)] leading-tight",
    wcDate: "font-semibold text-[var(--ink-soft)]",
    wcSub: "text-[0.6875rem] font-semibold text-[var(--ink-soft)]",
    wcBadges: "flex gap-1 items-center shrink-0",
    wcDetail: "hidden px-4 py-2 pb-3 border-t border-[var(--border)] grid gap-2",
    /* Status pills */
    statusPill: "self-start rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)] uppercase tracking-wide text-[0.68rem] font-extrabold px-2 py-0.5",
    statusAvailable: "bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]",
    statusMaybe: "bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]",
    rankPill: "self-start rounded-full bg-[var(--accent)] border border-[var(--accent)] text-white uppercase tracking-wide text-[0.68rem] font-extrabold px-2 py-0.5",
    /* Week card state borders */
    wcBorderAvailable: "border-l-[var(--available)]",
    wcBorderMaybe: "border-l-[var(--maybe)]",
    wcBorderUnselected: "border-l-transparent opacity-70",
    /* Flow points */
    flowPoint: "rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[0.7rem] font-extrabold text-[var(--ink-soft)] flex items-center",
    flowStart: "bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info-text)]",
    flowEnd: "bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]",
    flowArrow: "text-[var(--ink-soft)] font-extrabold text-[0.84rem]",
    /* Day strip */
    daySpan: "border border-[var(--border)] rounded-[10px] bg-[var(--surface-muted)] text-[var(--ink-soft)] text-[clamp(0.66rem,1.7vw,0.74rem)] font-extrabold leading-none tracking-tight text-center min-h-[1.78rem] min-w-0 p-[0.3rem_0.1rem] whitespace-nowrap grid place-items-center",
    dayStart: "bg-[var(--info-bg)] border-[var(--info-border)] text-[var(--info-text)]",
    dayEnd: "bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]",
    /* Month button */
    monthBtn: "border border-[var(--border)] rounded-full bg-[var(--surface-muted)] text-[var(--ink-soft)] text-[0.74rem] font-bold px-2.5 py-1 cursor-pointer min-h-[34px] dark:bg-[#1a2b3b] dark:border-[#34506a] dark:text-[#b6c7d5]",
    monthActive: "bg-[var(--accent)] border-[var(--accent)] text-white dark:bg-[var(--accent)] dark:border-[var(--accent)] dark:text-white",
    /* Overlay items */
    overlayItem: "border border-[var(--border)] rounded-[10px] bg-[var(--surface-muted)] p-[0.3rem_0.42rem] grid gap-[0.05rem]",
    overlayAvailable: "border-[var(--ok-border)] bg-[var(--ok-bg)]",
    overlayMaybe: "border-[var(--warn-border)] bg-[var(--warn-bg)]",
    overlaySelected: "border-[var(--accent-border)] bg-[var(--accent-bg)]",
    overlayUnselected: "border-[var(--neutral-border)] bg-[var(--neutral-bg)]",
    overlayLabel: "uppercase tracking-wide text-[0.67rem] text-[var(--ink-soft)] font-bold",
    overlayValue: "font-display text-[0.94rem] text-[var(--ink)]",
    /* Overlay nav */
    ovNavBtn: "min-w-[44px] h-[44px] rounded-lg border-none bg-[var(--surface-muted)] text-[var(--ink-soft)] font-bold cursor-pointer inline-grid grid-cols-[auto_auto] items-center justify-center gap-1 px-2",
    ovNavPrimary: "bg-[var(--accent)] text-white",
    /* Rank system */
    rankChip: "w-[46px] h-[46px] rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--accent-border)] inline-grid place-items-center font-display font-bold",
    rankSelect: "w-full min-h-[46px] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--ink)] py-2.5 px-3 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2",
    rankFilled: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]",
    /* Checklist */
    checklistItem: "border-none rounded-lg bg-[var(--surface)] p-3 text-sm text-[var(--ink)] flex items-center gap-3",
    checklistIcon: "w-6 h-6 rounded-full inline-grid place-items-center text-[0.72rem] font-extrabold shrink-0 bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
    checklistOk: "bg-[var(--available)] text-white",
    checklistWarn: "bg-[var(--maybe)] text-white",
    checklistInfo: "bg-[var(--info-text)] text-white",
    checklistItemOk: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]",
    checklistItemWarn: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
    checklistItemInfo: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]",
    /* Results */
    resultsCard: "border-none rounded-xl bg-[var(--surface)] shadow-sm p-4 grid gap-4",
    resultsH3: "m-0 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-[var(--ink-soft)] pb-2 border-b border-[var(--border)]",
    resultsSubtitle: "font-body text-[0.6875rem] font-semibold text-[var(--ink-soft)] normal-case tracking-normal ml-2",
    /* Score chips */
    scoreChip: "border border-[var(--border)] rounded-xl bg-[var(--surface)] p-3 px-4 grid gap-0.5 relative overflow-hidden",
    scoreChipBar: "absolute top-0 left-0 right-0 h-[3px] bg-[var(--accent)] opacity-40",
    scoreLabel: "uppercase tracking-[0.06em] text-[0.6875rem] text-[var(--ink-soft)] font-bold",
    scoreValue: "font-display text-[clamp(1rem,2.5vw,1.3rem)] font-extrabold text-[var(--ink)]",
    scoreSub: "text-[0.6875rem] font-semibold text-[var(--ink-soft)] normal-case tracking-normal",
    /* Leaderboard */
    lbItem: "grid border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)]",
    lbItemOpen: "border-[var(--accent-border)]",
    lbRow: "border-none rounded-none p-3 bg-[var(--surface)] grid gap-2 cursor-pointer text-left w-full",
    lbRowTopPick: "border-l-[var(--available)] bg-[var(--ok-bg)]",
    lbHeader: "flex items-center gap-[0.45rem]",
    lbRank: "w-8 h-8 rounded-lg bg-[var(--accent-bg)] text-[var(--accent-text)] border border-[var(--accent-border)] inline-grid place-items-center font-display font-bold text-[0.78rem] shrink-0",
    lbRankTop: "bg-[var(--accent)] border-[var(--accent)] text-white",
    lbInfo: "grid gap-[0.08rem] min-w-0",
    lbDates: "font-bold text-sm text-[var(--ink)]",
    lbMeta: "text-[0.6875rem] font-semibold text-[var(--ink-soft)]",
    lbStats: "flex flex-wrap gap-[0.32rem]",
    lbStat: "rounded-full py-[0.15rem] px-[0.42rem] text-[0.68rem] font-bold border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-soft)]",
    lbStatAvail: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok-text)]",
    lbStatMaybe: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn-text)]",
    lbBar: "h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden",
    lbBarFill: "block h-full rounded-full bg-gradient-to-r from-[var(--available)] to-[var(--accent)]",
    lbChevron: "text-[0.55rem] text-[var(--ink-soft)] ml-auto shrink-0 transition-transform duration-200",
    lbWho: "text-[0.6875rem] text-[var(--ink-soft)] leading-[1.8] flex flex-wrap items-center gap-1",
    lbWhoLabel: "font-extrabold text-[var(--ink-soft)]",
    lbWhoRanked: "text-[var(--accent-text)]",
    lbDetail: "grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-in-out",
    lbDetailOpen: "grid-rows-[1fr]",
    lbDetailInner: "overflow-hidden px-3 py-0 opacity-0 transition-all duration-200 border-t border-[var(--border)]",
    lbDetailInnerOpen: "py-3 pb-4 opacity-100",
    /* Heatmap */
    hmRow: "flex items-center gap-2",
    hmLabel: "w-8 shrink-0 text-[0.6875rem] font-extrabold uppercase tracking-wide text-[var(--ink-soft)] text-right",
    hmCells: "flex gap-[3px] flex-1",
    hmCell: "flex-1 border-2 border-transparent rounded-md min-h-[42px] bg-[var(--surface-muted)] text-[var(--ink)] font-extrabold cursor-pointer grid place-items-center leading-tight text-center p-0.5 transition-shadow duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(15,118,110,0.28)] focus-visible:outline-offset-2",
    hmCellActive: "border-[var(--accent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_40%,transparent)]",
    hmDay: "text-sm font-extrabold",
    hmCount: "text-[0.6rem] opacity-65",
    /* Heatmap popover */
    heatPopover: "fixed z-30 border border-[var(--border)] rounded-xl bg-[var(--surface)] shadow-lg p-3 min-w-[180px] max-w-[280px] grid gap-2",
    hpHeader: "grid gap-0.5",
    hpMeta: "text-[0.6875rem] text-[var(--ink-soft)]",
    hpGroup: "grid gap-1",
    hpGroupLabel: "text-[0.6875rem] font-extrabold uppercase tracking-[0.06em]",
    hpPerson: "flex items-center gap-1 text-sm font-semibold py-1",
    /* Week detail */
    weekDetail: "border border-[var(--border)] border-l-[3px] border-l-[var(--accent)] rounded-xl bg-[var(--surface)] p-4 text-sm text-[var(--ink)] min-h-[78px] grid gap-2",
    wdHeader: "flex items-baseline gap-2 flex-wrap",
    wdHeaderStrong: "font-display text-[0.9375rem] font-extrabold",
    wdDates: "text-[0.6875rem] font-semibold text-[var(--ink-soft)]",
    wdSummary: "flex flex-wrap gap-[0.28rem]",
    wdPeople: "grid gap-[0.22rem]",
    wdPerson: "flex items-center gap-[0.35rem] p-[0.28rem_0.38rem] border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[0.78rem]",
    wdPersonName: "font-bold flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
    wdPersonStatus: "flex items-center gap-1 shrink-0",
    wdPersonRank: "font-extrabold text-[0.6875rem] text-[var(--accent)] bg-[var(--accent-bg)] border border-[var(--accent-border)] py-[0.1rem] px-[0.35rem] rounded-full",
    wdBadge: "rounded-full py-[0.1rem] px-[0.36rem] text-[0.65rem] font-bold uppercase tracking-[0.03em] shrink-0",
    wdBadgeAvail: "bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]",
    wdBadgeMaybe: "bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]",
    wdBadgeUnsel: "bg-[var(--neutral-bg)] text-[var(--neutral-text)] border border-[var(--neutral-border)]",
    wdBadgePending: "bg-[var(--surface-muted)] text-[var(--ink-soft)] border border-dashed border-[var(--border)]",
    wdInsight: "m-0 text-sm text-[var(--ink)] leading-relaxed italic p-2 px-3 bg-[var(--accent-bg)] rounded-lg border-l-[3px] border-l-[var(--accent)]",
    wdEmpty: "text-[0.8rem] text-[var(--ink-soft)] italic",
    /* Participants */
    participantList: "list-none m-0 p-0 grid gap-2",
    participantItem: "border border-[var(--border)] border-l-[3px] border-l-[var(--neutral-border)] rounded-lg bg-[var(--surface)] py-2 px-3 text-sm font-semibold flex justify-between items-center gap-2 min-h-[44px]",
    participantDone: "border-l-[var(--available)]",
    participantStatus: "text-[0.6875rem] font-bold uppercase tracking-wide py-1 px-2 rounded-full bg-[var(--neutral-bg)] text-[var(--neutral-text)]",
    participantDoneStatus: "bg-[var(--ok-bg)] text-[var(--ok-text)]",
    participantNudge: "flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-[var(--warn-bg)] border border-[var(--warn-border)] mb-2 flex-wrap",
    participantNudgeText: "text-sm text-[var(--warn-text)]",
    /* Narrative */
    narrative: "rounded-xl bg-[var(--surface-muted)] p-4 grid gap-2 mb-3",
    narrativeLead: "m-0 text-[0.9375rem] font-semibold text-[var(--ink)] leading-normal",
    narrativeDetail: "m-0 text-sm text-[var(--ink)] leading-relaxed",
    narrativePending: "m-0 text-sm text-[var(--ink-soft)] italic",
    /* Context menu */
    ctxMenu: "fixed z-[25] border border-[var(--border)] rounded-lg bg-[var(--surface)] shadow-[0_10px_24px_rgba(0,0,0,0.18)] p-[0.3rem] grid gap-[0.15rem] min-w-[140px]",
    ctxBtn: "border-none rounded-lg bg-transparent text-[var(--ink)] text-sm font-bold p-3 px-4 min-h-[44px] text-left cursor-pointer hover:bg-[var(--accent-bg)] hover:text-[var(--accent-text)]",
    /* Toast */
    toast: "rounded-xl py-2 px-3 text-white bg-[var(--ink)] text-[0.81rem] shadow-[0_10px_24px_rgba(0,0,0,0.2)]",
    toastGood: "bg-[var(--ok-text)]",
    toastWarn: "bg-[var(--warn-text)]",
  };

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
    return `<span class="inline-grid place-items-center w-[1.4rem] h-[1.4rem] rounded-full text-white font-display text-[0.65rem] font-extrabold leading-none shrink-0" style="background:${bg}">${escapeHtml(initial)}</span>`;
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

    // Auto-expand disclosures on first visit per step
    autoExpandFirstVisit(next);

    const targetPanel = els.panels[next];
    if (targetPanel) {
      targetPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function autoExpandFirstVisit(step) {
    const key = `${STORAGE_PREFIX}:visited_step_${step}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch { return; }

    if (step === 3) {
      const el = document.getElementById("rankingExplainer");
      if (el && !el.open) el.open = true;
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
      btn.className = TW.monthBtn + (m.monthIndex === state.selectedMonth ? " " + TW.monthActive : "");

      const monthWeeks = getWeeksForMonth(m.monthIndex);
      const selectedCount = monthWeeks.filter(({ index }) =>
        state.selections[index] && state.selections[index].status !== "unselected"
      ).length;

      btn.textContent = selectedCount > 0 ? `${m.name} (${selectedCount})` : m.name;
      btn.setAttribute("aria-label", `${m.name}: ${selectedCount} week${selectedCount !== 1 ? "s" : ""} selected`);
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
      card.className = TW.weekCard;
      card.dataset.index = String(index);
      card.setAttribute("role", "listitem");

      const stripMarkup = week.dayTokens
        .map((token, tokenIndex) => {
          let cls = TW.daySpan;
          if (tokenIndex === 0) cls += " " + TW.dayStart;
          if (tokenIndex === week.dayTokens.length - 1) cls += " " + TW.dayEnd;
          return `<span class="${cls}">${token.label.slice(0, 2)}</span>`;
        })
        .join("");
      const dayCols = week.dayTokens.length >= 8 ? "grid-cols-5" : "grid-cols-4";

      card.innerHTML = `
        <button type="button" class="${TW.wcRow}">
          <div class="${TW.wcMain}">
            <span class="${TW.wcHeadline}">W${week.weekNumber} <span class="${TW.wcDate}">${week.rangeText}</span></span>
            <span class="${TW.wcSub}">${week.weekdayRangeText} &middot; ${week.days} days</span>
          </div>
          <div class="${TW.wcBadges}">
            <span class="status-pill ${TW.statusPill}">Unselected</span>
            <span class="rank-pill ${TW.rankPill}" hidden>#1</span>
          </div>
        </button>
        <div class="${TW.wcDetail}" hidden>
          <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-[0.3rem]">
            <span class="${TW.flowPoint} ${TW.flowStart}">From ${week.startDisplay}</span>
            <span class="${TW.flowArrow}" aria-hidden="true">&rarr;</span>
            <span class="${TW.flowPoint} ${TW.flowEnd}">To ${week.endDisplay}</span>
          </div>
          <div class="grid ${dayCols} auto-rows-[minmax(1.78rem,auto)] gap-[0.26rem] w-full min-w-0 content-start" aria-hidden="true">${stripMarkup}</div>
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
    const cards = els.weekGrid.querySelectorAll("[data-index]");
    cards.forEach((card) => {
      const index = Number(card.dataset.index);
      const selection = state.selections[index];
      if (!selection) return;
      const status = selection.status;

      /* Reset card border + opacity */
      card.classList.remove("border-l-[var(--available)]", "border-l-[var(--maybe)]", "border-l-transparent", "opacity-70");
      if (status === "available") card.classList.add("border-l-[var(--available)]");
      else if (status === "maybe") card.classList.add("border-l-[var(--maybe)]");
      else { card.classList.add("border-l-transparent", "opacity-70"); }

      /* Compact row for unselected */
      const row = card.querySelector("button");
      if (row) {
        row.className = status === "unselected" ? TW.wcRow.replace("py-3", "py-2").replace("min-h-[56px]", "min-h-[44px]") : TW.wcRow;
      }

      const statusPill = card.querySelector(".status-pill");
      const rankPill = card.querySelector(".rank-pill");

      const statusLabel = status === "available" ? "Available" : status === "maybe" ? "Maybe" : "Unselected";
      /* Reset and apply status pill styling */
      statusPill.className = "status-pill " + TW.statusPill;
      if (status === "available") statusPill.classList.add(...TW.statusAvailable.split(" "));
      else if (status === "maybe") statusPill.classList.add(...TW.statusMaybe.split(" "));
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

  let longPressHintShown = false;

  function toggleWeekStatus(index) {
    if (!longPressHintShown) {
      try {
        const key = `${STORAGE_PREFIX}:longpress_hint`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, "1");
          const isTouch = "ontouchstart" in window;
          showToast(isTouch ? "Tip: Long-press a card for a quick status menu." : "Tip: Right-click a card for a quick status menu.", "");
        }
        longPressHintShown = true;
      } catch { longPressHintShown = true; }
    }

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
      row.className = "grid grid-cols-[auto_1fr] items-center gap-2";

      const chip = document.createElement("span");
      chip.className = TW.rankChip;
      chip.textContent = `#${rank}`;

      const select = document.createElement("select");
      select.className = TW.rankSelect;
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
      /* Toggle filled styling */
      TW.rankFilled.split(" ").forEach(c => select.classList.toggle(c, Boolean(currentWeek)));
    });

    const missing = state.validation.missingRanks;
    const unrankedWeeks = state.weeks.filter((_, i) => state.selections[i].status === "available" && !state.selections[i].rank);
    if (missing.length && unrankedWeeks.length) {
      els.rankNote.textContent = `Open slots: ${missing.map((item) => `#${item}`).join(", ")} \u2014 ${unrankedWeeks.length} available week${unrankedWeeks.length !== 1 ? "s" : ""} not yet ranked.`;
    } else if (missing.length) {
      els.rankNote.textContent = `Open slots: ${missing.map((item) => `#${item}`).join(", ")}`;
    } else {
      els.rankNote.textContent = "All rank slots filled.";
    }
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
      const itemStyle = item.className === "ok" ? TW.checklistItemOk : item.className === "info" ? TW.checklistItemInfo : TW.checklistItemWarn;
      li.className = TW.checklistItem + " " + itemStyle;
      const iconStyle = item.className === "ok" ? TW.checklistOk : item.className === "info" ? TW.checklistInfo : TW.checklistWarn;
      const icon = item.className === "ok" ? "\u2713" : item.className === "info" ? "\u2014" : "\u25CB";
      li.innerHTML = `<span class="${TW.checklistIcon} ${iconStyle}">${icon}</span><span>${item.text}</span>`;
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
          setSyncState("live_ready");
          const now = new Date();
          setJoinState(`Live update received at ${now.toLocaleTimeString()}.`, true);
        } catch (error) {
          console.error(error);
          setSyncState("cloud_unavailable");
        }
        try {
          // Don't rebuild leaderboard DOM if user has an accordion open
          const hasOpenAccordion = els.leaderboard && els.leaderboard.querySelector(".lb-item-open");
          if (!hasOpenAccordion) {
            renderResults();
          }
        } catch (renderErr) { console.error("Render error:", renderErr); } finally {
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

  const HINT_COLORS = { positive: "text-[var(--ok-text)]", error: "text-[var(--danger)]", muted: "text-[var(--ink-soft)]" };
  function clearHintColor(el) { Object.values(HINT_COLORS).forEach((c) => el.classList.remove(c)); }

  function setJoinState(message, positive) {
    els.joinState.textContent = message;
    clearHintColor(els.joinState);
    els.joinState.classList.add(positive ? HINT_COLORS.positive : HINT_COLORS.muted);
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
    clearHintColor(els.saveState);
    if (mode === "saved") {
      els.saveState.classList.add(HINT_COLORS.positive);
    } else if (mode === "error") {
      els.saveState.classList.add(HINT_COLORS.error);
    } else {
      els.saveState.classList.add(HINT_COLORS.muted);
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

    /* Reset badge to base styling */
    els.connectionBadge.className = "inline-flex items-center min-h-[36px] rounded-full border text-sm font-bold px-3 whitespace-nowrap";

    if (normalizedMode === "live_ready" || normalizedMode === "cloud_checking") {
      els.connectionBadge.hidden = true;
      return;
    }

    els.connectionBadge.hidden = false;

    if (normalizedMode === "cloud_unavailable") {
      els.connectionBadge.classList.add("bg-[var(--warn-bg)]", "border-[var(--warn-border)]", "text-[var(--warn-text)]");
      els.connectionBadge.textContent = "Offline";
      return;
    }

    els.connectionBadge.classList.add("bg-[var(--surface-muted)]", "border-[var(--border)]", "text-[var(--ink-soft)]");
    els.connectionBadge.textContent = "Connection required";
  }

  /* Stepper state — Tailwind class sets for active/complete/default */
  const STEPPER_STATES = {
    defaultBtn: ["bg-[var(--surface-muted)]", "text-[var(--ink-soft)]"],
    activeBtn: ["bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]", "text-[var(--accent)]"],
    completeBtn: ["bg-[var(--ok-bg)]", "text-[var(--ok-text)]"],
    defaultNum: ["bg-[var(--surface)]", "text-[var(--ink-soft)]"],
    activeNum: ["bg-[var(--accent)]", "text-white"],
    completeNum: ["bg-[var(--available)]", "text-white"],
  };
  const ALL_STEPPER_BTN = [...STEPPER_STATES.defaultBtn, ...STEPPER_STATES.activeBtn, ...STEPPER_STATES.completeBtn];
  const ALL_STEPPER_NUM = [...STEPPER_STATES.defaultNum, ...STEPPER_STATES.activeNum, ...STEPPER_STATES.completeNum];

  function renderStepper() {
    const items = els.stepper.querySelectorAll("li");
    items.forEach((item) => {
      const button = item.querySelector(".stepper-btn");
      if (!button) return;
      const num = button.querySelector(".stepper-num");
      const step = Number(button.dataset.step);
      const isActive = step === state.currentStep;
      const isComplete = step < state.currentStep && state.isJoined;

      button.classList.remove(...ALL_STEPPER_BTN);
      if (num) num.classList.remove(...ALL_STEPPER_NUM);

      if (isActive) {
        button.classList.add(...STEPPER_STATES.activeBtn);
        if (num) num.classList.add(...STEPPER_STATES.activeNum);
      } else if (isComplete) {
        button.classList.add(...STEPPER_STATES.completeBtn);
        if (num) num.classList.add(...STEPPER_STATES.completeNum);
      } else {
        button.classList.add(...STEPPER_STATES.defaultBtn);
        if (num) num.classList.add(...STEPPER_STATES.defaultNum);
      }

      button.disabled = !state.isJoined && step > 1;
      button.setAttribute("aria-current", isActive ? "step" : "false");
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

    // Auto-collapse checklist post-submission (user can re-expand)
    const checklist = document.getElementById("checklistDetails");
    if (checklist && unlocked) {
      checklist.open = false;
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
      item.className = TW.scoreChip;
      item.innerHTML = `<span class="${TW.scoreChipBar}"></span><span class="${TW.scoreLabel}">${card.label}</span><strong class="${TW.scoreValue}">${card.value}</strong>${card.sub ? `<span class="${TW.scoreSub}">${card.sub}</span>` : ""}`;
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

        let html = `<div class="${TW.narrative}">`;

        // Lead sentence — personalized
        html += `<p class="${TW.narrativeLead}">`;
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
          html += `<p class="${TW.narrativePending}">Based on <strong>${submittedCount} of ${totalPeople}</strong> submissions. Waiting on: <strong>${bk.notSubmitted.map((p) => escapeHtml(p.name)).join(", ") || participants.filter((p) => !p.submitted_at).map((p) => escapeHtml(p.name)).join(", ")}</strong>.</p>`;
        } else if (totalPeople > 1) {
          html += `<p class="${TW.narrativePending}" style="color:var(--ok-text)">All ${totalPeople} participants have submitted.</p>`;
        }

        // People breakdown — submission-aware
        if (totalPeople > 1) {
          const parts = [];
          if (bk.available.length) parts.push(`${bk.available.map((p) => `<span class="${TW.wdBadge} ${TW.wdBadgeAvail}">${escapeHtml(p.name)}</span>`).join(" ")} ${bk.available.length === 1 ? "is" : "are"} free`);
          if (bk.maybe.length) parts.push(`${bk.maybe.map((p) => `<span class="${TW.wdBadge} ${TW.wdBadgeMaybe}">${escapeHtml(p.name)}</span>`).join(" ")} ${bk.maybe.length === 1 ? "is" : "are"} tentative`);
          if (bk.unavailable.length) parts.push(`${bk.unavailable.map((p) => `<span class="${TW.wdBadge} ${TW.wdBadgeUnsel}">${escapeHtml(p.name)}</span>`).join(" ")} ${bk.unavailable.length === 1 ? "is" : "are"} unavailable`);
          if (bk.notSubmitted.length) parts.push(`${bk.notSubmitted.map((p) => `<span class="${TW.wdBadge} ${TW.wdBadgePending}">${escapeHtml(p.name)}</span>`).join(" ")} haven\u2019t submitted yet`);
          if (parts.length) {
            html += `<p class="${TW.narrativeDetail}">${parts.join(". ")}.</p>`;
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
      row.className = TW.hmRow + (hasActivity ? "" : " opacity-40");

      const label = document.createElement("span");
      label.className = TW.hmLabel;
      label.textContent = MONTH_LABELS[monthIdx] || "";
      row.appendChild(label);

      const cells = document.createElement("div");
      cells.className = TW.hmCells;

      entries.forEach((entry) => {
        const week = state.weeks[entry.weekNumber - 1];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = TW.hmCell;
        if (state.selectedDetailWeek === entry.weekNumber) btn.classList.add(...TW.hmCellActive.split(" "));

        const hasAvailable = entry.availableCount > 0;
        const hasMaybeOnly = !hasAvailable && entry.maybeCount > 0;
        const intensity = totalPeople > 0 ? entry.availableCount / totalPeople : 0;

        if (hasAvailable) {
          btn.style.background = heatColor(intensity);
          if (intensity >= 0.6) btn.classList.add("text-white");
        } else if (hasMaybeOnly) {
          btn.style.background = `color-mix(in srgb, var(--maybe) 12%, var(--surface-muted))`;
        }
        if (!hasActivity) btn.classList.add("min-h-[28px]");

        const day = week.start.getDate();
        const countLabel = entry.availableCount ? entry.availableCount : (entry.maybeCount ? `${entry.maybeCount}?` : "");
        btn.innerHTML = `<span class="${TW.hmDay}">${day}</span><span class="${TW.hmCount}">${countLabel || "\u00B7"}</span>`;
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
      li.className = TW.participantItem + (done ? " " + TW.participantDone : "");
      const nameWrap = document.createElement("span");
      nameWrap.className = "flex items-center gap-2";
      nameWrap.innerHTML = `${avatarHtml(participant.name)} ${escapeHtml(participant.name)}`;
      const statusSpan = document.createElement("span");
      statusSpan.className = TW.participantStatus + (done ? " " + TW.participantDoneStatus : "");
      statusSpan.textContent = done ? "Submitted" : "Not submitted";
      li.append(nameWrap, statusSpan);
      els.participantList.appendChild(li);
    });
    if (els.participantSummary) {
      els.participantSummary.textContent = `${submittedCount} of ${totalPeople} submitted`;
    }

    // Add nudge button if there are pending participants (clear previous first)
    const existingNudges = els.participantList.parentElement.querySelectorAll(".participant-nudge");
    existingNudges.forEach((n) => n.remove());
    const pendingPeople = participants.filter((p) => !p.submitted_at);
    if (pendingPeople.length > 0 && participants.length > 1) {
      const nudge = document.createElement("div");
      nudge.className = TW.participantNudge;
      const names = pendingPeople.map((p) => escapeHtml(p.name)).join(", ");
      const tripLink = `${window.location.origin}/planner.html?trip=${encodeURIComponent(state.tripCode)}`;
      const reminderText = `Hey! We\u2019re planning our trip on TripWeek \u2014 can you submit your availability? ${tripLink}`;
      nudge.innerHTML = `
        <span class="${TW.participantNudgeText}">Waiting on: <strong>${names}</strong></span>
        <button class="${TW.btnSm} participant-nudge-btn" type="button">Copy reminder</button>
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
      const wrapper = document.createElement("div");
      wrapper.className = TW.lbItem;

      const row = document.createElement("button");
      row.type = "button";
      row.className = TW.lbRow;
      if (index === 0 && entry.score > 0) row.classList.add(...TW.lbRowTopPick.split(" "));
      /* rows start closed — toggled by click */
      const width = (entry.score / maxScore) * 100;
      const totalPeople = (state.participants.length || 1);

      // Build people context for this week (submission-aware)
      const lbk = getWeekBreakdown(entry);
      const availPct = submittedCount > 0 ? Math.round((lbk.available.length / submittedCount) * 100) : 0;
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

      const isTop = index === 0 && entry.score > 0;
      row.innerHTML = `
        <div class="${TW.lbHeader}">
          <span class="${TW.lbRank}${isTop ? " " + TW.lbRankTop : ""}">#${index + 1}</span>
          <div class="${TW.lbInfo}">
            <span class="${TW.lbDates}">${week ? `${week.startDisplay} \u2192 ${week.endDisplay}` : ""}</span>
            <span class="${TW.lbMeta}">Week ${entry.weekNumber} \u00B7 ${week ? week.days : ""} days</span>
          </div>
          <span class="${TW.lbChevron}">\u25BE</span>
        </div>
        ${availNames.length ? `<div class="${TW.lbWho}"><span class="${TW.lbWhoLabel}">Available:</span> ${availNames.join(", ")}</div>` : ""}
        ${rankContext ? `<div class="${TW.lbWho} ${TW.lbWhoRanked}"><span class="${TW.lbWhoLabel}">Ranked:</span> ${rankContext}</div>` : ""}
        <div class="${TW.lbStats}">
          ${lbk.available.length ? `<span class="${TW.lbStat} ${TW.lbStatAvail}">${lbk.available.length} of ${submittedCount} available</span>` : ""}
          ${lbk.maybe.length ? `<span class="${TW.lbStat} ${TW.lbStatMaybe}">${lbk.maybe.length} maybe</span>` : ""}
          ${availPct ? `<span class="${TW.lbStat}">${availPct}%</span>` : ""}
          ${lbk.notSubmitted.length ? `<span class="${TW.lbStat}" style="border-style:dashed">${lbk.notSubmitted.length} pending</span>` : ""}
        </div>
        <div class="${TW.lbBar}"><span class="${TW.lbBarFill}" style="width:${width.toFixed(1)}%"></span></div>
      `;

      // Inline detail panel
      const detail = document.createElement("div");
      detail.className = TW.lbDetail;
      const detailInner = document.createElement("div");
      detailInner.className = TW.lbDetailInner;
      detailInner.innerHTML = buildWeekDetailHtml(entry);
      detail.appendChild(detailInner);

      wrapper.append(row, detail);

      row.addEventListener("click", () => {
        // Toggle accordion on existing DOM — no full re-render
        const wasOpen = wrapper.classList.contains("lb-item-open");
        // Close all open items
        els.leaderboard.querySelectorAll(".lb-item-open").forEach((item) => {
          item.classList.remove("lb-item-open", ...TW.lbItemOpen.split(" "));
          const d = item.querySelector("[class*='grid-rows']");
          if (d) { d.classList.remove(...TW.lbDetailOpen.split(" ")); }
          const di = item.querySelector("[class*='opacity']");
          if (di) { TW.lbDetailInnerOpen.split(" ").forEach(c => di.classList.remove(c)); }
          const r = item.querySelector("button");
          if (r) r.classList.remove("lb-active");
        });
        if (!wasOpen) {
          wrapper.classList.add("lb-item-open", ...TW.lbItemOpen.split(" "));
          detail.classList.add(...TW.lbDetailOpen.split(" "));
          detailInner.classList.add(...TW.lbDetailInnerOpen.split(" "));
          row.classList.add("lb-active");
          state.selectedDetailWeek = entry.weekNumber;
        } else {
          state.selectedDetailWeek = null;
        }
        persistSession();
      });

      els.leaderboard.appendChild(wrapper);
    });
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

    const hpColors = { avail: "text-[var(--ok-text)]", maybe: "text-[var(--warn-text)]", unavail: "text-[var(--neutral-text)]", pending: "text-[var(--ink-soft)] italic" };
    const section = (label, people, colorKey) => {
      if (!people.length) return "";
      const rows = people.map((p) =>
        `<span class="${TW.hpPerson}">${avatarHtml(p.name)} ${escapeHtml(p.name)}${p.rank ? ` <span class="${TW.wdPersonRank}">#${p.rank}</span>` : ""}</span>`
      ).join("");
      return `<div class="${TW.hpGroup}"><span class="${TW.hpGroupLabel} ${hpColors[colorKey]}">${label}</span>${rows}</div>`;
    };

    popover.innerHTML = `
      <div class="${TW.hpHeader}">
        <strong class="font-display text-sm font-extrabold">${week.rangeText}</strong>
        <span class="${TW.hpMeta}">W${entry.weekNumber}</span>
      </div>
      ${section(`${bk.available.length} available`, bk.available, "avail")}
      ${section(`${bk.maybe.length} maybe`, bk.maybe, "maybe")}
      ${section(`${bk.unavailable.length} unavailable`, bk.unavailable, "unavail")}
      ${section(`${bk.notSubmitted.length} pending`, bk.notSubmitted, "pending")}
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

  function buildWeekDetailHtml(entry) {
    const target = entry;
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
        return `<span class="${TW.wdBadge} ${TW.wdBadgePending}">Not submitted</span>`;
      }
      const cls = person.status === "available" ? TW.wdBadgeAvail : person.status === "maybe" ? TW.wdBadgeMaybe : TW.wdBadgeUnsel;
      const labels = { available: "Available", maybe: "Maybe", unselected: "Unavailable" };
      return `<span class="${TW.wdBadge} ${cls}">${labels[person.status] || "Unavailable"}</span>`;
    };

    const rankLabel = (rank) => {
      if (!rank) return "";
      const labels = { 1: "Top pick", 2: "2nd pick", 3: "3rd pick", 4: "4th pick", 5: "5th pick" };
      return `<span class="${TW.wdPersonRank}">${labels[rank] || `#${rank}`}</span>`;
    };

    const peopleRows = sortedPeople.length
      ? sortedPeople
          .map((person) =>
            `<div class="${TW.wdPerson}${person.rank ? " border-l-2 border-l-[var(--accent)]" : ""}${!person.submitted ? " opacity-60" : ""}">` +
              `<span class="${TW.wdPersonName}">${avatarHtml(person.name)} ${escapeHtml(person.name)}</span>` +
              `<div class="${TW.wdPersonStatus}">` +
                `${rankLabel(person.rank)}` +
                `${statusBadge(person)}` +
              `</div>` +
            `</div>`
          )
          .join("")
      : `<p class="${TW.wdEmpty}">No participant details yet.</p>`;

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

    return `
      ${insight ? `<p class="${TW.wdInsight}">${insight}</p>` : ""}
      <div class="${TW.wdPeople}">${peopleRows}</div>
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
    const toneClass = tone === "good" ? TW.toastGood : tone === "warn" ? TW.toastWarn : "";
    toast.className = `${TW.toast} ${toneClass} toast-animate`.trim();
    toast.textContent = message;
    els.toastArea.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2500);
  }
})();
