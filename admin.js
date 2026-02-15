(function () {
  "use strict";

  const API_BASE = "/api/admin";
  const SCORE_MAP = { available: 100, maybe: 0, unselected: 0 };
  const RANK_BONUS = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 };

  const els = {
    loginSection: document.getElementById("loginSection"),
    dashboardSection: document.getElementById("dashboardSection"),
    tripDetailSection: document.getElementById("tripDetailSection"),
    passwordInput: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
    loginError: document.getElementById("loginError"),
    logoutBtn: document.getElementById("logoutBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    statsBar: document.getElementById("statsBar"),
    createTripBtn: document.getElementById("createTripBtn"),
    createTripForm: document.getElementById("createTripForm"),
    createTripSubmit: document.getElementById("createTripSubmit"),
    createTripCancel: document.getElementById("createTripCancel"),
    newTripCode: document.getElementById("newTripCode"),
    newTripName: document.getElementById("newTripName"),
    newTripStartDay: document.getElementById("newTripStartDay"),
    newTripDays: document.getElementById("newTripDays"),
    tripsContainer: document.getElementById("tripsContainer"),
    backToTripsBtn: document.getElementById("backToTripsBtn"),
    tripDetailTitle: document.getElementById("tripDetailTitle"),
    tripDetailInfo: document.getElementById("tripDetailInfo"),
    tripActions: document.getElementById("tripActions"),
    adminResultsContainer: document.getElementById("adminResultsContainer"),
    participantsContainer: document.getElementById("participantsContainer"),
    toastArea: document.getElementById("toastArea")
  };

  // --- Auth helpers ---

  function getToken() { return sessionStorage.getItem("admin_token") || ""; }
  function setToken(t) { sessionStorage.setItem("admin_token", t); }
  function clearToken() { sessionStorage.removeItem("admin_token"); }

  async function apiRequest(path, options) {
    const opts = options || {};
    const response = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers: { "content-type": "application/json", "authorization": `Bearer ${getToken()}` },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let payload = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) {
      const msg = payload && payload.error ? payload.error : `Request failed (${response.status}).`;
      throw new Error(msg);
    }
    return payload;
  }

  // --- Utilities ---

  function showToast(message, tone) {
    const t = document.createElement("div");
    t.className = `toast ${tone || ""}`.trim();
    t.textContent = message;
    els.toastArea.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function showView(view) {
    els.loginSection.hidden = view !== "login";
    els.dashboardSection.hidden = view !== "dashboard";
    els.tripDetailSection.hidden = view !== "detail";
    els.logoutBtn.hidden = view === "login";
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "\u2014";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
      });
    } catch { return iso; }
  }

  function formatShortDate(iso) {
    if (!iso) return "\u2014";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  }

  function fmtConfig(wf, tl) {
    const dayLabels = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };
    const match = String(wf || "").match(/^(\w+)_start$/);
    const day = match ? (dayLabels[match[1]] || match[1]) : "Saturday";
    return `${day} start, ${tl}-day`;
  }

  function timeAgo(iso) {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // --- Login ---

  async function handleLogin() {
    const pw = els.passwordInput.value.trim();
    if (!pw) { els.loginError.textContent = "Enter a password."; els.loginError.hidden = false; return; }
    els.loginBtn.disabled = true; els.loginBtn.textContent = "Signing in..."; els.loginError.hidden = true;
    setToken(pw);
    try {
      await apiRequest("/trips");
      showView("dashboard"); showToast("Signed in.", "good"); loadTrips();
    } catch (e) {
      clearToken();
      els.loginError.textContent = e.message === "Unauthorized." ? "Wrong password." : e.message;
      els.loginError.hidden = false;
    } finally { els.loginBtn.disabled = false; els.loginBtn.textContent = "Sign In"; }
  }

  function handleLogout() { clearToken(); showView("login"); els.passwordInput.value = ""; showToast("Signed out.", "good"); }

  function handleAuthError(e) {
    if (e.message === "Unauthorized.") { clearToken(); showView("login"); showToast("Session expired.", "warn"); return true; }
    return false;
  }

  // --- Dashboard Stats ---

  function renderStats(stats) {
    if (!stats) { els.statsBar.innerHTML = ""; return; }
    els.statsBar.innerHTML = `
      <div class="admin-stats">
        <div class="score-chip"><span>Trips</span><strong>${stats.totalTrips}</strong></div>
        <div class="score-chip"><span>Participants</span><strong>${stats.totalParticipants}</strong><span class="score-chip-sub">across all trips</span></div>
        <div class="score-chip"><span>Submissions</span><strong>${stats.totalSubmissions}</strong></div>
      </div>
    `;
  }

  // --- Create Trip ---

  function toggleCreateForm(show) {
    els.createTripForm.hidden = !show;
    if (show) { els.newTripCode.value = ""; els.newTripName.value = ""; els.newTripCode.focus(); }
  }

  async function handleCreateTrip() {
    const code = els.newTripCode.value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!code) { showToast("Enter a trip code.", "warn"); return; }
    els.createTripSubmit.disabled = true;
    try {
      await apiRequest("/create-trip", {
        method: "POST",
        body: {
          shareCode: code,
          name: els.newTripName.value.trim() || undefined,
          year: new Date().getFullYear(),
          startDay: els.newTripStartDay.value,
          days: Number(els.newTripDays.value)
        }
      });
      showToast(`Trip "${code}" created.`, "good");
      toggleCreateForm(false);
      loadTrips();
    } catch (e) {
      if (!handleAuthError(e)) showToast(`Create failed: ${e.message}`, "warn");
    } finally { els.createTripSubmit.disabled = false; }
  }

  // --- Trip List ---

  async function loadTrips() {
    els.tripsContainer.innerHTML = `<p class="hint">Loading trips...</p>`;
    try {
      const data = await apiRequest("/trips");
      renderStats(data.stats);
      allTrips = data.trips || [];
      const searchInput = document.getElementById("tripSearchInput");
      if (searchInput && searchInput.value.trim()) { filterTrips(); } else { renderTrips(allTrips); }
    } catch (e) {
      if (!handleAuthError(e)) els.tripsContainer.innerHTML = `<p class="hint hint--error">Failed: ${escapeHtml(e.message)}</p>`;
    }
  }

  function renderTrips(trips) {
    if (!trips.length) { els.tripsContainer.innerHTML = `<p class="hint">No trips yet. Create one above.</p>`; return; }
    els.tripsContainer.innerHTML = "";
    trips.forEach((trip) => {
      const card = document.createElement("div");
      card.className = "admin-trip-row";
      const allDone = trip.participant_count > 0 && trip.submitted_count === trip.participant_count;
      const locked = Boolean(trip.locked);

      card.innerHTML = `
        <div class="admin-trip-row-main">
          <div class="admin-trip-row-info">
            <div class="admin-trip-title-row">
              <strong class="admin-trip-code">${escapeHtml(trip.share_code)}</strong>
              ${trip.name && trip.name !== `${trip.trip_year} Group Trip` ? `<span class="admin-trip-name">${escapeHtml(trip.name)}</span>` : ""}
              ${locked ? `<span class="wd-badge wd-badge-maybe">Locked</span>` : ""}
            </div>
            <span class="admin-trip-meta">${trip.trip_year} &middot; ${fmtConfig(trip.week_format, trip.trip_length)} &middot; Created ${formatShortDate(trip.created_at)}</span>
          </div>
          <div class="admin-trip-row-stats">
            <span class="lb-stat">${trip.participant_count} participant${trip.participant_count !== 1 ? "s" : ""}</span>
            <span class="lb-stat ${allDone && trip.participant_count > 0 ? "available" : trip.submitted_count > 0 ? "maybe" : ""}">${trip.submitted_count} submitted</span>
          </div>
        </div>
        <div class="admin-trip-row-actions">
          <button class="btn primary view-btn" type="button">View</button>
        </div>
        <div class="admin-trip-row-danger">
          <button class="btn danger btn-sm delete-trip-btn" type="button">Delete trip</button>
        </div>
      `;
      card.querySelector(".view-btn").addEventListener("click", () => loadTripDetail(trip.id));
      card.querySelector(".delete-trip-btn").addEventListener("click", () => deleteTrip(trip.id, trip.share_code));
      els.tripsContainer.appendChild(card);
    });
  }

  async function deleteTrip(tripId, code) {
    if (!confirm(`Permanently delete "${code}"? This will remove all participant data and submissions. This cannot be undone.`)) return;
    try { await apiRequest(`/trip?tripId=${enc(tripId)}`, { method: "DELETE" }); showToast(`"${code}" deleted.`, "good"); loadTrips(); }
    catch (e) { if (!handleAuthError(e)) showToast(`Delete failed: ${e.message}`, "warn"); }
  }

  // --- Trip Detail ---

  let currentTrip = null;

  async function loadTripDetail(tripId) {
    showView("detail");
    els.tripDetailInfo.innerHTML = `<p class="hint">Loading...</p>`;
    els.tripActions.innerHTML = "";
    els.adminResultsContainer.innerHTML = "";
    els.participantsContainer.innerHTML = "";

    try {
      const data = await apiRequest(`/trip?tripId=${enc(tripId)}`);
      currentTrip = data;
      renderTripDetail(data.trip, data.participants || [], data.selections || []);
    } catch (e) {
      if (!handleAuthError(e)) els.tripDetailInfo.innerHTML = `<p class="hint hint--error">Failed: ${escapeHtml(e.message)}</p>`;
    }
  }

  function renderTripDetail(trip, participants, selections) {
    els.tripDetailTitle.textContent = trip.name && trip.name !== `${trip.trip_year} Group Trip`
      ? `${trip.share_code} — ${trip.name}` : trip.share_code;

    const locked = Boolean(trip.locked);
    els.tripDetailInfo.innerHTML = `
      <div class="admin-detail-chips">
        <span class="lb-stat">${trip.trip_year}</span>
        <span class="lb-stat">${fmtConfig(trip.week_format, trip.trip_length)}</span>
        <span class="lb-stat">TZ: ${trip.timezone || "UTC"}</span>
        <span class="lb-stat">Created ${formatShortDate(trip.created_at)}</span>
        ${locked ? `<span class="wd-badge wd-badge-maybe">Locked</span>` : `<span class="wd-badge wd-badge-available">Open</span>`}
      </div>
    `;

    // Actions with visible descriptions
    els.tripActions.innerHTML = "";
    // Safe actions
    const safeActions = [
      { label: locked ? "Unlock Trip" : "Lock Trip", cls: "btn", hint: locked ? "Allow new joins and selection changes" : "Freeze joins and selection changes", handler: () => toggleLock(trip.id, !locked) },
      { label: "Edit Name", cls: "btn", hint: "Change the display name (code stays the same)", handler: () => editTripName(trip.id, trip.name) },
      { label: "Clone Trip", cls: "btn", hint: "Copy settings to a new trip code", handler: () => cloneTrip(trip.id, trip.share_code) },
      { label: "Export CSV", cls: "btn", hint: "Download selections as a spreadsheet", handler: () => exportCsv(trip, participants, selections) }
    ];
    const safeGrid = document.createElement("div");
    safeGrid.className = "admin-actions-grid";
    safeActions.forEach((a) => {
      const wrap = document.createElement("div");
      wrap.className = "admin-action-item";
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = a.cls; btn.textContent = a.label;
      btn.addEventListener("click", a.handler);
      const hint = document.createElement("span");
      hint.className = "admin-action-hint";
      hint.textContent = a.hint;
      wrap.append(btn, hint);
      safeGrid.appendChild(wrap);
    });
    els.tripActions.appendChild(safeGrid);

    // Danger zone
    const dangerZone = document.createElement("div");
    dangerZone.className = "admin-danger-zone";
    dangerZone.innerHTML = `<span class="admin-danger-label">Danger zone</span>`;
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn danger btn-sm";
    deleteBtn.textContent = "Delete Trip";
    deleteBtn.addEventListener("click", () => { deleteTrip(trip.id, trip.share_code); showView("dashboard"); loadTrips(); });
    dangerZone.appendChild(deleteBtn);
    els.tripActions.appendChild(dangerZone);

    // Aggregated results
    renderAdminResults(trip, participants, selections);

    // Participants
    renderParticipants(trip, participants, selections);
  }

  // --- Week date helper ---

  function buildWeekDates(year, weekFormat, tripLength) {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const match = String(weekFormat || "").match(/^(\w+)_start$/);
    const startDayKey = match ? match[1] : "sat";
    const targetDay = dayMap[startDayKey] !== undefined ? dayMap[startDayKey] : 6;
    const days = Number(tripLength) || 7;

    const date = new Date(year, 0, 1);
    while (date.getDay() !== targetDay) date.setDate(date.getDate() + 1);

    const weeks = {};
    for (let i = 0; i < 52; i++) {
      const start = new Date(date);
      start.setDate(date.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + days - 1);
      const fmtOpts = { month: "short", day: "numeric" };
      weeks[i + 1] = {
        startDisplay: `${dayLabels[start.getDay()]}, ${start.toLocaleDateString(undefined, fmtOpts)}`,
        endDisplay: `${dayLabels[end.getDay()]}, ${end.toLocaleDateString(undefined, fmtOpts)}`,
        rangeText: `${start.toLocaleDateString(undefined, fmtOpts)} \u2013 ${end.toLocaleDateString(undefined, { ...fmtOpts, year: "numeric" })}`,
        days
      };
    }
    return weeks;
  }

  // --- Admin Results (narrative + leaderboard) ---

  function renderAdminResults(trip, participants, selections) {
    if (!participants.length) {
      els.adminResultsContainer.innerHTML = `<p class="hint">No participants yet. Share the trip code <strong>${escapeHtml(trip.share_code)}</strong> with your group to get started.</p>`;
      return;
    }

    const weekAggs = computeWeekAggregates(participants, selections);
    const top5 = weekAggs.slice(0, 5);
    const totalPeople = participants.length;
    const submittedCount = participants.filter((p) => p.submitted_at).length;
    const weekDates = buildWeekDates(trip.trip_year, trip.week_format, trip.trip_length);

    if (!top5.length || top5[0].score === 0) {
      const pending = participants.filter((p) => !p.submitted_at).map((p) => escapeHtml(p.name));
      els.adminResultsContainer.innerHTML = `<p class="hint">No selections yet. ${pending.length ? `Waiting on: ${pending.join(", ")}.` : ""}</p>`;
      return;
    }

    // --- Narrative summary (submission-aware) ---
    const best = top5[0];
    const bestWeek = weekDates[best.weekNumber];
    const bk = getWeekBreakdown(best);
    const bestPct = submittedCount > 0 ? Math.round((bk.available.length / submittedCount) * 100) : 0;
    const bestLabel = bestWeek ? bestWeek.rangeText : `Week ${best.weekNumber}`;

    let narrative = `<div class="admin-narrative">`;
    narrative += `<p class="admin-narrative-lead">`;
    if (bestPct === 100 && submittedCount === totalPeople && totalPeople > 1) {
      narrative += `Everyone is available for <strong>${bestLabel}</strong>. You\u2019re good to book.`;
    } else if (bk.available.length > 1) {
      narrative += `The best overlap is <strong>${bestLabel}</strong> with <strong>${bk.available.length} of ${submittedCount}</strong> submitted available (${bestPct}%).`;
    } else if (bk.available.length === 1) {
      narrative += `Top window so far: <strong>${bestLabel}</strong> with 1 person available.`;
    } else {
      narrative += `No strong consensus yet. The top window is <strong>${bestLabel}</strong>.`;
    }
    narrative += `</p>`;

    // Completeness indicator
    if (submittedCount < totalPeople) {
      narrative += `<p class="admin-narrative-pending">Based on <strong>${submittedCount} of ${totalPeople}</strong> submissions. Waiting on: <strong>${bk.notSubmitted.map((p) => escapeHtml(p.name)).join(", ") || participants.filter((p) => !p.submitted_at).map((p) => escapeHtml(p.name)).join(", ")}</strong>.</p>`;
    } else if (totalPeople > 1) {
      narrative += `<p class="admin-narrative-pending" style="color:var(--ok-text)">All ${totalPeople} participants have submitted.</p>`;
    }

    // Who's in, maybe, out — submission-aware
    const parts = [];
    if (bk.available.length) parts.push(`<span class="wd-badge wd-badge-available">${bk.available.map((p) => escapeHtml(p.name)).join(", ")}</span> ${bk.available.length === 1 ? "is" : "are"} available`);
    if (bk.maybe.length) parts.push(`<span class="wd-badge wd-badge-maybe">${bk.maybe.map((p) => escapeHtml(p.name)).join(", ")}</span> ${bk.maybe.length === 1 ? "is" : "are"} maybe`);
    if (bk.unavailable.length) parts.push(`<span class="wd-badge wd-badge-unselected">${bk.unavailable.map((p) => escapeHtml(p.name)).join(", ")}</span> ${bk.unavailable.length === 1 ? "is" : "are"} unavailable`);
    if (bk.notSubmitted.length) parts.push(`<span class="wd-badge" style="background:var(--surface-muted);color:var(--ink-soft);border:1px solid var(--border);">${bk.notSubmitted.map((p) => escapeHtml(p.name)).join(", ")}</span> haven\u2019t submitted yet`);
    if (parts.length) {
      narrative += `<p class="admin-narrative-detail">${parts.join(". ")}.</p>`;
    }

    narrative += `</div>`;

    // --- Leaderboard with dates (submission-aware) ---
    const maxScore = Math.max(1, top5[0].score);
    let leaderboard = `<div class="admin-leaderboard">`;
    top5.forEach((w, i) => {
      const week = weekDates[w.weekNumber];
      const wbk = getWeekBreakdown(w);
      const pct = submittedCount > 0 ? Math.round((wbk.available.length / submittedCount) * 100) : 0;
      const barW = (w.score / maxScore) * 100;
      leaderboard += `
        <div class="lb-row${i === 0 ? " lb-top-pick" : ""}">
          <div class="lb-header">
            <span class="lb-rank">#${i + 1}</span>
            <div class="lb-info">
              <span class="lb-dates">${week ? `${week.startDisplay} \u2192 ${week.endDisplay}` : `Week ${w.weekNumber}`}</span>
              <span class="lb-meta">Week ${w.weekNumber} \u00B7 ${week ? week.days : ""} days</span>
            </div>
          </div>
          <div class="lb-stats">
            ${wbk.available.length ? `<span class="lb-stat available">${wbk.available.length} of ${submittedCount} available</span>` : ""}
            ${wbk.maybe.length ? `<span class="lb-stat maybe">${wbk.maybe.length} maybe</span>` : ""}
            ${pct ? `<span class="lb-stat pct">${pct}%</span>` : ""}
            ${wbk.notSubmitted.length ? `<span class="lb-stat" style="border-style:dashed">${wbk.notSubmitted.length} pending</span>` : ""}
          </div>
          <div class="lb-bar"><span style="width:${barW.toFixed(1)}%"></span></div>
        </div>`;
    });
    leaderboard += `</div>`;

    els.adminResultsContainer.innerHTML = narrative + leaderboard;
  }

  function computeWeekAggregates(participants, selections) {
    const STATUSES = ["available", "maybe", "unselected"];
    const selIndex = new Map();
    selections.forEach((s) => { selIndex.set(`${s.participant_id}:${s.week_number}`, s); });

    const map = new Map();
    for (let w = 1; w <= 52; w++) {
      const entry = { weekNumber: w, availableCount: 0, maybeCount: 0, unavailableCount: 0, notSubmittedCount: 0, score: 0, rankTotal: 0, rankCount: 0, avgRank: null, people: [] };
      participants.forEach((p) => {
        const sel = selIndex.get(`${p.id}:${w}`);
        const submitted = Boolean(p.submitted_at);
        const status = sel && STATUSES.includes(sel.status) ? sel.status : "unselected";
        const rank = sel && sel.rank ? sel.rank : null;
        entry.people.push({ id: p.id, name: p.name, status, rank, submitted });
        if (status === "available") entry.availableCount += 1;
        else if (status === "maybe") entry.maybeCount += 1;
        else if (submitted) entry.unavailableCount += 1;
        else entry.notSubmittedCount += 1;
        if (rank) { entry.rankTotal += rank; entry.rankCount += 1; }
      });
      map.set(w, entry);
    }
    const list = Array.from(map.values());
    list.forEach((e) => {
      let rb = 0;
      e.people.forEach((p) => { if (p.rank) rb += RANK_BONUS[p.rank] || 0; });
      e.score = e.availableCount * SCORE_MAP.available + e.maybeCount * SCORE_MAP.maybe + rb;
      e.avgRank = e.rankCount ? e.rankTotal / e.rankCount : null;
    });
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.availableCount !== a.availableCount) return b.availableCount - a.availableCount;
      return a.weekNumber - b.weekNumber;
    });
    return list;
  }

  function getWeekBreakdown(entry) {
    const available = entry.people.filter((p) => p.submitted && p.status === "available");
    const maybe = entry.people.filter((p) => p.submitted && p.status === "maybe");
    const unavailable = entry.people.filter((p) => p.submitted && p.status !== "available" && p.status !== "maybe");
    const notSubmitted = entry.people.filter((p) => !p.submitted);
    return { available, maybe, unavailable, notSubmitted };
  }

  // --- Participants ---

  function renderParticipants(trip, participants, selections) {
    if (!participants.length) {
      els.participantsContainer.innerHTML = `<p class="hint">No participants yet.</p>`;
      return;
    }

    const locked = Boolean(trip.locked);
    els.participantsContainer.innerHTML = "";
    const stepLabels = { 1: "Join", 2: "Pick Weeks", 3: "Rank", 4: "Review" };

    const submitted = participants.filter((p) => p.submitted_at);
    const waiting = participants.filter((p) => !p.submitted_at);

    if (waiting.length) {
      const header = document.createElement("div");
      header.className = "admin-participant-group-header admin-participant-group-waiting";
      header.innerHTML = `<strong>Waiting (${waiting.length})</strong><span class="lb-stat" style="border-style:dashed">${waiting.length} not submitted</span>`;
      els.participantsContainer.appendChild(header);
    }
    waiting.forEach((p) => renderParticipantRow(p));

    if (submitted.length) {
      const header = document.createElement("div");
      header.className = "admin-participant-group-header admin-participant-group-submitted";
      header.innerHTML = `<strong>Submitted (${submitted.length})</strong>`;
      els.participantsContainer.appendChild(header);
    }
    submitted.forEach((p) => renderParticipantRow(p));

    function renderParticipantRow(p) {
      const row = document.createElement("div");
      row.className = "admin-participant-row";
      const submitted = Boolean(p.submitted_at);
      const pSelections = selections.filter((s) => s.participant_id === p.id);
      const availCount = pSelections.filter((s) => s.status === "available").length;
      const maybeCount = pSelections.filter((s) => s.status === "maybe").length;
      const rankedCount = pSelections.filter((s) => s.rank !== null).length;
      const hasSelections = availCount > 0 || maybeCount > 0;

      row.innerHTML = `
        <div class="admin-participant-info">
          <strong>${escapeHtml(p.name)}</strong>
          <div class="admin-participant-meta">
            <span class="wd-badge ${submitted ? "wd-badge-available" : hasSelections ? "wd-badge-maybe" : "wd-badge-unselected"}">${submitted ? "Submitted" : hasSelections ? "In progress" : "Not started"}</span>
            <span class="lb-stat">Step ${p.last_active_step}: ${stepLabels[p.last_active_step] || "?"}</span>
            <span class="lb-stat">${availCount} avail, ${maybeCount} maybe, ${rankedCount} ranked</span>
            <span class="lb-stat">Joined ${formatShortDate(p.created_at)}</span>
            <span class="lb-stat">Active ${timeAgo(p.updated_at)}</span>
            ${submitted ? `<span class="lb-stat">Submitted ${formatShortDate(p.submitted_at)}</span>` : ""}
          </div>
        </div>
        <div class="admin-participant-actions">
          ${hasSelections ? `<button class="btn view-sel-btn" type="button" title="View this person's week selections and rankings">View Selections</button>` : ""}
          <span class="admin-participant-danger">
            ${submitted ? `<button class="btn danger btn-sm reset-btn" type="button" title="Clear their submission status — they'll need to resubmit">Reset</button>` : ""}
            <button class="btn danger btn-sm remove-btn" type="button" title="Permanently remove this participant and all their data">Remove</button>
          </span>
        </div>
      `;

      const viewBtn = row.querySelector(".view-sel-btn");
      if (viewBtn) viewBtn.addEventListener("click", () => showParticipantSelections(p, pSelections));
      const resetBtn = row.querySelector(".reset-btn");
      if (resetBtn) resetBtn.addEventListener("click", () => resetSubmission(p.id, p.name));
      row.querySelector(".remove-btn").addEventListener("click", () => removeParticipant(p.id, p.name));
      els.participantsContainer.appendChild(row);
    }
  }

  function showParticipantSelections(p, sels) {
    const ranked = sels.filter((s) => s.rank).sort((a, b) => a.rank - b.rank);
    const available = sels.filter((s) => s.status === "available" && !s.rank);
    const maybe = sels.filter((s) => s.status === "maybe");

    let lines = [`Selections for ${p.name}:`, ""];
    if (ranked.length) {
      lines.push("Ranked:");
      ranked.forEach((s) => lines.push(`  #${s.rank}: Week ${s.week_number}`));
      lines.push("");
    }
    if (available.length) {
      lines.push(`Available (unranked): ${available.map((s) => `W${s.week_number}`).join(", ")}`);
      lines.push("");
    }
    if (maybe.length) {
      lines.push(`Maybe: ${maybe.map((s) => `W${s.week_number}`).join(", ")}`);
    }
    if (!ranked.length && !available.length && !maybe.length) {
      lines.push("No selections yet.");
    }
    alert(lines.join("\n"));
  }

  // --- Trip Actions ---

  async function toggleLock(tripId, lock) {
    try {
      await apiRequest(`/trip?tripId=${enc(tripId)}`, { method: "PATCH", body: { locked: lock } });
      showToast(lock ? "Trip locked." : "Trip unlocked.", "good");
      loadTripDetail(tripId);
    } catch (e) { if (!handleAuthError(e)) showToast(`Failed: ${e.message}`, "warn"); }
  }

  async function editTripName(tripId, currentName) {
    const name = prompt("Enter new trip name:", currentName || "");
    if (name === null || !name.trim()) return;
    try {
      await apiRequest(`/trip?tripId=${enc(tripId)}`, { method: "PATCH", body: { name: name.trim() } });
      showToast("Trip name updated.", "good");
      loadTripDetail(tripId);
    } catch (e) { if (!handleAuthError(e)) showToast(`Failed: ${e.message}`, "warn"); }
  }

  async function cloneTrip(sourceTripId, sourceCode) {
    const newCode = prompt(`Enter new trip code (cloning from "${sourceCode}"):`);
    if (!newCode || !newCode.trim()) return;
    const newName = prompt("Enter name for the cloned trip (optional):", "");
    try {
      await apiRequest("/clone-trip", {
        method: "POST",
        body: { sourceTripId, newShareCode: newCode.trim().toUpperCase(), name: newName || undefined }
      });
      showToast(`Trip cloned as "${newCode.trim().toUpperCase()}".`, "good");
      showView("dashboard");
      loadTrips();
    } catch (e) { if (!handleAuthError(e)) showToast(`Clone failed: ${e.message}`, "warn"); }
  }

  function exportCsv(trip, participants, selections) {
    const lines = [];
    lines.push("participant,week_number,status,rank");
    participants.forEach((p) => {
      const pSels = selections.filter((s) => s.participant_id === p.id);
      if (!pSels.length) {
        lines.push(`"${p.name}",,no selections,`);
        return;
      }
      pSels.sort((a, b) => a.week_number - b.week_number);
      pSels.forEach((s) => {
        lines.push(`"${p.name}",${s.week_number},${s.status},${s.rank || ""}`);
      });
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${trip.share_code}_selections.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 200);
    showToast("CSV exported.", "good");
  }

  // --- Participant Actions ---

  async function resetSubmission(pid, name) {
    if (!confirm(`Reset submission for "${name}"?`)) return;
    try {
      await apiRequest(`/participant?participantId=${enc(pid)}`, { method: "PATCH" });
      showToast(`Reset "${name}".`, "good");
      if (currentTrip) loadTripDetail(currentTrip.trip.id);
    } catch (e) { if (!handleAuthError(e)) showToast(`Failed: ${e.message}`, "warn"); }
  }

  async function removeParticipant(pid, name) {
    if (!confirm(`Remove "${name}" and all selections? Cannot be undone.`)) return;
    try {
      await apiRequest(`/participant?participantId=${enc(pid)}`, { method: "DELETE" });
      showToast(`"${name}" removed.`, "good");
      if (currentTrip) loadTripDetail(currentTrip.trip.id);
    } catch (e) { if (!handleAuthError(e)) showToast(`Failed: ${e.message}`, "warn"); }
  }

  function enc(v) { return encodeURIComponent(v); }

  // --- Init ---

  let allTrips = [];

  function filterTrips() {
    const searchInput = document.getElementById("tripSearchInput");
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    if (!query) { renderTrips(allTrips); return; }
    const filtered = allTrips.filter((t) =>
      t.share_code.toLowerCase().includes(query) ||
      (t.name && t.name.toLowerCase().includes(query))
    );
    renderTrips(filtered);
  }

  function init() {
    els.loginBtn.addEventListener("click", handleLogin);
    els.passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
    els.logoutBtn.addEventListener("click", handleLogout);
    els.refreshBtn.addEventListener("click", loadTrips);
    els.createTripBtn.addEventListener("click", () => toggleCreateForm(true));
    els.createTripCancel.addEventListener("click", () => toggleCreateForm(false));
    els.createTripSubmit.addEventListener("click", handleCreateTrip);
    els.newTripCode.addEventListener("keydown", (e) => { if (e.key === "Enter") handleCreateTrip(); });
    els.backToTripsBtn.addEventListener("click", () => { showView("dashboard"); loadTrips(); });

    const searchInput = document.getElementById("tripSearchInput");
    if (searchInput) searchInput.addEventListener("input", filterTrips);

    if (getToken()) { showView("dashboard"); loadTrips(); }
    else { showView("login"); }
  }

  init();
})();
