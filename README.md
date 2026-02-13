# Trip Week Planner

A free web app that helps groups coordinate trip availability. Share a trip code with your group, everyone picks the weeks they're free, ranks their top 5, and the app shows which weeks work best for the most people -- all in real time.

**How it works for your group:**
1. The organizer deploys the app (one-click, free, ~5 minutes).
2. The organizer creates a trip code in the **admin portal** (e.g. `BEACH2026`), choosing the start day and trip length.
3. The organizer shares the link with the group (e.g. `https://your-site.pages.dev/planner.html?trip=BEACH2026`).
4. Each person opens the link, enters their name, picks their available weeks, and submits.
5. Everyone can see the group results -- a heatmap showing overlap, a leaderboard of the best weeks, and who has submitted.

No accounts, no sign-ups, no app store. Just a link.

---

## Prerequisites

You need two things on your computer before deploying:

1. **Node.js** (version 18 or newer)
   - Download from [nodejs.org](https://nodejs.org/) -- pick the LTS version.
   - After installing, open a terminal and run `node --version` to confirm it works.

2. **A free Cloudflare account**
   - Sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
   - No credit card required. The free plan is more than enough for this app.

> **What is a terminal?**
> On macOS: open **Terminal** (search for it in Spotlight).
> On Windows: open **PowerShell** or **Command Prompt** from the Start menu.

---

## Deploy in 5 minutes

### Step 1: Get your Cloudflare credentials

You need two values from your Cloudflare dashboard: an **Account ID** and an **API Token**.

**Find your Account ID:**
1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. On the left sidebar, click **Workers & Pages**.
3. Your **Account ID** is shown on the right side of the overview page. Copy it.

**Create an API Token:**
1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Click **Create Token**.
3. Under **Custom token**, click **Get started**.
4. Name it something like `Trip Planner Deploy`.
5. Under **Permissions**, add these three rows:
   - `Account` / `Cloudflare Pages` / `Edit`
   - `Account` / `D1` / `Edit`
   - `Account` / `Workers Scripts` / `Edit`
6. Under **Account Resources**, select your account.
7. Click **Continue to summary**, then **Create Token**.
8. Copy the token. You won't be able to see it again.

### Step 2: Set up the project

Open a terminal, navigate to this project folder, and run:

```
npm install
```

Then create your credentials file:

```
cp .env.deploy.example .env.deploy.local
```

Open `.env.deploy.local` in any text editor and paste your values:

```
CLOUDFLARE_API_TOKEN=paste-your-token-here
CLOUDFLARE_ACCOUNT_ID=paste-your-account-id-here
```

Save the file. (This file is git-ignored and stays on your computer only.)

### Step 3: Deploy

Run one command:

```
npm run deploy:oneclick
```

This will:
- Validate your credentials.
- Create a D1 database (free serverless SQLite).
- Set up a Cloudflare Pages project.
- Apply database migrations.
- Deploy the app to production.

When it finishes, you'll see a live URL like:

```
https://trip-week-planner.pages.dev
```

### Step 4: Set the admin password

```bash
npx wrangler secret put ADMIN_PASSWORD --project-name trip-week-planner
```

Enter your chosen password at the prompt. This lets you access the admin portal.

---

## Typical workflow

### As the organizer

1. Open `https://your-site.pages.dev/admin.html` and sign in with your admin password.
2. Click **+ Create Trip** and set the trip code (e.g. `BEACH2026`), name, start day, and trip length.
3. Share the direct link with your group: `https://your-site.pages.dev/planner.html?trip=BEACH2026`
4. Monitor submissions in the admin portal -- see who's joined, who's submitted, and the group results.

### As a participant

1. Open the link the organizer shared (or go to the home page and enter the trip code).
2. Enter your name and click **Join Trip**.
3. **Pick Weeks** -- use the month tabs to navigate, click cards to mark Available or Maybe. Long-press or right-click for a direct status menu.
4. **Rank Top 5** (optional) -- use the dropdowns to rank your most preferred weeks.
5. **Review & Save** -- click **Submit Availability** to save your picks and unlock group results.

### Tips
- Your selections auto-save to the cloud a few seconds after each change.
- Click **Submit Availability** to finalize and unlock group results.
- The group results update in real time -- you can watch others submit.
- The theme picker in the top-right switches between light, dark, and system mode.

---

## App pages

| URL | Purpose |
|-----|---------|
| `/` | Landing page -- choose Join a Trip, enter a code, or go to Admin |
| `/planner.html` | The main planner (week selection, ranking, results) |
| `/planner.html?trip=CODE` | Direct join link with trip code pre-filled |
| `/admin.html` | Admin portal (create trips, manage participants, export data) |
| `/about.html` | About page |

---

## Admin portal

A password-protected admin page for managing trips and participants.

**Access:** Go to `https://your-site.pages.dev/admin.html` and enter the admin password.

**What you can do:**
- **Create trip codes** with preset start day, trip length, and name
- **View all trips** with participant counts and submission progress
- **Drill into any trip** to see participants, their selections, and group results
- **Lock/unlock a trip** to freeze joins and selection changes
- **Edit trip name** or **clone a trip** to a new code
- **Export trip data as CSV** for sharing offline
- **Reset a participant's submission** or **remove a participant**
- **Delete an entire trip** and all its data

---

## Redeploy after changes

To push updates to your live app, just run the same command again:

```
npm run deploy:oneclick
```

---

## Tear down / delete everything

If you want to completely remove the app and database from Cloudflare:

```
npm run destroy:cloud
```

This will ask you to confirm by typing the project name. It deletes:
- The Cloudflare Pages project (your live site).
- The D1 database (all trip data).

---

## Alternative: interactive deploy (browser login)

If you prefer logging in through the browser instead of using an API token:

```
npm run deploy:cloud
```

This opens a browser window for Cloudflare authentication instead of using credentials from `.env.deploy.local`.

---

## Local development

To run the app locally with a local database:

```
npm install
npm run cf:dev
```

This starts a local server (typically at `http://localhost:8788`) with a local D1 database.

For local admin access, create a `.dev.vars` file (git-ignored):

```
ADMIN_PASSWORD=localdevpassword
```

---

## Configuration reference

Edit `config.js` to change app defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `apiBaseUrl` | `"/api"` | API path. Keep as-is for Cloudflare deploys. |
| `appYear` | `2026` | The planning year shown in the UI. |
| `defaultWindowStartDay` | `"sat"` | Default trip window start: any weekday (`"mon"` through `"sun"`). |
| `defaultWindowDays` | `7` | Default trip length in days (2--14). |
| `themePreference` | `"system"` | Default theme: `"system"`, `"light"`, or `"dark"`. |
| `themeTransitionMs` | `220` | Theme switch animation speed in milliseconds. |

---

## Cloudflare free plan limits

This app is designed to run entirely within the free tier:

| Resource | Free limit | Typical usage |
|----------|-----------|---------------|
| D1 storage | 5 GB | A few KB per trip |
| D1 reads | 5M rows/day | ~100 per page load |
| D1 writes | 100K rows/day | ~52 per save |
| Workers requests | 100K/day | 1 per API call |
| Pages builds | 500/month | 1 per deploy |

---

## Troubleshooting

**"Trip code not found" when joining**
- Trip codes must be created by the organizer in the admin portal first. Ask your organizer for the correct code.

**"Cloud unavailable" badge after deploy**
- Check that your Cloudflare Pages project is listed at [dash.cloudflare.com](https://dash.cloudflare.com) under Workers & Pages.
- Make sure the D1 database binding is set. Re-running `npm run deploy:oneclick` usually fixes this.

**Deploy fails with "authentication" errors**
- Double-check your API token and Account ID in `.env.deploy.local`.
- Make sure the token has all three permissions listed in Step 1 above.
- Tokens expire if you set an expiration date -- create a new one if needed.

**"Join Trip" button spins forever**
- The API may not be deployed yet. Wait a minute after deploy and refresh.
- Check the browser console (F12) for network errors.

**Changes aren't showing after redeploy**
- Hard refresh the page: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows).
- Cloudflare may cache assets briefly. Changes typically appear within 1--2 minutes.

---

## API reference (for developers)

| Endpoint | Method | Body / Query |
|----------|--------|--------------|
| `/api/health` | GET | -- |
| `/api/join` | POST | `{shareCode, name}` |
| `/api/selections` | GET | `?participantId=...` |
| `/api/selections` | POST | `{participantId, selections: [{weekNumber, status, rank}]}` |
| `/api/submit` | POST | `{participantId}` |
| `/api/progress` | POST | `{participantId, step}` |
| `/api/group` | GET | `?tripId=...` |
| `/api/admin/trips` | GET | (auth required) |
| `/api/admin/trip` | GET/PATCH/DELETE | `?tripId=...` (auth required) |
| `/api/admin/participant` | DELETE/PATCH | `?participantId=...` (auth required) |
| `/api/admin/create-trip` | POST | `{shareCode, name, year, startDay, days}` (auth required) |
| `/api/admin/clone-trip` | POST | `{sourceTripId, newShareCode, name}` (auth required) |
