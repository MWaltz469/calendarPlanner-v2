PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  share_code TEXT NOT NULL UNIQUE,
  week_format TEXT NOT NULL DEFAULT 'sat_start' CHECK (week_format IN ('sat_start', 'sun_start')),
  trip_length INTEGER NOT NULL DEFAULT 7 CHECK (trip_length BETWEEN 6 AND 9),
  trip_year INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  submitted_at TEXT,
  last_active_step INTEGER NOT NULL DEFAULT 1 CHECK (last_active_step BETWEEN 1 AND 4),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (trip_id, name),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selections (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 52),
  status TEXT NOT NULL DEFAULT 'unselected' CHECK (status IN ('available', 'maybe', 'unselected')),
  rank INTEGER CHECK (rank IS NULL OR (rank BETWEEN 1 AND 5)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (participant_id, week_number),
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_selections_unique_rank_per_participant
  ON selections(participant_id, rank)
  WHERE rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_trip_id ON participants(trip_id);
CREATE INDEX IF NOT EXISTS idx_participants_submitted_at ON participants(submitted_at);
CREATE INDEX IF NOT EXISTS idx_selections_participant_id ON selections(participant_id);
CREATE INDEX IF NOT EXISTS idx_selections_week_number ON selections(week_number);
