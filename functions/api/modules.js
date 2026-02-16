import { getDb, handleError, HttpError, json, normalizeTripId } from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const tripId = normalizeTripId(url.searchParams.get("tripId"));
    const db = getDb(env);

    const trip = await db
      .prepare("SELECT id FROM trips WHERE id = ? LIMIT 1")
      .bind(tripId)
      .first();

    if (!trip) {
      throw new HttpError("Trip not found.", 404);
    }

    const modulesResult = await db
      .prepare(
        `SELECT m.id, m.trip_id, m.type, m.status, m.config, m.decision, m.sort_order, m.created_at,
                COUNT(ms.id) AS submission_count,
                SUM(CASE WHEN ms.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted_count
         FROM modules m
         LEFT JOIN module_submissions ms ON ms.module_id = m.id
         WHERE m.trip_id = ?
         GROUP BY m.id
         ORDER BY m.sort_order ASC`
      )
      .bind(tripId)
      .all();

    const participantCount = await db
      .prepare("SELECT COUNT(*) AS cnt FROM participants WHERE trip_id = ?")
      .bind(tripId)
      .first();

    return json({
      modules: (modulesResult.results || []).map((m) => ({
        ...m,
        config: safeParseJson(m.config),
        decision: safeParseJson(m.decision)
      })),
      participantCount: participantCount ? participantCount.cnt : 0
    });
  } catch (error) {
    return handleError(error);
  }
}

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
