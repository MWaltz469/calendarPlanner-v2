import {
  getDb,
  handleError,
  HttpError,
  json,
  normalizeModuleId,
  normalizeParticipantId
} from "./_lib.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const moduleId = normalizeModuleId(url.searchParams.get("moduleId"));
    const db = getDb(env);

    const mod = await db
      .prepare(
        `SELECT id, trip_id, type, status, config, decision, sort_order, created_at
         FROM modules WHERE id = ? LIMIT 1`
      )
      .bind(moduleId)
      .first();

    if (!mod) {
      throw new HttpError("Module not found.", 404);
    }

    const submissionsResult = await db
      .prepare(
        `SELECT ms.id, ms.participant_id, ms.payload, ms.submitted_at, ms.updated_at,
                p.name AS participant_name
         FROM module_submissions ms
         JOIN participants p ON p.id = ms.participant_id
         WHERE ms.module_id = ?
         ORDER BY p.name ASC`
      )
      .bind(moduleId)
      .all();

    return json({
      module: {
        ...mod,
        config: safeParseJson(mod.config),
        decision: safeParseJson(mod.decision)
      },
      submissions: (submissionsResult.results || []).map((s) => ({
        ...s,
        payload: safeParseJson(s.payload)
      }))
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
