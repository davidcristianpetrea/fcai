CREATE TABLE IF NOT EXISTS upload_chunks (
  asset_id TEXT NOT NULL REFERENCES assets(id),
  kind TEXT NOT NULL CHECK (kind IN ('media', 'thumb')),
  chunk_index INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, kind, chunk_index)
);
