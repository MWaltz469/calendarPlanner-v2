import { getDb, handleError, HttpError, json, normalizeParticipantId, nowIso, readJson } from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const participantId = normalizeParticipantId(body.participantId);
    const submittedAt = nowIso();
    const db = getDb(env);

    const result = await db
      .prepare(
        `UPDATE participants
         SET submitted_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(submittedAt, submittedAt, participantId)
      .run();

    if (!result.meta || result.meta.changes < 1) {
      throw new HttpError("Participant not found.", 404);
    }

    return json({ ok: true, submittedAt });
  } catch (error) {
    return handleError(error);
  }
}
