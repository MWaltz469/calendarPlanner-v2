import {
  getDb,
  handleError,
  HttpError,
  json,
  newId,
  normalizeShareCode,
  normalizeTripId,
  nowIso,
  readJson
} from "../_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const sourceTripId = normalizeTripId(body.sourceTripId);
    const newShareCode = normalizeShareCode(body.newShareCode);

    if (!newShareCode) {
      throw new HttpError("newShareCode is required.", 400);
    }

    const db = getDb(env);
    const now = nowIso();

    const source = await db
      .prepare(`SELECT * FROM trips WHERE id = ? LIMIT 1`)
      .bind(sourceTripId)
      .first();

    if (!source) {
      throw new HttpError("Source trip not found.", 404);
    }

    const existing = await db
      .prepare(`SELECT id FROM trips WHERE share_code = ? LIMIT 1`)
      .bind(newShareCode)
      .first();

    if (existing) {
      throw new HttpError(`Trip code "${newShareCode}" already exists.`, 409);
    }

    const newName = String(body.name || "").trim().slice(0, 120) || source.name;
    const tripId = newId();

    await db
      .prepare(
        `INSERT INTO trips (id, name, share_code, trip_year, week_format, trip_length, timezone, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(tripId, newName, newShareCode, source.trip_year, source.week_format, source.trip_length, source.timezone, now)
      .run();

    const trip = await db
      .prepare(`SELECT * FROM trips WHERE id = ? LIMIT 1`)
      .bind(tripId)
      .first();

    return json({ trip, clonedFrom: source.share_code });
  } catch (error) {
    return handleError(error);
  }
}
