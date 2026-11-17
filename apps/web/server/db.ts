import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Database from "better-sqlite3";

export async function openDatabase(dataDir: string): Promise<Database.Database> {
  await mkdir(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "adsense.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const migrationDir = path.resolve(fileURLToPath(new URL("../migrations", import.meta.url)));
  const applied = new Set((db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((row) => row.name));
  for (const name of (await readdir(migrationDir)).filter((item) => item.endsWith(".sql")).sort()) {
    if (applied.has(name)) continue;
    const sql = await readFile(path.join(migrationDir, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    })();
  }
  return db;
}

export function startMaintenance(db: Database.Database, dataDir: string): NodeJS.Timeout[] {
  const run = async () => {
    const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
    const assets = db.prepare("SELECT id FROM assets WHERE state = 'deleted' AND deleted_at < ? AND NOT EXISTS (SELECT 1 FROM offer_assets WHERE offer_assets.asset_id = assets.id)").all(cutoff) as { id: string }[];
    for (const asset of assets) await rm(path.join(dataDir, "media", asset.id), { recursive: true, force: true });
    db.prepare("DELETE FROM upload_chunks WHERE asset_id IN (SELECT id FROM assets WHERE state = 'deleted' AND deleted_at < ?)").run(cutoff);
    db.prepare("DELETE FROM assets WHERE state = 'deleted' AND deleted_at < ?").run(cutoff);
    db.prepare("DELETE FROM rate_limits WHERE window_started_at < ?").run(Date.now() - 86_400_000);
  };
  const timer = setInterval(() => void run(), 86_400_000);
  timer.unref();
  return [timer];
}

export async function backupDatabase(db: Database.Database, dataDir: string): Promise<void> {
  const backupDir = path.join(dataDir, "backups");
  await mkdir(backupDir, { recursive: true });
  const destination = path.join(backupDir, `adsense-${new Date().toISOString().replaceAll(":", "-")}.db`);
  await db.backup(destination);
  const { readdir: list } = await import("node:fs/promises");
  const files = (await list(backupDir)).filter((name) => name.endsWith(".db")).sort().reverse();
  for (const name of files.slice(7)) await rm(path.join(backupDir, name), { force: true });
}
