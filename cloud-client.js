(function (global) {
  "use strict";

  const POLL_INTERVAL_MS = 8000;
  const POLL_MAX_INTERVAL_MS = 60000;
  const POLL_BACKOFF_FACTOR = 2;

  class PlannerBackend {
    constructor(config) {
      this.config = config || {};
      this.apiBaseUrl = String(this.config.apiBaseUrl || "/api").replace(/\/+$/, "");
      this.enabled = Boolean(this.apiBaseUrl);
    }

    isEnabled() {
      return this.enabled;
    }

    async healthCheck() {
      this.assertEnabled();
      await this.request("/health");
    }

    async joinTrip(payload) {
      this.assertEnabled();
      const response = await this.request("/join", {
        method: "POST",
        body: payload
      });

      return {
        trip: response.trip,
        participant: response.participant,
        selections: response.selections || [],
        created: Boolean(response.created)
      };
    }

    async updateParticipantProgress(participantId, step) {
      this.assertEnabled();
      await this.request("/progress", {
        method: "POST",
        body: { participantId, step }
      });
    }

    async markSubmitted(participantId) {
      this.assertEnabled();
      await this.request("/submit", {
        method: "POST",
        body: { participantId }
      });
    }

    async loadParticipantSelections(participantId) {
      this.assertEnabled();
      const response = await this.request(`/selections?participantId=${encodeURIComponent(participantId)}`);
      return response.rows || [];
    }

    async upsertSelections(participantId, selections) {
      this.assertEnabled();
      await this.request("/selections", {
        method: "POST",
        body: { participantId, selections }
      });
    }

    async fetchGroupData(tripId) {
      this.assertEnabled();
      const response = await this.request(`/group?tripId=${encodeURIComponent(tripId)}`);
      return {
        participants: response.participants || [],
        selections: response.selections || []
      };
    }

    subscribeToTrip(tripId, onChange) {
      this.assertEnabled();
      const channel = {
        tripId,
        onChange,
        timer: null,
        visibilityListener: null,
        active: true,
        inFlight: false,
        currentInterval: POLL_INTERVAL_MS,
        consecutiveFailures: 0
      };

      const runTick = async () => {
        if (!channel.active || channel.inFlight) {
          return;
        }

        channel.inFlight = true;
        try {
          await onChange();
          channel.consecutiveFailures = 0;
          channel.currentInterval = POLL_INTERVAL_MS;
        } catch {
          channel.consecutiveFailures += 1;
          channel.currentInterval = Math.min(
            POLL_MAX_INTERVAL_MS,
            POLL_INTERVAL_MS * Math.pow(POLL_BACKOFF_FACTOR, channel.consecutiveFailures)
          );
        } finally {
          channel.inFlight = false;
          reschedule();
        }
      };

      const reschedule = () => {
        stopTimer();
        if (!channel.active || global.document.hidden) {
          return;
        }
        channel.timer = global.setTimeout(runTick, channel.currentInterval);
      };

      const startTimer = () => {
        if (!channel.active || channel.timer || global.document.hidden) {
          return;
        }

        channel.timer = global.setTimeout(runTick, channel.currentInterval);
      };

      const stopTimer = () => {
        if (!channel.timer) {
          return;
        }

        global.clearTimeout(channel.timer);
        channel.timer = null;
      };

      channel.visibilityListener = () => {
        if (global.document.hidden) {
          stopTimer();
          return;
        }

        channel.consecutiveFailures = 0;
        channel.currentInterval = POLL_INTERVAL_MS;
        void runTick();
      };

      global.document.addEventListener("visibilitychange", channel.visibilityListener);
      startTimer();
      return channel;
    }

    async removeSubscription(channel) {
      if (!channel) {
        return;
      }

      channel.active = false;
      if (channel.timer) {
        global.clearTimeout(channel.timer);
      }

      if (channel.visibilityListener) {
        global.document.removeEventListener("visibilitychange", channel.visibilityListener);
      }
    }

    assertEnabled() {
      if (!this.enabled) {
        throw new Error("Cloud API is not configured.");
      }
    }

    async request(path, options) {
      const requestOptions = options || {};
      const url = `${this.apiBaseUrl}${path}`;
      const response = await global.fetch(url, {
        method: requestOptions.method || "GET",
        headers: {
          "content-type": "application/json"
        },
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload && payload.error ? payload.error : `Cloud request failed (${response.status}).`;
        throw new Error(message);
      }

      return payload;
    }
  }

  global.PlannerBackend = PlannerBackend;
})(window);
