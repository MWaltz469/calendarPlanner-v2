const WINDOW_DAYS_MIN = 6;
const WINDOW_DAYS_MAX = 9;
const MAX_STEP = 4;
const STATUSES = new Set(["available", "maybe", "unselected"]);

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers
  });
}

export function getDb(env) {
  if (!env || !env.DB) {
    throw new HttpError("Database binding is missing.", 500);
  }
  return env.DB;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError("Invalid JSON body.", 400);
  }
}

export function collapseWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeShareCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 18);
}

export function normalizeName(value) {
  return collapseWhitespace(value).slice(0, 64);
}

export function normalizeYear(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return new Date().getUTCFullYear();
  }
  return parsed;
}

export function normalizeStartDay(value) {
  return value === "sun" ? "sun" : "sat";
}

export function normalizeTripLength(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return 7;
  }
  return Math.min(WINDOW_DAYS_MAX, Math.max(WINDOW_DAYS_MIN, parsed));
}

export function normalizeStep(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HttpError("Step must be an integer.", 400);
  }
  if (parsed < 1 || parsed > MAX_STEP) {
    throw new HttpError("Step must be between 1 and 4.", 400);
  }
  return parsed;
}

export function normalizeParticipantId(value) {
  const id = String(value || "").trim();
  if (!id) {
    throw new HttpError("participantId is required.", 400);
  }
  return id;
}

export function normalizeTripId(value) {
  const id = String(value || "").trim();
  if (!id) {
    throw new HttpError("tripId is required.", 400);
  }
  return id;
}

export function normalizeSelections(input) {
  if (!Array.isArray(input)) {
    throw new HttpError("selections must be an array.", 400);
  }

  const ranks = new Set();

  return input.map((entry) => {
    const weekNumber = Number(entry && entry.weekNumber);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 52) {
      throw new HttpError("Each selection must have weekNumber between 1 and 52.", 400);
    }

    const status = STATUSES.has(entry && entry.status) ? entry.status : "unselected";
    let rank = entry && entry.rank;
    rank = rank === null || rank === "" ? null : Number(rank);

    if (rank !== null) {
      if (!Number.isInteger(rank) || rank < 1 || rank > 5) {
        throw new HttpError("Rank must be null or between 1 and 5.", 400);
      }
      if (status !== "available") {
        throw new HttpError("Only available weeks can be ranked.", 400);
      }
      if (ranks.has(rank)) {
        throw new HttpError("Ranks must be unique.", 400);
      }
      ranks.add(rank);
    }

    return {
      weekNumber,
      status,
      rank
    };
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return crypto.randomUUID();
}

export function handleError(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return json({ error: "Unexpected server error." }, { status: 500 });
}
