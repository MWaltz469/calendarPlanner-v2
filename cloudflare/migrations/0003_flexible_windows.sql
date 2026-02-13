-- SQLite doesn't support ALTER CHECK constraints, so we recreate the table.
-- D1 supports this via a migration sequence.

CREATE TABLE trips_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  share_code TEXT NOT NULL UNIQUE,
  trip_year INTEGER NOT NULL,
  week_format TEXT NOT NULL DEFAULT 'sat_start',
  trip_length INTEGER NOT NULL DEFAULT 7 CHECK (trip_length BETWEEN 2 AND 14),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO trips_new SELECT id, name, share_code, trip_year, week_format, trip_length, timezone, locked, created_at FROM trips;

DROP TABLE trips;

ALTER TABLE trips_new RENAME TO trips;

CREATE INDEX IF NOT EXISTS idx_trips_share_code ON trips(share_code);
