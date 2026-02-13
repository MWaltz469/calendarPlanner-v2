import { getDb, handleError, HttpError, json, normalizeParticipantId, normalizeStep, nowIso, readJson } from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const participantId = normalizeParticipantId(body.participantId);
    const step = normalizeStep(body.step);
    const db = getDb(env);

    const result = await db
      .prepare(
        `UPDATE participants
         SET last_active_step = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(step, nowIso(), participantId)
      .run();

    if (!result.meta || result.meta.changes < 1) {
      throw new HttpError("Participant not found.", 404);
    }

    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
