(function (global) {
  "use strict";

  const POLL_INTERVAL_MS = 8000;

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
        inFlight: false
      };

      const runTick = async () => {
        if (!channel.active || channel.inFlight) {
          return;
        }

        channel.inFlight = true;
        try {
          await onChange();
        } catch {
          // Caller handles sync-state errors.
        } finally {
          channel.inFlight = false;
        }
      };

      const startTimer = () => {
        if (!channel.active || channel.timer || global.document.hidden) {
          return;
        }

        channel.timer = global.setInterval(runTick, POLL_INTERVAL_MS);
      };

      const stopTimer = () => {
        if (!channel.timer) {
          return;
        }

        global.clearInterval(channel.timer);
        channel.timer = null;
      };

      channel.visibilityListener = () => {
        if (global.document.hidden) {
          stopTimer();
          return;
        }

        void runTick();
        startTimer();
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
        global.clearInterval(channel.timer);
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
