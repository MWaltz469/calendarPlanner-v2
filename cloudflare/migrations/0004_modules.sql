CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('when','budget','preferences','destination','book-it','split')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','decided')),
  config TEXT NOT NULL DEFAULT '{}',
  decision TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(trip_id, type),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS module_submissions (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(module_id, participant_id),
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_modules_trip_id ON modules(trip_id);
CREATE INDEX IF NOT EXISTS idx_module_submissions_module_id ON module_submissions(module_id);
CREATE INDEX IF NOT EXISTS idx_module_submissions_participant_id ON module_submissions(participant_id);
