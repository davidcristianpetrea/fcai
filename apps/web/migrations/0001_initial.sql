CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  device_secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  last_status TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('admin', 'device')),
  device_id TEXT REFERENCES devices(id),
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL CHECK (locale IN ('en', 'ro')),
  image_key TEXT,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id),
  device_id TEXT NOT NULL REFERENCES devices(id),
  redeemed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(subject);
CREATE INDEX IF NOT EXISTS idx_offers_active_locale ON offers(active, locale);
CREATE INDEX IF NOT EXISTS idx_redemptions_offer ON redemptions(offer_id);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'deleted')),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS offer_assets (
  offer_id TEXT NOT NULL REFERENCES offers(id),
  asset_id TEXT NOT NULL REFERENCES assets(id),
  PRIMARY KEY (offer_id, asset_id)
);
CREATE TABLE IF NOT EXISTS upload_tokens (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  kind TEXT NOT NULL CHECK (kind IN ('media', 'thumb')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_deleted ON assets(state, deleted_at);
