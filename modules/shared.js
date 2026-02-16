(function (global) {
  "use strict";

  var MODULE_META = {
    when: { icon: "\uD83D\uDCC5", label: "When", desc: "Find the week that works for everyone" },
    budget: { icon: "\uD83D\uDCB0", label: "Budget", desc: "Align on a comfortable price range" },
    preferences: { icon: "\u2728", label: "Preferences", desc: "Share deal-breakers and nice-to-haves" },
    destination: { icon: "\uD83C\uDF0D", label: "Destination", desc: "Brainstorm and vote on where to go" },
    "book-it": { icon: "\u2705", label: "Book It", desc: "Confirm the booking details" },
    split: { icon: "\uD83D\uDCB3", label: "Trip Split", desc: "Track expenses and settle up" }
  };

  var STATUS_LABELS = {
    open: "Open",
    locked: "Locked",
    decided: "Decided"
  };

  function escapeHtml(str) {
    var div = global.document.createElement("div");
    div.appendChild(global.document.createTextNode(String(str || "")));
    return div.innerHTML;
  }

  function renderModuleCard(mod, opts) {
    opts = opts || {};
    var meta = MODULE_META[mod.type] || { icon: "\uD83D\uDCE6", label: mod.type, desc: "" };
    var statusClass = mod.status === "decided"
      ? "border-[var(--module-decided)] bg-[var(--ok-bg)]"
      : mod.status === "locked"
        ? "border-[var(--module-locked)]"
        : "border-[var(--module-open)]";

    var badge = mod.status === "decided"
      ? '<span class="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-border)] text-[var(--ok-text)]">\u2713 Decided</span>'
      : mod.status === "locked"
        ? '<span class="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-[var(--neutral-bg)] border border-[var(--neutral-border)] text-[var(--neutral-text)]">\uD83D\uDD12 Locked</span>'
        : '<span class="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent-text)]">Open</span>';

    var progress = "";
    if (typeof opts.submittedCount === "number" && typeof opts.totalCount === "number") {
      progress = '<span class="text-2xs font-semibold text-[var(--ink-soft)]">' +
        escapeHtml(opts.submittedCount + "/" + opts.totalCount) + " submitted</span>";
    }

    var cta = mod.status === "locked"
      ? "View Results"
      : (opts.hasSubmitted ? "Edit Response" : "Start");

    return '<div class="module-card ' + statusClass + '" data-module-id="' + escapeHtml(mod.id) + '" data-module-type="' + escapeHtml(mod.type) + '" role="button" tabindex="0">' +
      '<div class="flex items-start justify-between gap-2">' +
        '<div class="flex items-center gap-3">' +
          '<span class="text-2xl leading-none" aria-hidden="true">' + meta.icon + '</span>' +
          '<div>' +
            '<h3 class="m-0 font-display font-extrabold text-base">' + escapeHtml(meta.label) + '</h3>' +
            '<p class="m-0 text-sm text-[var(--ink-soft)]">' + escapeHtml(meta.desc) + '</p>' +
          '</div>' +
        '</div>' +
        badge +
      '</div>' +
      '<div class="flex items-center justify-between">' +
        progress +
        '<span class="inline-flex items-center text-sm font-bold text-[var(--accent)]">' + escapeHtml(cta) + ' &rarr;</span>' +
      '</div>' +
    '</div>';
  }

  function renderSectionLabel(text) {
    return '<span class="section-label">' + escapeHtml(text) + '</span>';
  }

  function renderOptionPill(label, selected, extraAttrs) {
    extraAttrs = extraAttrs || "";
    return '<button type="button" class="option-pill" aria-pressed="' + (selected ? "true" : "false") + '" ' + extraAttrs + '>' +
      escapeHtml(label) +
    '</button>';
  }

  function renderTriToggle(options, selectedValue) {
    var html = '<div class="tri-toggle">';
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var pressed = opt.value === selectedValue;
      html += '<button type="button" aria-pressed="' + (pressed ? "true" : "false") + '" data-value="' + escapeHtml(opt.value) + '">' +
        escapeHtml(opt.label) +
      '</button>';
    }
    html += '</div>';
    return html;
  }

  function renderConsensusBar(segments) {
    if (!segments || !segments.length) return '<div class="consensus-bar"></div>';

    var total = 0;
    for (var i = 0; i < segments.length; i++) total += segments[i].count;
    if (total === 0) return '<div class="consensus-bar"></div>';

    var html = '<div class="consensus-bar">';
    for (var j = 0; j < segments.length; j++) {
      var pct = ((segments[j].count / total) * 100).toFixed(1);
      html += '<div style="width:' + pct + '%;background:' + escapeHtml(segments[j].color) + '" title="' +
        escapeHtml(segments[j].label + ": " + segments[j].count) + '"></div>';
    }
    html += '</div>';
    return html;
  }

  function renderBriefCard(title, bullets) {
    var html = '<div class="card p-4 grid gap-2">' +
      '<h4 class="m-0 font-display font-extrabold text-sm">' + escapeHtml(title) + '</h4>';
    if (bullets && bullets.length) {
      html += '<ul class="list-none m-0 p-0 grid gap-1">';
      for (var i = 0; i < bullets.length; i++) {
        html += '<li class="text-sm text-[var(--ink-soft)] flex items-start gap-2">' +
          '<span class="text-[var(--accent)] mt-0.5">&bull;</span> ' + escapeHtml(bullets[i]) +
        '</li>';
      }
      html += '</ul>';
    }
    html += '</div>';
    return html;
  }

  function renderEmptyState(message) {
    return '<div class="text-center py-8 text-[var(--ink-soft)]">' +
      '<p class="text-sm font-semibold">' + escapeHtml(message) + '</p>' +
    '</div>';
  }

  function showToast(message, tone) {
    var area = global.document.getElementById("toastArea");
    if (!area) return;

    var toast = global.document.createElement("div");
    var base = "fixed-toast text-sm font-bold px-4 py-3 rounded-xl shadow-lg toast-animate";
    var toneClass = tone === "good"
      ? "bg-[var(--ok-bg)] border border-[var(--ok-border)] text-[var(--ok-text)]"
      : tone === "warn"
        ? "bg-[var(--warn-bg)] border border-[var(--warn-border)] text-[var(--warn-text)]"
        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)]";
    toast.className = (base + " " + toneClass).trim();
    toast.textContent = message;
    area.appendChild(toast);
    global.setTimeout(function () { toast.remove(); }, 2500);
  }

  function formatCurrency(amount) {
    return "$" + Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function getVisColor(index) {
    return "var(--vis-" + ((index % 8) + 1) + ")";
  }

  global.TripModules = {
    MODULE_META: MODULE_META,
    STATUS_LABELS: STATUS_LABELS,
    escapeHtml: escapeHtml,
    renderModuleCard: renderModuleCard,
    renderSectionLabel: renderSectionLabel,
    renderOptionPill: renderOptionPill,
    renderTriToggle: renderTriToggle,
    renderConsensusBar: renderConsensusBar,
    renderBriefCard: renderBriefCard,
    renderEmptyState: renderEmptyState,
    showToast: showToast,
    formatCurrency: formatCurrency,
    getVisColor: getVisColor
  };
})(window);
