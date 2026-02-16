import {
  getDb,
  handleError,
  HttpError,
  json,
  newId,
  normalizeShareCode,
  normalizeStartDay,
  normalizeTripLength,
  normalizeYear,
  nowIso,
  readJson,
  seedTripModules
} from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const shareCode = normalizeShareCode(body.shareCode);
    const name = String(body.name || "").trim().slice(0, 120) || `${body.year || new Date().getUTCFullYear()} Group Trip`;
    const year = normalizeYear(body.year);
    const startDay = normalizeStartDay(body.startDay);
    const tripLength = normalizeTripLength(body.days);

    if (!shareCode) {
      throw new HttpError("shareCode is required.", 400);
    }

    const db = getDb(env);
    const now = nowIso();

    const existing = await db
      .prepare(`SELECT id FROM trips WHERE share_code = ? LIMIT 1`)
      .bind(shareCode)
      .first();

    if (existing) {
      throw new HttpError(`Trip code "${shareCode}" already exists.`, 409);
    }

    const tripId = newId();
    await db
      .prepare(
        `INSERT INTO trips (id, name, share_code, trip_year, week_format, trip_length, timezone, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(tripId, name, shareCode, year, `${startDay}_start`, tripLength, "UTC", now)
      .run();

    await seedTripModules(db, tripId, now);

    const trip = await db
      .prepare(`SELECT * FROM trips WHERE id = ? LIMIT 1`)
      .bind(tripId)
      .first();

    return json({ trip, created: true });
  } catch (error) {
    return handleError(error);
  }
}
