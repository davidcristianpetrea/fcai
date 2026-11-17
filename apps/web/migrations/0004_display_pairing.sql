CREATE TABLE IF NOT EXISTS pair_requests (
  device_id TEXT PRIMARY KEY REFERENCES devices(id),
  code TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  bound_at TEXT,
  created_at TEXT NOT NULL
);
