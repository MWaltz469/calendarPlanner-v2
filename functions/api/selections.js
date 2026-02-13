import {
  getDb,
  handleError,
  HttpError,
  json,
  newId,
  normalizeParticipantId,
  normalizeSelections,
  nowIso,
  readJson
} from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const participantId = normalizeParticipantId(url.searchParams.get("participantId"));
    const db = getDb(env);

    const rows = await db
      .prepare(
        `SELECT week_number, status, rank
         FROM selections
         WHERE participant_id = ?
         ORDER BY week_number ASC`
      )
      .bind(participantId)
      .all();

    return json({ rows: rows.results || [] });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const participantId = normalizeParticipantId(body.participantId);
    const selections = normalizeSelections(body.selections);
    const db = getDb(env);
    const now = nowIso();

    const participant = await db
      .prepare(`SELECT id FROM participants WHERE id = ? LIMIT 1`)
      .bind(participantId)
      .first();

    if (!participant) {
      throw new HttpError("Participant not found.", 404);
    }

    if (!selections.length) {
      return json({ ok: true });
    }

    const clearRanks = db
      .prepare(
        `UPDATE selections SET rank = NULL, updated_at = ?
         WHERE participant_id = ? AND rank IS NOT NULL`
      )
      .bind(now, participantId);

    const upserts = selections.map((selection) =>
      db
        .prepare(
          `INSERT INTO selections (
             id, participant_id, week_number, status, rank, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(participant_id, week_number)
           DO UPDATE SET
             status = excluded.status,
             rank = excluded.rank,
             updated_at = excluded.updated_at`
        )
        .bind(
          newId(),
          participantId,
          selection.weekNumber,
          selection.status,
          selection.rank,
          now,
          now
        )
    );

    await db.batch([clearRanks, ...upserts]);
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
