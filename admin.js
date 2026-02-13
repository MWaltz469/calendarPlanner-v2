(function () {
  "use strict";

  const API_BASE = "/api/admin";

  const els = {
    loginSection: document.getElementById("loginSection"),
    dashboardSection: document.getElementById("dashboardSection"),
    tripDetailSection: document.getElementById("tripDetailSection"),
    passwordInput: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
    loginError: document.getElementById("loginError"),
    logoutBtn: document.getElementById("logoutBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    tripsContainer: document.getElementById("tripsContainer"),
    backToTripsBtn: document.getElementById("backToTripsBtn"),
    tripDetailTitle: document.getElementById("tripDetailTitle"),
    tripDetailInfo: document.getElementById("tripDetailInfo"),
    participantsContainer: document.getElementById("participantsContainer"),
    toastArea: document.getElementById("toastArea")
  };

  function getToken() {
    return sessionStorage.getItem("admin_token") || "";
  }

  function setToken(token) {
    sessionStorage.setItem("admin_token", token);
  }

  function clearToken() {
    sessionStorage.removeItem("admin_token");
  }

  async function apiRequest(path, options) {
    const token = getToken();
    const method = (options && options.method) || "GET";
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`
      }
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const msg = payload && payload.error ? payload.error : `Request failed (${response.status}).`;
      throw new Error(msg);
    }

    return payload;
  }

  function showToast(message, tone) {
    const toast = document.createElement("div");
    toast.className = `toast ${tone || ""}`.trim();
    toast.textContent = message;
    els.toastArea.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  function showView(view) {
    els.loginSection.hidden = view !== "login";
    els.dashboardSection.hidden = view !== "dashboard";
    els.tripDetailSection.hidden = view !== "detail";
    els.logoutBtn.hidden = view === "login";
  }

  function formatDate(isoString) {
    if (!isoString) return "—";
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  }

  function formatWindowConfig(weekFormat, tripLength) {
    const start = weekFormat === "sun_start" ? "Sunday" : "Saturday";
    return `${start} start, ${tripLength}-day windows`;
  }

  // --- Login ---

  async function handleLogin() {
    const password = els.passwordInput.value.trim();
    if (!password) {
      els.loginError.textContent = "Enter a password.";
      els.loginError.hidden = false;
      return;
    }

    els.loginBtn.disabled = true;
    els.loginBtn.textContent = "Signing in...";
    els.loginError.hidden = true;

    setToken(password);
    try {
      await apiRequest("/trips");
      showView("dashboard");
      showToast("Signed in.", "good");
      loadTrips();
    } catch (error) {
      clearToken();
      els.loginError.textContent = error.message === "Unauthorized." ? "Wrong password." : error.message;
      els.loginError.hidden = false;
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.textContent = "Sign In";
    }
  }

  function handleLogout() {
    clearToken();
    showView("login");
    els.passwordInput.value = "";
    showToast("Signed out.", "good");
  }

  // --- Trip List ---

  async function loadTrips() {
    els.tripsContainer.innerHTML = `<p class="hint">Loading trips...</p>`;
    try {
      const data = await apiRequest("/trips");
      renderTrips(data.trips || []);
    } catch (error) {
      if (error.message === "Unauthorized.") {
        clearToken();
        showView("login");
        showToast("Session expired. Sign in again.", "warn");
        return;
      }
      els.tripsContainer.innerHTML = `<p class="hint hint--error">Failed to load trips: ${escapeHtml(error.message)}</p>`;
    }
  }

  function renderTrips(trips) {
    if (!trips.length) {
      els.tripsContainer.innerHTML = `<p class="hint">No trips found.</p>`;
      return;
    }

    els.tripsContainer.innerHTML = "";
    trips.forEach((trip) => {
      const card = document.createElement("div");
      card.className = "admin-trip-row";

      const allSubmitted = trip.participant_count > 0 && trip.submitted_count === trip.participant_count;

      card.innerHTML = `
        <div class="admin-trip-row-main">
          <div class="admin-trip-row-info">
            <strong class="admin-trip-code">${escapeHtml(trip.share_code)}</strong>
            <span class="admin-trip-meta">${trip.trip_year} &middot; ${formatWindowConfig(trip.week_format, trip.trip_length)}</span>
            <span class="admin-trip-meta">Created ${formatDate(trip.created_at)}</span>
          </div>
          <div class="admin-trip-row-stats">
            <span class="lb-stat">${trip.participant_count} participant${trip.participant_count !== 1 ? "s" : ""}</span>
            <span class="lb-stat ${allSubmitted && trip.participant_count > 0 ? "available" : trip.submitted_count > 0 ? "maybe" : ""}">${trip.submitted_count} submitted</span>
          </div>
        </div>
        <div class="admin-trip-row-actions">
          <button class="btn view-btn" type="button">View</button>
          <button class="btn danger delete-trip-btn" type="button">Delete</button>
        </div>
      `;

      card.querySelector(".view-btn").addEventListener("click", () => loadTripDetail(trip.id));
      card.querySelector(".delete-trip-btn").addEventListener("click", () => deleteTrip(trip.id, trip.share_code));
      els.tripsContainer.appendChild(card);
    });
  }

  async function deleteTrip(tripId, shareCode) {
    if (!window.confirm(`Delete trip "${shareCode}" and ALL its participants and data? This cannot be undone.`)) return;

    try {
      await apiRequest(`/trip?tripId=${encodeURIComponent(tripId)}`, { method: "DELETE" });
      showToast(`Trip "${shareCode}" deleted.`, "good");
      loadTrips();
    } catch (error) {
      showToast(`Delete failed: ${error.message}`, "warn");
    }
  }

  // --- Trip Detail ---

  let currentTripId = null;

  async function loadTripDetail(tripId) {
    currentTripId = tripId;
    showView("detail");
    els.tripDetailInfo.innerHTML = `<p class="hint">Loading...</p>`;
    els.participantsContainer.innerHTML = "";

    try {
      const data = await apiRequest(`/trip?tripId=${encodeURIComponent(tripId)}`);
      renderTripDetail(data.trip, data.participants || []);
    } catch (error) {
      if (error.message === "Unauthorized.") {
        clearToken();
        showView("login");
        showToast("Session expired. Sign in again.", "warn");
        return;
      }
      els.tripDetailInfo.innerHTML = `<p class="hint hint--error">Failed: ${escapeHtml(error.message)}</p>`;
    }
  }

  function renderTripDetail(trip, participants) {
    els.tripDetailTitle.textContent = `Trip: ${trip.share_code}`;

    els.tripDetailInfo.innerHTML = `
      <div class="admin-detail-chips">
        <span class="lb-stat">${trip.trip_year}</span>
        <span class="lb-stat">${formatWindowConfig(trip.week_format, trip.trip_length)}</span>
        <span class="lb-stat">${trip.timezone || "UTC"}</span>
        <span class="lb-stat">Created ${formatDate(trip.created_at)}</span>
      </div>
    `;

    if (!participants.length) {
      els.participantsContainer.innerHTML = `<p class="hint">No participants yet.</p>`;
      return;
    }

    els.participantsContainer.innerHTML = "";
    participants.forEach((p) => {
      const row = document.createElement("div");
      row.className = "admin-participant-row";
      const submitted = Boolean(p.submitted_at);
      const stepLabels = { 1: "Join", 2: "Pick Weeks", 3: "Rank", 4: "Review" };

      row.innerHTML = `
        <div class="admin-participant-info">
          <strong>${escapeHtml(p.name)}</strong>
          <div class="admin-participant-meta">
            <span class="wd-badge ${submitted ? "wd-badge-available" : "wd-badge-unselected"}">${submitted ? "Submitted" : "Not submitted"}</span>
            <span class="lb-stat">Step ${p.last_active_step}: ${stepLabels[p.last_active_step] || "Unknown"}</span>
            <span class="lb-stat">Joined ${formatDate(p.created_at)}</span>
            ${submitted ? `<span class="lb-stat">Submitted ${formatDate(p.submitted_at)}</span>` : ""}
          </div>
        </div>
        <div class="admin-participant-actions">
          ${submitted ? `<button class="btn reset-btn" type="button">Reset Submission</button>` : ""}
          <button class="btn danger remove-btn" type="button">Remove</button>
        </div>
      `;

      const resetBtn = row.querySelector(".reset-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => resetSubmission(p.id, p.name));
      }
      row.querySelector(".remove-btn").addEventListener("click", () => removeParticipant(p.id, p.name));
      els.participantsContainer.appendChild(row);
    });
  }

  async function resetSubmission(participantId, name) {
    if (!window.confirm(`Reset submission status for "${name}"? They will need to submit again.`)) return;

    try {
      await apiRequest(`/participant?participantId=${encodeURIComponent(participantId)}`, { method: "PATCH" });
      showToast(`Submission reset for "${name}".`, "good");
      if (currentTripId) loadTripDetail(currentTripId);
    } catch (error) {
      showToast(`Reset failed: ${error.message}`, "warn");
    }
  }

  async function removeParticipant(participantId, name) {
    if (!window.confirm(`Remove "${name}" and all their selections? This cannot be undone.`)) return;

    try {
      await apiRequest(`/participant?participantId=${encodeURIComponent(participantId)}`, { method: "DELETE" });
      showToast(`"${name}" removed.`, "good");
      if (currentTripId) loadTripDetail(currentTripId);
    } catch (error) {
      showToast(`Remove failed: ${error.message}`, "warn");
    }
  }

  // --- Utilities ---

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Init ---

  function init() {
    els.loginBtn.addEventListener("click", handleLogin);
    els.passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });
    els.logoutBtn.addEventListener("click", handleLogout);
    els.refreshBtn.addEventListener("click", loadTrips);
    els.backToTripsBtn.addEventListener("click", () => {
      showView("dashboard");
      loadTrips();
    });

    if (getToken()) {
      showView("dashboard");
      loadTrips();
    } else {
      showView("login");
    }
  }

  init();
})();
