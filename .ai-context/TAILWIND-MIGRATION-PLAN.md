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

## Phases 4-7 — Component Classes (DEFERRED)

**Decision:** Component classes (`.btn`, `.badge`, `.field`, `.stepper-btn`, `.week-card`, `.month-btn`, `.lb-*`, `.hm-*`, `.admin-*`, etc.) are kept in CSS rather than converted to Tailwind utilities.

**Rationale:**
1. **Tailwind CDN has no `@apply`** — without a build step, component classes can't be composed from Tailwind utilities. Every `.btn` would become 10+ inline utility classes.
2. **JS coupling** — These classes are referenced throughout `app.js` (~2400 lines) and `admin.js` (~680 lines) via innerHTML templates. The JS adds/removes state variants (`.active`, `.complete`, `data-status`, `.month-active`, etc.) that are defined as CSS rules. Converting to Tailwind would require simultaneous JS refactoring.
3. **Readability** — `class="btn primary"` is far more readable than `class="inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border font-bold cursor-pointer bg-[--accent] text-white border-transparent hover:bg-[--accent-strong]"` in 50+ places.
4. **Risk** — Planner and admin are in active use by testers. Mass class replacement across HTML + JS has high regression risk with no functional benefit.

**Future path:** If the project migrates to a build step (Vite, etc.), `@apply` would allow defining these as Tailwind component classes. Until then, the CSS component system works well and coexists with Tailwind utility classes.

## Phase 8 — Cleanup (DONE)
- `styles.css` reduced from ~3100 to ~2100 lines (~1000 lines / 32% removed)
- Cache busting version: `?v=20260215tw`
- Tailwind handles: static page layout, global chrome (nav/footer), base components (btn/field/badge/hint/avatar), wizard chrome, stepper states, step panels, form grids, count cards, legend, overlay layout
- CSS handles: design tokens, state cascades (data-status, month-active, lb-active), pseudo-elements, keyframes, color-mix() effects, JS-generated component templates (week cards, leaderboard, heatmap, admin)

## Guardrails
- Do NOT change any API endpoints or database schema
- Do NOT remove personality elements (Vegeta, testimonials, vibecoded copy)
- Do NOT change the data flow (computeAggregates, getWeekBreakdown, polling)
- Preserve all element IDs referenced by JavaScript
- Test dark mode on every phase
