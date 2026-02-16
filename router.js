(function (global) {
  "use strict";

  var routes = [];
  var currentCleanup = null;
  var started = false;

  function parseHash(hash) {
    var raw = (hash || "").replace(/^#\/?/, "").replace(/\/+$/, "");
    var parts = raw.split("/").filter(Boolean);
    return {
      tripCode: parts[0] || "",
      module: parts[1] || "",
      view: parts[2] || "",
      raw: raw
    };
  }

  function matchRoute(pattern, parsed) {
    if (pattern === "") {
      return !parsed.tripCode ? {} : null;
    }
    var patParts = pattern.replace(/^\//, "").split("/");
    var valParts = [parsed.tripCode, parsed.module, parsed.view].filter(Boolean);

    if (patParts.length !== valParts.length) return null;

    var params = {};
    for (var i = 0; i < patParts.length; i++) {
      if (patParts[i].charAt(0) === ":") {
        params[patParts[i].slice(1)] = valParts[i];
      } else if (patParts[i] !== valParts[i]) {
        return null;
      }
    }
    return params;
  }

  function dispatch() {
    if (typeof currentCleanup === "function") {
      currentCleanup();
      currentCleanup = null;
    }

    var parsed = parseHash(global.location.hash);

    for (var i = 0; i < routes.length; i++) {
      var params = matchRoute(routes[i].pattern, parsed);
      if (params !== null) {
        var result = routes[i].handler(params, parsed);
        if (typeof result === "function") {
          currentCleanup = result;
        }
        return;
      }
    }
  }

  global.TripRouter = {
    onRoute: function (pattern, handler) {
      routes.push({ pattern: pattern, handler: handler });
    },

    navigate: function (hash) {
      global.location.hash = hash.charAt(0) === "#" ? hash : "#/" + hash;
    },

    start: function () {
      if (started) return;
      started = true;
      global.addEventListener("hashchange", dispatch);
      dispatch();
    },

    currentRoute: function () {
      return parseHash(global.location.hash);
    },

    destroy: function () {
      global.removeEventListener("hashchange", dispatch);
      if (typeof currentCleanup === "function") {
        currentCleanup();
        currentCleanup = null;
      }
      routes = [];
      started = false;
    }
  };
})(window);
