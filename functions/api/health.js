import { getDb, handleError, json } from "./_lib.js";

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const db = getDb(env);
    await db.prepare("SELECT 1").first();
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
