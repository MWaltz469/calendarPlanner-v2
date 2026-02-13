import { json } from "../_lib.js";

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequest(context) {
  const { env, request } = context;
  const adminPassword = String(env.ADMIN_PASSWORD || "").trim();

  if (!adminPassword) {
    return json({ error: "Admin access is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const provided = match ? match[1].trim() : "";

  if (!provided || !constantTimeEqual(provided, adminPassword)) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  return await context.next();
}
