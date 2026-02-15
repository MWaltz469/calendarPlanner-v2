# TripWeek Design Decisions — Context for Future Sessions

## Decisions Made (Do Not Revisit)

### Dates-first, not week-numbers-first
The user explicitly requested dates as the primary human-readable anchor on the leaderboard and narrative. "One is not compelled to look at their calendar to say 'what week was that again?'" W## appears as secondary meta, not the hero text. Two independent AI audits recommended W##-first — the user overruled this based on UX testing.

### Maybe has zero scoring weight
`SCORE_MAP = { available: 100, maybe: 0, unselected: 0 }`. Maybe shows in the UI (heatmap amber, badges, week detail) but does not influence the leaderboard ranking. User explicitly requested this.

### Submission-aware aggregation
`getWeekBreakdown()` separates participants into `{available[], maybe[], unavailable[], notSubmitted[]}`. Non-submitted participants NEVER appear as "Unavailable." This was the #1 trust issue identified by two independent audits — people were booking trips thinking someone was unavailable when they simply hadn't responded.

### Warm heatmap color scale
Amber → orange → red. Not blue → teal → green. Follows thermal intuition ("cold to hot"). 5 discrete tiers, not continuous gradient. Better scanability at 10-15 people. Uses `color-mix()` in the current CSS; will switch to Tailwind tier classes.

### Natural language narrative
Both planner and admin show personalized narrative summaries instead of raw data tables. The planner version tells the viewer their personal status ("you're free" / "you're not available" / "you haven't submitted yet"). The admin version shows group completeness. Do NOT replace with structured cards — the narrative style is the product personality.

### Inline accordion for week detail
Week detail expands inside leaderboard rows (CSS grid-template-rows transition), not in a separate section at the bottom. Click handler toggles `.lb-item-open` on existing DOM — does NOT call renderResults() which would rebuild the DOM and kill the transition. Polling skips re-render when an accordion is open.

### Theme toggle is an icon button
Sun ☀ / Moon ☾ / Auto ◑ cycle button. NOT a dropdown select. `theme-init.js` handles both patterns (legacy select + new button) for backward compat.

### iOS touch-action: manipulation
Global rule on all `a, button, select, input` elements. Prevents the 350ms double-tap delay on iOS Safari that was causing the "About page requires two taps" bug.

### Copy reminder for pending participants
"Waiting on: Betsy, sUp" with a "Copy reminder" button that copies a pre-filled text message with the trip link. Clipboard API with toast feedback.

## Design Principles

### Personality is the brand
Vibecoded manifesto, Vegeta meme, fictional testimonials, joke stats ("0 meetings to plan a trip") — these are NOT bugs or unprofessional elements. They are the product identity. Do not soften or remove.

### Enterprise UX, vibecoded soul
The UI should feel as polished as a SaaS product sold to end users. The copy and personality should feel like it was made by friends for friends. The tension between these two is the brand.

### Destructive actions are isolated
Delete/Remove in danger zones with visual separation. Reset styled as destructive. Confirmation dialogs name the resource and state the consequence.

### Mobile-first results
On mobile, the information hierarchy is: narrative → leaderboard (with inline accordion) → collapsible heatmap → collapsible participants. Score snapshot hidden on mobile, visible on desktop.

### Tailwind CSS hybrid approach
Tailwind CDN (no build step) handles layout for static pages, global chrome, base components (btn, field, badge, hint, avatar), wizard/stepper system, and planner HTML components. JS-generated components (week cards, leaderboard, heatmap, admin) remain in `styles.css` because their template strings in app.js/admin.js generate HTML with CSS classes for state-dependent styling (data-status cascades, .month-active, .lb-active, .lb-item-open, color-mix() effects, CSS transitions). The CSS variable bridge (`text-[--ink]`, `bg-[--surface]`) connects Tailwind utilities to the existing token system for seamless dark mode.

## Known Technical Patterns

### Auto-save vs Submit
Selections auto-save to cloud 4 seconds after last change via `scheduleAutoSave()`. "Submit Availability" additionally calls `markSubmitted` which sets `submitted_at` and unlocks group results. The UI unifies vocabulary around "submit."

### Polling respects accordion state
The 8-second polling callback skips `renderResults()` if a leaderboard accordion is open (`els.leaderboard.querySelector(".lb-item-open")`). Data refreshes on next render after the user closes the accordion.

### Cache busting
All HTML files reference scripts/styles with `?v=YYYYMMDD[letter]` suffix. Must be bumped on deploy. Current: `?v=20260215s` (except changelog which is `?v=20260215z`). This will be removed in the Tailwind migration since Tailwind CDN handles its own caching.

### Rank uniqueness constraint
The DB has a unique index on `(participant_id, rank) WHERE rank IS NOT NULL`. The selections POST endpoint clears ALL ranks first, then upserts, to avoid constraint violations.

### `[hidden]` attribute vs CSS display
Any element with an explicit CSS `display` value (like `.badge { display: inline-flex }`) overrides the HTML `[hidden]` attribute. Must add `.badge[hidden] { display: none }` etc. This has bitten us twice.
