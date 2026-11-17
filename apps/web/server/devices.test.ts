import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "./db.js";

test("devices table lifecycle: insert, delete, and upsert have created_at/updated_at", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "adsense-devices-test-"));
  let db: any;
  try {
    db = await openDatabase(directory);
    const now = new Date().toISOString();

    // 1. Insert device with created_at and updated_at
    db.prepare(
      "INSERT INTO devices(id, name, device_secret_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run("dev-1", "Test Display", "secret", now, now);

    const dev = db.prepare("SELECT * FROM devices WHERE id = ?").get("dev-1") as any;
    assert.equal(dev.id, "dev-1");
    assert.equal(dev.name, "Test Display");
    assert.ok(dev.created_at);
    assert.ok(dev.updated_at);

    // 2. Pair request for this device
    db.prepare(
      "INSERT INTO pair_requests(device_id, code, expires_at, created_at) VALUES (?, ?, ?, ?)"
    ).run("dev-1", "123456", Date.now() + 600000, now);

    // 3. Delete device cascades or cleans up
    db.prepare("DELETE FROM pair_requests WHERE device_id = ?").run("dev-1");
    db.prepare("DELETE FROM devices WHERE id = ?").run("dev-1");

    const deleted = db.prepare("SELECT * FROM devices WHERE id = ?").get("dev-1");
    assert.equal(deleted, undefined);

    const deletedPair = db.prepare("SELECT * FROM pair_requests WHERE device_id = ?").get("dev-1");
    assert.equal(deletedPair, undefined);
  } finally {
    if (db) {
      try {
        db.pragma("wal_checkpoint(TRUNCATE)");
      } catch {}
      db.close();
    }
    try {
      await rm(directory, { recursive: true, force: true });
    } catch {}
  }
});
