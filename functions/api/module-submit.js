import {
  getDb,
  handleError,
  HttpError,
  json,
  newId,
  normalizeModuleId,
  normalizeParticipantId,
  normalizeJsonPayload,
  nowIso,
  readJson
} from "./_lib.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await readJson(request);
    const moduleId = normalizeModuleId(body.moduleId);
    const participantId = normalizeParticipantId(body.participantId);
    const payloadStr = normalizeJsonPayload(body.payload);
    const now = nowIso();

    const db = getDb(env);

    const mod = await db
      .prepare("SELECT id, trip_id, status, type FROM modules WHERE id = ? LIMIT 1")
      .bind(moduleId)
      .first();

    if (!mod) {
      throw new HttpError("Module not found.", 404);
    }

    if (mod.status === "locked") {
      throw new HttpError("This module is locked. Submissions are not accepted.", 403);
    }

    const participant = await db
      .prepare("SELECT id FROM participants WHERE id = ? AND trip_id = ? LIMIT 1")
      .bind(participantId, mod.trip_id)
      .first();

    if (!participant) {
      throw new HttpError("Participant not found in this trip.", 404);
    }

    const existing = await db
      .prepare("SELECT id FROM module_submissions WHERE module_id = ? AND participant_id = ? LIMIT 1")
      .bind(moduleId, participantId)
      .first();

    if (existing) {
      await db
        .prepare(
          "UPDATE module_submissions SET payload = ?, submitted_at = ?, updated_at = ? WHERE id = ?"
        )
        .bind(payloadStr, now, now, existing.id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO module_submissions (id, module_id, participant_id, payload, submitted_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(newId(), moduleId, participantId, payloadStr, now, now, now)
        .run();
    }

    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
