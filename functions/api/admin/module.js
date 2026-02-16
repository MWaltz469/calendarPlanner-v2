import {
  getDb,
  handleError,
  HttpError,
  json,
  normalizeModuleId,
  normalizeModuleStatus,
  normalizeJsonPayload,
  nowIso,
  readJson
} from "../_lib.js";

export async function onRequestPatch(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const moduleId = normalizeModuleId(url.searchParams.get("moduleId"));
    const body = await readJson(request);
    const db = getDb(env);

    const mod = await db
      .prepare("SELECT id FROM modules WHERE id = ? LIMIT 1")
      .bind(moduleId)
      .first();

    if (!mod) {
      throw new HttpError("Module not found.", 404);
    }

    const updates = [];
    const bindings = [];

    if (body.status !== undefined) {
      const status = normalizeModuleStatus(body.status);
      updates.push("status = ?");
      bindings.push(status);
    }

    if (body.config !== undefined) {
      updates.push("config = ?");
      bindings.push(normalizeJsonPayload(body.config));
    }

    if (body.decision !== undefined) {
      updates.push("decision = ?");
      bindings.push(body.decision === null ? null : normalizeJsonPayload(body.decision));
    }

    if (!updates.length) {
      throw new HttpError("No fields to update.", 400);
    }

    bindings.push(moduleId);
    await db
      .prepare(`UPDATE modules SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const moduleId = normalizeModuleId(url.searchParams.get("moduleId"));
    const db = getDb(env);

    const mod = await db
      .prepare("SELECT id, type FROM modules WHERE id = ? LIMIT 1")
      .bind(moduleId)
      .first();

    if (!mod) {
      throw new HttpError("Module not found.", 404);
    }

    await db.batch([
      db.prepare("DELETE FROM module_submissions WHERE module_id = ?").bind(moduleId),
      db.prepare("DELETE FROM modules WHERE id = ?").bind(moduleId)
    ]);

    return json({ ok: true, deleted: mod.type });
  } catch (error) {
    return handleError(error);
  }
}
