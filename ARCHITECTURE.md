# Architecture & Agent Context

This document captures the full technical context of the Trip Week Planner for any AI agent or developer picking up the codebase. It was written at the end of a comprehensive audit, refactor, and feature build session that produced 40+ commits across the entire stack.

---

## Project Overview

A serverless group trip coordination app. Participants pick available weeks, rank their favorites, and the app computes group overlap in real time. There's an admin portal for trip management and a landing page for routing.

**Stack:** Vanilla JS (no framework), Cloudflare Pages + Functions, D1 (SQLite), no build step.

**Pages:**
- `/` — Landing page (index.html): three paths — Join, Quick Code, Admin
- `/planner` — Main planner (planner.html): 4-step wizard
- `/admin` — Admin portal (admin.html): password-gated CRUD
- `/about` — About page (about.html): vibecoded manifesto + Vegeta meme

Cloudflare Pages has "pretty URLs" enabled, so `/planner` serves `planner.html` automatically via 308 redirect. All HTML files use **absolute paths** (`/app.js`, `/styles.css`) not relative (`./app.js`) to work correctly with pretty URL routing.

---

## File Map

```
├── index.html              Landing page
├── planner.html            Main planner app (4-step wizard)
├── admin.html              Admin portal
├── about.html              About page
├── app.js                  Planner logic (~2000 lines)
├── admin.js                Admin portal logic
├── cloud-client.js         PlannerBackend class (API client + polling)
├── config.js               Runtime config (year, defaults)
├── theme-init.js           Shared theme bootstrap (all pages)
├── styles.css              All styles (~2000 lines)
├── assets/
│   └── smart-vegeta.png    About page meme
├── functions/
│   └── api/
│       ├── _lib.js         Shared utilities (validation, errors, DB)
│       ├── health.js       GET /api/health
│       ├── join.js         POST /api/join (join existing trip only)
│       ├── selections.js   GET/POST /api/selections
│       ├── submit.js       POST /api/submit
│       ├── progress.js     POST /api/progress
│       ├── group.js        GET /api/group
│       └── admin/
│           ├── _middleware.js   Auth check (Bearer token)
│           ├── trips.js         GET /api/admin/trips
│           ├── trip.js          GET/PATCH/DELETE /api/admin/trip
│           ├── participant.js   DELETE/PATCH /api/admin/participant
│           ├── create-trip.js   POST /api/admin/create-trip
│           └── clone-trip.js    POST /api/admin/clone-trip
├── cloudflare/
│   └── migrations/
│       ├── 0001_init.sql           Initial schema
│       ├── 0002_add_trip_locked.sql  Lock column
│       └── 0003_flexible_windows.sql Wider trip_length + week_format
├── scripts/
│   └── deploy-cloudflare.mjs   One-click deploy orchestrator
├── wrangler.toml               Cloudflare config
├── package.json                Scripts + wrangler dependency
└── .dev.vars.example           Local dev secrets template
```

---

## Database Schema (D1/SQLite)

**trips**
- `id` TEXT PK
- `name` TEXT — custom name (e.g. "Beach House August")
- `share_code` TEXT UNIQUE — the trip code users enter
- `trip_year` INTEGER
- `week_format` TEXT — `{weekday}_start` (e.g. `sat_start`, `wed_start`)
- `trip_length` INTEGER — 2 to 14 days
- `timezone` TEXT
- `locked` INTEGER — 0=open, 1=locked (blocks new joins + selection changes)
- `created_at` TEXT

**participants**
- `id` TEXT PK
- `trip_id` TEXT FK → trips
- `name` TEXT — UNIQUE per (trip_id, name)
- `submitted_at` TEXT — null until they click Submit
- `last_active_step` INTEGER 1-4
- `created_at`, `updated_at` TEXT

**selections**
- `id` TEXT PK
- `participant_id` TEXT FK → participants
- `week_number` INTEGER 1-52
- `status` TEXT — available/maybe/unselected
- `rank` INTEGER 1-5 or NULL
- UNIQUE on (participant_id, week_number)
- UNIQUE INDEX on (participant_id, rank) WHERE rank IS NOT NULL

**Important:** The rank uniqueness constraint requires clearing all ranks before upserting new ones in a batch. See `selections.js` — the batch starts with a `clearRanks` statement.

---

## Key Design Decisions

### Trip creation is admin-only

`/api/join` does NOT create trips. It returns 404 if the share code doesn't exist. Trips must be created via `/api/admin/create-trip`. This prevents typos from creating phantom trips.

### Authentication model

- **Participants:** Trip code + name. No passwords. Same name on same trip = same participant. Trust model assumes friends sharing a private code.
- **Admin:** `ADMIN_PASSWORD` stored as a Cloudflare secret. Sent via `Authorization: Bearer <password>` header. Validated by `functions/api/admin/_middleware.js` using constant-time comparison.

### Auto-rejoin on page load

When a user returns to the planner, `attemptAutoRejoin()` checks localStorage for a valid session (tripCode, participantName, tripId, participantId). If found, it silently reconnects via `/api/join`, loads remote selections, sets up realtime polling. Has a 10-second timeout. On 404 (trip deleted), clears the stale session.

The `hasResumableSession()` check runs in `init()` — if a session exists, auto-rejoin handles the health check. Otherwise, `probeCloudHealth()` runs standalone. They never run simultaneously (this was a race condition that caused "save failed" errors).

### Local selection preservation

When joining a new trip, the current local selections are snapshotted. If the remote participant has no saved selections (brand new), the local ones are restored and auto-saved to cloud. But this only applies when the trip code AND participant name match the current identity — prevents User A's selections from bleeding into User B's session in the same browser.

### Polling with exponential backoff

`cloud-client.js` uses `setTimeout`-based polling (not `setInterval`) with backoff on failures: 8s → 16s → 32s → 60s cap. Resets on success or tab visibility change. Pauses when tab is hidden.

### Auto-save

Selections auto-save 4 seconds after the last change via `scheduleAutoSave()`. Triggered by `setSaveState("dirty")`. The explicit "Submit Availability" button calls `markSubmitted` in addition to saving (which unlocks group results).

---

## CSS Architecture

### Design Tokens

`:root` defines tokens for:
- **Colors:** Core palette (`--bg`, `--surface`, `--ink`, `--accent`) + semantic (`--ok-*`, `--warn-*`, `--info-*`)
- **Type scale:** `--text-xs` through `--text-2xl` (6 sizes)
- **Spacing:** `--sp-1` through `--sp-8` (4px grid)
- **Radius:** `--radius-sm/md/lg/pill`
- **Shadows:** `--shadow-sm/md/lg`

All have dark mode counterparts in `:root[data-theme="dark"]`.

### Visual model

- **Borderless elevation:** Cards use shadows, not borders. Week cards use a 4px left color bar for status (green=available, amber=maybe).
- **Typography hierarchy:** Headlines (weight 800), subtitles (weight 600, `--ink-soft`), labels (uppercase, tiny), body (normal).
- **Semantic colors:** Badges, checklist items, and status indicators use `--ok-*`, `--warn-*`, `--info-*` tokens that auto-adapt to dark mode.

### Theme system

`theme-init.js` runs on all pages before paint. Reads `calendar_planner_wizard_v1:theme` from localStorage, applies `data-theme` attribute, wires up any `#themeSelect` element. The planner's `app.js` has its own theme logic that coexists (both set the same attribute).

### Key CSS gotcha

`.step-panel` has `display: grid` which overrides the `[hidden]` attribute. The rule `.step-panel[hidden] { display: none; }` is required or all step panels show at once.

---

## Deployment

### Production branch

The Cloudflare Pages project uses `master` as its production branch. Deploying with `--branch master` updates the live site. Deploying with `--branch main` goes to preview only.

```bash
npx wrangler pages deploy . --project-name trip-week-planner --branch master
```

### Cache busting

All HTML files reference scripts/styles with a `?v=YYYYMMDD[letter]` suffix. This MUST be bumped when deploying changes to JS or CSS, otherwise the CDN serves stale files. The version string is manually maintained across `index.html`, `planner.html`, `admin.html`, and `about.html`.

### Secrets

```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name trip-week-planner
```

For local dev: `.dev.vars` (git-ignored).

### Migrations

Applied via wrangler before deploy:
```bash
npx wrangler d1 migrations apply trip-week-planner --remote
```

Three migrations exist:
1. `0001_init.sql` — Base schema
2. `0002_add_trip_locked.sql` — Lock column
3. `0003_flexible_windows.sql` — Widens trip_length to 2-14, removes week_format restriction

---

## Known Patterns & Pitfalls

1. **`renderAll()` is expensive** — rebuilds month bar, week cards, rank rows, checklist, and results on every state change. Works fine with 4-5 visible week cards but would need optimization if the grid showed all 52.

2. **Month-first filtering** — `state.selectedMonth` controls which weeks are shown. `renderWeekCards()` only renders weeks for that month. The month bar shows selection counts per month.

3. **`localStorage` is the session store** — Profile (trip code, name) and session data (selections, step, tripId, participantId) are stored in localStorage keyed by `calendar_planner_wizard_v1:session:{year}:{tripCode}:{name}`. The `safeSetItem` wrapper catches `QuotaExceededError`.

4. **The `beforeunload` handler** — Prompts the user if `saveState === "dirty"` to prevent data loss on tab close.

5. **XSS prevention** — All user-supplied names are escaped via `escapeHtml()` (DOM-based text node approach). The participant list uses `textContent` via DOM API. The week detail and leaderboard use `escapeHtml()` in template literals.

6. **Week card long-press** — Touch devices use a 500ms touchstart timer. `user-select: none` and `-webkit-touch-callout: none` prevent the native copy-paste callout. The context menu anchors to the card's status pill, not the touch coordinate.

7. **Rank unique constraint** — The DB has a unique index on `(participant_id, rank) WHERE rank IS NOT NULL`. The selections POST endpoint clears ALL ranks first, then upserts, to avoid constraint violations when moving ranks between weeks.

8. **Window config is admin-only** — The planner HTML has hidden dummy `<select>` elements for `windowStartInput` and `windowDaysInput` so app.js doesn't crash, but the UI is not shown. `renderWindowConfigControls()` is fully null-guarded.

---

## What's NOT done (future work)

- Full design token sweep — ~60% of hardcoded CSS values replaced with tokens, ~40% remain
- Day-strip grid rules for days 2-5 and 10-14 (CSS `.days-N` classes)
- Tests — zero unit, integration, or E2E tests exist
- TypeScript — no types, just JSDoc
- Error boundaries — JS errors can crash the entire IIFE
- WebSocket instead of polling
- Offline queue for failed saves
- Content-hashed filenames (eliminates manual cache busting)
- CORS headers (assumes same-origin)
- Rate limiting on API endpoints
