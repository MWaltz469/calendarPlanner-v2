# TripWeek Project State — Feb 15, 2026

## What This Is
A serverless group trip coordination app. Participants pick available weeks, rank favorites, app computes group overlap in real time. Admin portal for trip management.

**Stack:** Vanilla JS (no framework), Cloudflare Pages + Functions, D1 (SQLite), no build step.
**Tailwind CSS CDN** handles ALL component styling. Migration complete (Phases 2-8). `styles.css` reduced to ~320 lines (design tokens + global resets + keyframes). All component classes converted to Tailwind utility strings in HTML and JS TW constant objects.

## Live URL
`https://trip-week-planner.pages.dev`

## Repo
`github.com/MWaltz469/calendarPlanner-v2` — branch `main` auto-deploys via GitHub Actions.

## Pages
| URL | File | Purpose |
|-----|------|---------|
| `/` | `index.html` | Landing page — SaaS-style with hero, features, testimonials, CTAs |
| `/planner.html` | `planner.html` | 4-step wizard: Join → Pick Weeks → Rank → Review & Submit |
| `/admin.html` | `admin.html` | Password-gated admin portal for trip management |
| `/about.html` | `about.html` | Vibecoded manifesto + Vegeta meme |
| `/changelog.html` | `changelog.html` | Date-based changelog |

## Key Files
| File | Purpose | Lines |
|------|---------|-------|
| `app.js` | Planner IIFE — all client logic (~2400 lines) |
| `admin.js` | Admin portal logic (~680 lines) |
| `cloud-client.js` | PlannerBackend class — API client + polling |
| `config.js` | Runtime config (year, defaults) |
| `theme-init.js` | Theme bootstrap — sun/moon/auto cycle toggle |
| `styles.css` | All styles (~3100 lines) — TO BE REPLACED BY TAILWIND |
| `tailwind.config.js` | Tailwind CDN config — brand colors, fonts, dark mode |
| `functions/api/` | Cloudflare Functions — REST API |

## Database Schema (D1/SQLite)
- **trips**: id, name, share_code, trip_year, week_format, trip_length, timezone, locked, created_at
- **participants**: id, trip_id, name, submitted_at, last_active_step, created_at, updated_at
- **selections**: id, participant_id, week_number, status (available/maybe/unselected), rank (1-5 or null)

## Authentication
- **Participants:** Trip code + name. No passwords. Same name on same trip = same participant.
- **Admin:** `ADMIN_PASSWORD` Cloudflare secret. Bearer token via Authorization header. Current password: `12345678`.

## Deploy
- Push to `main` → GitHub Actions → wrangler d1 migrations + wrangler pages deploy
- Secrets in GitHub: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ADMIN_PASSWORD`

## Active Beta Testers
7 people actively using the app with trip code `INTL2026`. Do NOT delete this trip or its data.
