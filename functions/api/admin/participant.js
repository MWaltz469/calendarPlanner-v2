import { getDb, handleError, HttpError, json, normalizeParticipantId, nowIso } from "../_lib.js";

export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const participantId = normalizeParticipantId(url.searchParams.get("participantId"));
    const db = getDb(env);

    const participant = await db
      .prepare(`SELECT id, name FROM participants WHERE id = ? LIMIT 1`)
      .bind(participantId)
      .first();

    if (!participant) {
      throw new HttpError("Participant not found.", 404);
    }

    await db.batch([
      db.prepare(`DELETE FROM selections WHERE participant_id = ?`).bind(participantId),
      db.prepare(`DELETE FROM participants WHERE id = ?`).bind(participantId)
    ]);

    return json({ ok: true, deleted: participant.name });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const participantId = normalizeParticipantId(url.searchParams.get("participantId"));
    const db = getDb(env);

    const result = await db
      .prepare(
        `UPDATE participants SET submitted_at = NULL, updated_at = ? WHERE id = ?`
      )
      .bind(nowIso(), participantId)
      .run();

    if (!result.meta || result.meta.changes < 1) {
      throw new HttpError("Participant not found.", 404);
    }

    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
