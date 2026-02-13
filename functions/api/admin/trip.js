import { getDb, handleError, HttpError, json, normalizeTripId } from "../_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const tripId = normalizeTripId(url.searchParams.get("tripId"));
    const db = getDb(env);

    const trip = await db
      .prepare(
        `SELECT id, name, share_code, trip_year, week_format, trip_length, timezone, created_at
         FROM trips WHERE id = ? LIMIT 1`
      )
      .bind(tripId)
      .first();

    if (!trip) {
      throw new HttpError("Trip not found.", 404);
    }

    const participantsResult = await db
      .prepare(
        `SELECT id, name, submitted_at, last_active_step, created_at, updated_at
         FROM participants WHERE trip_id = ? ORDER BY name ASC`
      )
      .bind(tripId)
      .all();

    return json({
      trip,
      participants: participantsResult.results || []
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const tripId = normalizeTripId(url.searchParams.get("tripId"));
    const db = getDb(env);

    const trip = await db
      .prepare(`SELECT id, share_code FROM trips WHERE id = ? LIMIT 1`)
      .bind(tripId)
      .first();

    if (!trip) {
      throw new HttpError("Trip not found.", 404);
    }

    await db.batch([
      db.prepare(`DELETE FROM selections WHERE participant_id IN (SELECT id FROM participants WHERE trip_id = ?)`).bind(tripId),
      db.prepare(`DELETE FROM participants WHERE trip_id = ?`).bind(tripId),
      db.prepare(`DELETE FROM trips WHERE id = ?`).bind(tripId)
    ]);

    return json({ ok: true, deleted: trip.share_code });
  } catch (error) {
    return handleError(error);
  }
}
