ALTER TABLE devices ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE devices ADD COLUMN language TEXT NOT NULL DEFAULT 'ro';
ALTER TABLE devices ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  expires_at INTEGER NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  consent INTEGER NOT NULL CHECK (consent IN (0, 1)),
  created_at TEXT NOT NULL
);
