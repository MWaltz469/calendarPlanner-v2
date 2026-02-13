import { getDb, handleError, json } from "../_lib.js";

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const db = getDb(env);

    const result = await db
      .prepare(
        `SELECT t.id, t.name, t.share_code, t.trip_year, t.week_format, t.trip_length,
                t.timezone, t.created_at,
                COUNT(p.id) AS participant_count,
                SUM(CASE WHEN p.submitted_at IS NOT NULL THEN 1 ELSE 0 END) AS submitted_count
         FROM trips t
         LEFT JOIN participants p ON p.trip_id = t.id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      )
      .all();

    return json({ trips: result.results || [] });
  } catch (error) {
    return handleError(error);
  }
}
