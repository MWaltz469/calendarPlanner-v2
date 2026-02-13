import { getDb, handleError, json, normalizeTripId } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const tripId = normalizeTripId(url.searchParams.get("tripId"));
    const db = getDb(env);

    const participantsResult = await db
      .prepare(
        `SELECT id, name, submitted_at, last_active_step
         FROM participants
         WHERE trip_id = ?
         ORDER BY name ASC`
      )
      .bind(tripId)
      .all();

    const participants = participantsResult.results || [];
    if (!participants.length) {
      return json({ participants: [], selections: [] });
    }

    const participantIds = participants.map((participant) => participant.id);
    const placeholders = participantIds.map(() => "?").join(", ");
    const selectionsSql =
      `SELECT participant_id, week_number, status, rank ` +
      `FROM selections WHERE participant_id IN (${placeholders})`;

    const selectionsResult = await db.prepare(selectionsSql).bind(...participantIds).all();

    return json({
      participants,
      selections: selectionsResult.results || []
    });
  } catch (error) {
    return handleError(error);
  }
}
