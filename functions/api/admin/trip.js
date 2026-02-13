import { getDb, handleError, HttpError, json, normalizeTripId, nowIso, readJson } from "../_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const tripId = normalizeTripId(url.searchParams.get("tripId"));
    const db = getDb(env);

    const trip = await db
      .prepare(
        `SELECT id, name, share_code, trip_year, week_format, trip_length, timezone, locked, created_at
         FROM trips WHERE id = ? LIMIT 1`
      )
      .bind(tripId)
      .first();

    if (!trip) {
      throw new HttpError("Trip not found.", 404);
    }

    const participantsResult = await db
      .prepare(
        `SELECT p.id, p.name, p.submitted_at, p.last_active_step, p.created_at, p.updated_at,
                COUNT(s.id) AS selection_count,
                SUM(CASE WHEN s.status = 'available' THEN 1 ELSE 0 END) AS available_count,
                SUM(CASE WHEN s.status = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
                SUM(CASE WHEN s.rank IS NOT NULL THEN 1 ELSE 0 END) AS ranked_count
         FROM participants p
         LEFT JOIN selections s ON s.participant_id = p.id
         WHERE p.trip_id = ?
         GROUP BY p.id
         ORDER BY p.name ASC`
      )
      .bind(tripId)
      .all();

    const participantIds = (participantsResult.results || []).map((p) => p.id);
    let selections = [];
    if (participantIds.length) {
      const placeholders = participantIds.map(() => "?").join(", ");
      const selectionsResult = await db
        .prepare(`SELECT participant_id, week_number, status, rank FROM selections WHERE participant_id IN (${placeholders})`)
        .bind(...participantIds)
        .all();
      selections = selectionsResult.results || [];
    }

    return json({
      trip,
      participants: participantsResult.results || [],
      selections
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const tripId = normalizeTripId(url.searchParams.get("tripId"));
    const body = await readJson(request);
    const db = getDb(env);

    const trip = await db
      .prepare(`SELECT id FROM trips WHERE id = ? LIMIT 1`)
      .bind(tripId)
      .first();

    if (!trip) {
      throw new HttpError("Trip not found.", 404);
    }

    const updates = [];
    const bindings = [];

    if (body.name !== undefined) {
      const name = String(body.name || "").trim().slice(0, 120);
      if (!name) throw new HttpError("Name cannot be empty.", 400);
      updates.push("name = ?");
      bindings.push(name);
    }

    if (body.locked !== undefined) {
      updates.push("locked = ?");
      bindings.push(body.locked ? 1 : 0);
    }

    if (!updates.length) {
      throw new HttpError("No fields to update.", 400);
    }

    bindings.push(tripId);
    await db
      .prepare(`UPDATE trips SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    return json({ ok: true });
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
