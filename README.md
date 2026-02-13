# Calendar Planner (Cloudflare + D1)

A 4-step group trip workflow:
1. Join Trip
2. Pick Weeks
3. Rank Top 5
4. Review and Save

This app is cloud-only and uses Cloudflare Pages Functions + D1 for shared attendee voting.

## Free-only notes
- Cloudflare account is required.
- Paid tier is not required for this project scale.
- Cloudflare free plan limits to keep in mind:
  - D1: 5 GB storage, 5M row reads/day, 100k row writes/day.
  - Workers: 100k requests/day.
  - Pages: 500 builds/month.

## Required credentials for one-click deploy
Use these in `./.env.deploy.local`:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

How to obtain them:
- Create/sign in to a free Cloudflare account.
- Create an API token with permissions sufficient for Cloudflare Pages + D1 management.
- Copy your Cloudflare Account ID from your Cloudflare dashboard.

You can start from template:
- `./.env.deploy.example`

Optional deploy settings file:
- `./deploy.config.json`
- Template: `./deploy.config.example.json`

## One-click deploy (non-interactive)
1. Install deps:
   - `npm install`
2. Copy credentials template and fill it:
   - `cp .env.deploy.example .env.deploy.local`
3. (Optional) copy deploy config template and set names:
   - `cp deploy.config.example.json deploy.config.json`
4. Run one command:
   - `npm run deploy:oneclick`

What this does:
- Validates credentials/auth.
- Finds or creates D1 DB.
- Updates `./wrangler.toml` (`name`, `APP_NAME`, `database_name`, `database_id`).
- Applies remote migrations.
- Ensures Pages project exists.
- Deploys production.
- Persists resolved values to `./deploy.config.json`.

## Redeploy
- Re-run:
  - `npm run deploy:oneclick`

## Destroy (guarded)
Interactive guarded destroy:
- `npm run destroy:cloud`

Non-interactive force destroy:
- `npm run destroy:cloud:yes`

Destroy mode:
- Deletes Cloudflare Pages project.
- Deletes D1 database.
- Resets `database_id` placeholder in `./wrangler.toml`.

## Alternative interactive deploy
If you prefer browser auth (`wrangler login`) over token credentials:
- `npm run deploy:cloud`

## Wrapper scripts
- macOS/Linux wrapper:
  - `./scripts/deploy-cloudflare.sh`
- Windows batch wrapper:
  - `./scripts/deploy-cloudflare.bat`

Both wrappers now run from project root, so they work even if launched from another directory.

## Runtime app config
Edit `./config.js`:

```js
window.CALENDAR_PLANNER_CONFIG = {
  apiBaseUrl: "/api",
  appYear: 2026,
  defaultWindowStartDay: "sat",
  defaultWindowDays: 7,
  themePreference: "system",
  themeTransitionMs: 220
};
```

Config keys:
- `apiBaseUrl`: API base path. Keep `"/api"` for same-origin Cloudflare deploy.
- `defaultWindowStartDay`: `"sat"` or `"sun"` for new trip defaults.
- `defaultWindowDays`: `6|7|8|9` for new trip defaults.
- `themePreference`: `"system"`, `"light"`, `"dark"`.
- `themeTransitionMs`: theme transition duration in ms (0-600).

## Local dev
- Start local Pages + Functions runtime:
  - `npm run cf:dev`

## API contract
- `POST /api/join` request `{shareCode,name,year,startDay,days}`
- `POST /api/progress` request `{participantId,step}`
- `POST /api/submit` request `{participantId}`
- `GET /api/selections?participantId=...`
- `POST /api/selections` request `{participantId,selections:[{weekNumber,status,rank}]}`
- `GET /api/group?tripId=...`
- `GET /api/health`

## Behavior notes
- Trip window config is chosen only when creating a new trip code.
- Existing trip codes lock to their stored settings.
- Week cards show explicit flow: `From <start> -> To <end>`.
- Day-strip chips are enlarged for readability.
- Sync updates use 8-second polling while visible.
- Voting is cloud-required. If cloud is down, submit/save is blocked until reconnect.
