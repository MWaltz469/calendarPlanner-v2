import {
  getDb,
  handleError,
  HttpError,
  json,
  newId,
  normalizeName,
  normalizeShareCode,
  normalizeStartDay,
  normalizeTripLength,
  normalizeYear,
  nowIso,
  readJson
} from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const shareCode = normalizeShareCode(body.shareCode);
    const name = normalizeName(body.name);
    const year = normalizeYear(body.year);
    const startDay = normalizeStartDay(body.startDay);
    const tripLength = normalizeTripLength(body.days);

    if (!shareCode || !name) {
      throw new HttpError("shareCode and name are required.", 400);
    }

    const db = getDb(env);
    const now = nowIso();

    let trip = await db
      .prepare(
        `SELECT id, name, share_code, trip_year, week_format, trip_length, timezone, locked
         FROM trips
         WHERE share_code = ?
         LIMIT 1`
      )
      .bind(shareCode)
      .first();

    let created = false;
    if (!trip) {
      const tripId = newId();
      const timezone = request.cf && request.cf.timezone ? request.cf.timezone : "UTC";
      try {
        await db
          .prepare(
            `INSERT INTO trips (
               id, name, share_code, trip_year, week_format, trip_length, timezone, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            tripId,
            `${year} Group Trip`,
            shareCode,
            year,
            startDay === "sun" ? "sun_start" : "sat_start",
            tripLength,
            timezone,
            now
          )
          .run();

        created = true;
      } catch (insertError) {
        const msg = String(insertError && insertError.message || "").toLowerCase();
        if (!msg.includes("unique") && !msg.includes("constraint")) {
          throw insertError;
        }
        // Another request may have created the same share code concurrently.
      }

      trip = await db
        .prepare(
          `SELECT id, name, share_code, trip_year, week_format, trip_length, timezone
           FROM trips
           WHERE share_code = ?
           LIMIT 1`
        )
        .bind(shareCode)
        .first();
    }

    if (!trip) {
      throw new HttpError("Could not create or load trip.", 500);
    }

    let participant = await db
      .prepare(
        `SELECT id, name, submitted_at, last_active_step
         FROM participants
         WHERE trip_id = ? AND name = ?
         LIMIT 1`
      )
      .bind(trip.id, name)
      .first();

    if (!participant && trip.locked) {
      throw new HttpError("This trip is locked. New participants cannot join.", 403);
    }

    if (!participant) {
      try {
        await db
          .prepare(
            `INSERT INTO participants (
               id, trip_id, name, submitted_at, last_active_step, created_at, updated_at
             ) VALUES (?, ?, ?, NULL, 1, ?, ?)`
          )
          .bind(newId(), trip.id, name, now, now)
          .run();
      } catch (insertError) {
        const msg = String(insertError && insertError.message || "").toLowerCase();
        if (!msg.includes("unique") && !msg.includes("constraint")) {
          throw insertError;
        }
        // Another request may have created the same participant concurrently.
      }

      participant = await db
        .prepare(
          `SELECT id, name, submitted_at, last_active_step
           FROM participants
           WHERE trip_id = ? AND name = ?
           LIMIT 1`
        )
        .bind(trip.id, name)
        .first();
    }

    if (!participant) {
      throw new HttpError("Could not create or load participant.", 500);
    }

    const selectionsResult = await db
      .prepare(
        `SELECT week_number, status, rank
         FROM selections
         WHERE participant_id = ?
         ORDER BY week_number ASC`
      )
      .bind(participant.id)
      .all();

    return json({
      trip,
      participant,
      selections: selectionsResult.results || [],
      created
    });
  } catch (error) {
    return handleError(error);
  }
}
