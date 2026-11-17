ALTER TABLE leads ADD COLUMN device_id TEXT REFERENCES devices(id);
