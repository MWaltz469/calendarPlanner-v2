# Tailwind CSS Migration Plan

## Current State
- Tailwind CDN play script added to all 5 HTML pages (Phase 1 complete)
- `tailwind.config.js` configured with brand colors, fonts, dark mode via `[data-theme="dark"]`
- **Phase 2 complete:** Nav bar, hero card, footer migrated to Tailwind across all pages (~80 lines CSS deleted)
- **Phase 3 complete:** Landing, about, changelog pages fully migrated to Tailwind (~420 lines CSS deleted)
- `styles.css` (~2550 lines) still serves planner/admin/component styling
- Both coexist with CSS variable bridge (`text-[--ink]`, `bg-[--surface]`, etc.)

## Migration Strategy
Incremental: migrate one section at a time, delete corresponding CSS as we go. Each phase is a commit. Old CSS and Tailwind coexist throughout migration.

## Tailwind Config
```js
darkMode: ['selector', '[data-theme="dark"]']
colors.brand: TripWeek teal (#0f766e) with full shade scale
fontFamily.display: Sora (headings, brand)
fontFamily.body: Manrope (everything else)
```

## Color Mapping (existing → Tailwind)
| Current Token | Tailwind Equivalent | Usage |
|--------------|-------------------|-------|
| `--bg` | `bg-slate-50` / `dark:bg-slate-900` | Page background |
| `--surface` | `bg-white` / `dark:bg-slate-800` | Card backgrounds |
| `--surface-muted` | `bg-slate-50` / `dark:bg-slate-800/50` | Nested surfaces |
| `--ink` | `text-slate-900` / `dark:text-slate-100` | Primary text |
| `--ink-soft` | `text-slate-500` / `dark:text-slate-400` | Secondary text |
| `--accent` | `text-brand` / `bg-brand` | Primary accent |
| `--available` / `--ok-*` | `green-*` variants | Available state |
| `--maybe` / `--warn-*` | `amber-*` variants | Maybe state |
| `--danger` | `red-*` variants | Destructive |
| `--neutral-*` | `slate-*` variants | Unselected/pending |
| `--border` | `border-slate-200` / `dark:border-slate-700` | Card borders |

## Heatmap Heat Tiers (replaces continuous color-mix)
```
0 people:  bg-slate-100 dark:bg-slate-800 text-slate-400
1-25%:     bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200
26-50%:    bg-orange-200 dark:bg-orange-800/50 text-orange-800 dark:text-orange-100
51-75%:    bg-red-200 dark:bg-red-800/60 text-red-800 dark:text-red-100
76-100%:   bg-red-500 dark:bg-red-600 text-white font-bold
Maybe:     bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300
```

## Avatar Colors (Tailwind classes)
```js
const AVATAR_COLORS = [
  'bg-teal-600', 'bg-blue-600', 'bg-violet-600', 'bg-fuchsia-600',
  'bg-pink-600', 'bg-red-600', 'bg-orange-600', 'bg-amber-600',
  'bg-lime-600', 'bg-emerald-600'
];
```

## Phase 2 — Global Chrome (DONE)
Nav bar, hero card, footer migrated to Tailwind on all 5 pages. Uses CSS variable bridge for colors.

## Phase 3 — Landing + About + Changelog (DONE)
Full rewrite of static page markup to Tailwind. All `.landing-*`, `.changelog-*`, `.about-*` CSS deleted.

## Phase 4 — Base Components
Rewrite in both HTML and JS template strings:
- `.btn` / `.btn-sm` / `.btn-lg` / `.btn.primary` / `.btn.danger`
- `.field` / `.field input` / `.field select`
- `.badge` variants
- `.wd-badge` / `.lb-stat` / `.status-pill` / `.rank-pill`
- `.avatar`
- `.review-checklist` / `.checklist-icon`

JS files to update: `app.js` (avatarHtml, statusBadge, rankLabel, all innerHTML templates), `admin.js` (similar).

## Phase 5 — Planner Steps 1-3
- `.wizard`, `.stepper`, `.stepper-btn`
- `.step-panel`, `.step-copy`
- `.form-grid`, `.field`
- `.count-row`, `.count-card`
- `.legend`, `.dot`
- `.selection-overlay`, `.ov-*`
- `.month-bar`, `.month-btn`
- `.week-grid`, `.week-card`, `.wc-*`
- `.day-strip`
- `.rank-rows`, `.rank-row`, `.rank-chip`, `.rank-select`
- `.week-context-menu`

## Phase 6 — Planner Step 4 Results
- `.results`, `.results-card`, `.results-narrative`
- `.results-collapsible`, `.results-collapsible-toggle`
- `.admin-narrative`, `.admin-narrative-lead/detail/pending`
- `.score-chips`, `.score-chip`
- `.heatmap`, `.hm-*` (replace color-mix with tier classes)
- `.heat-popover`, `.hp-*`
- `.leaderboard`, `.lb-*` (including accordion)
- `.participant-list`
- `.participant-nudge`

## Phase 7 — Admin
- `.admin-login-card`, `.admin-login-form`
- `.admin-stats-bar`, `.admin-stats`
- `.admin-section-header`, `.admin-header-actions`
- `.admin-create-form`
- `.admin-trip-row`, `.admin-trip-row-*`
- `.admin-participant-row`, `.admin-participant-*`
- `.admin-actions-grid`, `.admin-action-item`, `.admin-action-hint`
- `.admin-danger-zone`
- `.admin-detail-chips`
- `.admin-results`, `.admin-leaderboard`
- `.admin-actions-collapsible`, `.admin-actions-toggle`
- `.admin-search-input`
- Admin narrative (same classes as planner)

## Phase 8 — Cleanup
- Delete `styles.css` or reduce to <50 lines (keyframe animations, print styles)
- Remove all `?v=` cache busting params (Tailwind CDN handles its own caching)
- Final visual audit across all pages + both themes
- Update ARCHITECTURE.md

## Guardrails
- Do NOT change any API endpoints or database schema
- Do NOT remove personality elements (Vegeta, testimonials, vibecoded copy)
- Do NOT change the data flow (computeAggregates, getWeekBreakdown, polling)
- Preserve all element IDs referenced by JavaScript
- Test dark mode on every phase
