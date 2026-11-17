import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { API_PATHS, DEFAULT_LOCALE, SHARED_CONTRACT_VERSION, SUPPORTED_LOCALES, publicConfigSchema } from "@adsense/shared";
import { createSessionToken, verifySessionToken } from "../src/auth.js";
import { openDatabase, startMaintenance, backupDatabase } from "./db.js";
import { createRateLimit, mediaPath, rangeFor, streamChunk, tokenFor, verifyToken, MAX_UPLOAD_BYTES, CHUNK_BYTES } from "./files.js";
import { DeviceHub } from "../src/device-hub.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const dataDir = process.env.DATA_DIR ?? path.resolve("data");
const sessionSecret = process.env.SESSION_SECRET ?? "";
const adminUsername = process.env.ADMIN_USERNAME ?? "";
const adminPassword = process.env.ADMIN_PASSWORD ?? "";
if (!sessionSecret || !adminUsername || !adminPassword) throw new Error("SESSION_SECRET, ADMIN_USERNAME, and ADMIN_PASSWORD are required");

const db = await openDatabase(dataDir);
const deviceHub = new DeviceHub(db);
const app = new Hono();
const publicRoot = path.resolve(process.cwd(), "apps/web/dist");
const contentTypes: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const defaultDeviceConfig = {
  template: "simple",
  liveFaces: true,
  lookTime: 3,
  standbyDuration: 8,
  standbyEnabled: true,
  transition: "auto",
  transitionSpeed: 1,
  offerLink: "https://adsense.davidpetrea.ro/offer",
  headline: "",
  subtext: "",
  caption: "aici poza cu mâncare",
  qrSize: 220,
  offerBackground: "#111827",
  playlist: [],
};
function normalizeConfig(value: unknown): Record<string, unknown> {
  return { ...defaultDeviceConfig, ...(value && typeof value === "object" ? value as Record<string, unknown> : {}) };
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}

function ip(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function admin(request: Request) {
  const token = bearer(request);
  return token ? verifySessionToken(token, sessionSecret) : null;
}

app.get(API_PATHS.health, (c) => c.json({ ok: true }));
app.get(API_PATHS.publicConfig, (c) => c.json(publicConfigSchema.parse({ contractVersion: SHARED_CONTRACT_VERSION, defaultLocale: DEFAULT_LOCALE, supportedLocales: SUPPORTED_LOCALES })));
app.post(API_PATHS.session, async (c) => {
  if (!createRateLimit(db, `login:${ip(c.req.raw)}`, 10, 900_000)) return c.json({ error: "rate_limited" }, 429);
  const body = await c.req.json<{ username?: string; password?: string }>();
  if (body.username !== adminUsername || body.password !== adminPassword) return c.json({ error: "unauthorized" }, 401);
  const now = Math.floor(Date.now() / 1000);
  return c.json({ token: createSessionToken({ subject: "admin", kind: "admin", issuedAt: now, expiresAt: now + 86_400 }, sessionSecret) });
});
app.get("/api/session/me", (c) => {
  const claims = admin(c.req.raw);
  return claims ? c.json({ session: claims }) : c.json({ error: "unauthorized" }, 401);
});
app.get("/api/devices", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const rows = db.prepare("SELECT id, name, language, last_seen_at, last_status, config_json, config_version, applied_config_version, applied_at FROM devices ORDER BY name").all() as { id: string; name: string; language: string; last_seen_at?: string; last_status?: string; config_json: string; config_version: number; applied_config_version: number; applied_at?: string }[];
  return c.json({ devices: rows.map((row) => ({ ...row, online: Boolean(row.last_seen_at && Date.now() - Date.parse(row.last_seen_at) < 30_000), config: normalizeConfig(JSON.parse(row.config_json)), syncing: row.config_version !== row.applied_config_version })) });
});
app.post("/api/device/pair-request", (c) => {
  const deviceId = `display-${crypto.randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare("INSERT INTO devices(id, name, device_secret_hash, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(deviceId, "Ecran nou", "pending-pairing", JSON.stringify(defaultDeviceConfig), new Date(now).toISOString(), new Date(now).toISOString());
  db.prepare("INSERT INTO pair_requests(device_id, code, expires_at, created_at) VALUES (?, ?, ?, ?)").run(deviceId, code, now + 10 * 60_000, new Date(now).toISOString());
  return c.json({ deviceId, code, expiresAt: now + 10 * 60_000, locale: DEFAULT_LOCALE });
});
app.get("/api/device/pair-status", (c) => {
  const deviceId = c.req.query("deviceId") ?? "";
  const code = c.req.query("code") ?? "";
  const row = db.prepare("SELECT p.code, p.expires_at, p.bound_at, d.name, d.config_json FROM pair_requests p JOIN devices d ON d.id = p.device_id WHERE p.device_id = ?").get(deviceId) as { code: string; expires_at: number; bound_at?: string; name: string; config_json: string } | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  if (!row.bound_at && row.expires_at <= Date.now()) {
    const nextCode = String(Math.floor(100000 + Math.random() * 900000));
    const nextExpiry = Date.now() + 10 * 60_000;
    db.prepare("UPDATE pair_requests SET code = ?, expires_at = ? WHERE device_id = ?").run(nextCode, nextExpiry, deviceId);
    return c.json({ paired: false, code: nextCode, expiresAt: nextExpiry });
  }
  if (!row.bound_at) return c.json({ paired: false, code: row.code, expiresAt: row.expires_at });
  const now = Math.floor(Date.now() / 1000);
  return c.json({
    paired: true,
    deviceId,
    name: row.name,
    config: normalizeConfig(JSON.parse(row.config_json)),
    token: createSessionToken({ subject: deviceId, kind: "device", deviceId, issuedAt: now, expiresAt: now + 31_536_000 }, sessionSecret),
  });
});
app.post("/api/devices/pair", async (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ code?: string; name?: string }>();
  const row = body.code ? db.prepare("SELECT device_id FROM pair_requests WHERE code = ? AND bound_at IS NULL AND expires_at > ?").get(body.code, Date.now()) as { device_id: string } | undefined : undefined;
  if (!row) return c.json({ error: "invalid_pair_code" }, 400);
  const name = body.name?.trim() || "Ecran nou";
  const now = new Date().toISOString();
  db.prepare("UPDATE devices SET name = ?, device_secret_hash = ?, config_json = COALESCE(NULLIF(config_json, '{}'), ?), updated_at = ? WHERE id = ?").run(name, "paired-device", JSON.stringify(defaultDeviceConfig), now, row.device_id);
  db.prepare("UPDATE pair_requests SET bound_at = ? WHERE device_id = ?").run(now, row.device_id);
  return c.json({ ok: true, deviceId: row.device_id, name });
});
app.post("/api/device/claim", async (c) => {
  const body = await c.req.json<{ code?: string }>();
  const row = body.code ? db.prepare("SELECT code, device_id FROM link_codes WHERE code = ? AND used_at IS NULL AND expires_at > ?").get(body.code, Date.now()) as { code: string; device_id: string } | undefined : undefined;
  if (!row) return c.json({ error: "invalid_link_code" }, 401);
  db.prepare("UPDATE link_codes SET used_at = ? WHERE code = ?").run(new Date().toISOString(), row.code);
  const now = Math.floor(Date.now() / 1000);
  return c.json({
    deviceId: row.device_id,
    token: createSessionToken({ subject: row.device_id, kind: "device", deviceId: row.device_id, issuedAt: now, expiresAt: now + 31_536_000 }, sessionSecret),
    config: {},
  });
});
app.post("/api/devices/:id/reset", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  db.prepare("DELETE FROM pair_requests WHERE device_id = ?").run(id);
  db.prepare("UPDATE devices SET device_secret_hash = ?, config_json = ?, config_version = config_version + 1, applied_config_version = 0, updated_at = ? WHERE id = ?").run("pending-pairing", JSON.stringify(defaultDeviceConfig), new Date().toISOString(), id);
  return c.json({ ok: true });
});
app.get("/api/assets", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  return c.json({ assets: db.prepare("SELECT id, filename, content_type, size_bytes, state, created_at FROM assets WHERE state != 'deleted' ORDER BY created_at DESC").all() });
});
app.delete("/api/assets/:id", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  db.prepare("UPDATE assets SET state = 'deleted', deleted_at = ? WHERE id = ?").run(new Date().toISOString(), c.req.param("id"));
  return c.json({ ok: true });
});
app.get("/api/leads", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  return c.json({ leads: db.prepare("SELECT id, name, email, consent, created_at FROM leads ORDER BY created_at DESC").all() });
});
app.delete("/api/leads/:id", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  db.prepare("DELETE FROM leads WHERE id = ?").run(c.req.param("id"));
  return c.json({ ok: true });
});
app.post("/api/leads", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string; consent?: boolean; website?: string }>();
  if (body.website || !body.name || !body.email || !body.consent) return c.json({ error: "invalid_lead" }, 400);
  if (!createRateLimit(db, `lead:${ip(c.req.raw)}`, 5, 3_600_000)) return c.json({ error: "rate_limited" }, 429);
  db.prepare("INSERT INTO leads(id, name, email, consent, created_at) VALUES (?, ?, ?, 1, ?)").run(crypto.randomUUID(), body.name.trim(), body.email.trim(), new Date().toISOString());
  return c.json({ ok: true });
});
app.post("/api/assets", async (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ filename?: string; contentType?: string }>();
  const assetId = crypto.randomUUID();
  const expiresAt = Date.now() + 15 * 60_000;
  db.prepare("INSERT INTO assets(id, filename, content_type, created_at) VALUES (?, ?, ?, ?)").run(assetId, body.filename ?? "upload.bin", body.contentType ?? "application/octet-stream", new Date().toISOString());
  db.prepare("INSERT INTO upload_tokens(id, asset_id, kind, expires_at) VALUES (?, ?, 'media', ?)").run(crypto.randomUUID(), assetId, expiresAt);
  db.prepare("INSERT INTO upload_tokens(id, asset_id, kind, expires_at) VALUES (?, ?, 'thumb', ?)").run(crypto.randomUUID(), assetId, expiresAt);
  return c.json({ assetId, uploadUrl: `/api/assets/${assetId}/upload?token=${tokenFor(assetId, "media", expiresAt, sessionSecret)}`, thumbUploadUrl: `/api/assets/${assetId}/upload?kind=thumb&token=${tokenFor(assetId, "thumb", expiresAt, sessionSecret)}`, chunkBytes: CHUNK_BYTES });
});
app.get("/api/assets/:id/upload-status", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const kind = c.req.query("kind") === "thumb" ? "thumb" : "media";
  const token = c.req.query("token") ?? "";
  if (!verifyToken(token, id, kind, sessionSecret)) return c.json({ error: "invalid_upload_token" }, 401);
  const rows = db.prepare("SELECT chunk_index, size_bytes FROM upload_chunks WHERE asset_id = ? AND kind = ? ORDER BY chunk_index").all(id, kind) as { chunk_index: number; size_bytes: number }[];
  let nextIndex = 0;
  for (const row of rows) {
    if (row.chunk_index !== nextIndex) break;
    nextIndex++;
  }
  return c.json({ nextIndex, received: rows.slice(0, nextIndex).map((row) => row.chunk_index) });
});
app.put("/api/assets/:id/chunks/:index", async (c) => {
  const id = c.req.param("id");
  const kind = c.req.query("kind") === "thumb" ? "thumb" : "media";
  const token = c.req.query("token") ?? "";
  if (!verifyToken(token, id, kind, sessionSecret)) return c.json({ error: "invalid_upload_token" }, 401);
  const index = Number(c.req.param("index"));
  const tokenRow = db.prepare("SELECT id, used_at FROM upload_tokens WHERE asset_id = ? AND kind = ? AND used_at IS NULL AND expires_at > ?").get(id, kind, Date.now()) as { id: string } | undefined;
  if (!tokenRow || !Number.isSafeInteger(index) || index < 0 || !c.req.raw.body) return c.json({ error: "invalid_upload_token" }, 401);
  const next = db.prepare("SELECT COALESCE(MAX(chunk_index) + 1, 0) AS next_index FROM upload_chunks WHERE asset_id = ? AND kind = ?").get(id, kind) as { next_index: number };
  if (index < next.next_index) return c.json({ ok: true, chunkIndex: index, duplicate: true });
  if (index !== next.next_index) return c.json({ error: "chunk_out_of_order", nextIndex: next.next_index }, 409);
  const current = db.prepare("SELECT COALESCE(SUM(size_bytes), 0) AS size FROM upload_chunks WHERE asset_id = ? AND kind = ?").get(id, kind) as { size: number };
  const declaredSize = Number(c.req.header("content-length") ?? 0);
  if (declaredSize > CHUNK_BYTES || current.size + declaredSize > MAX_UPLOAD_BYTES) return c.json({ error: "file_too_large" }, 413);
  const tempDir = path.join(dataDir, "media", id);
  const partPath = path.join(tempDir, `.chunk-${kind}-${index}`);
  const tempPath = path.join(tempDir, `.upload-${kind}`);
  try {
    const result = await streamChunk(c.req.raw.body, partPath);
    if (result.size > CHUNK_BYTES) throw new Error("chunk_too_large");
    await new Promise<void>((resolve, reject) => {
      const input = createReadStream(partPath);
      const output = createWriteStream(tempPath, { flags: "a" });
      input.on("error", reject);
      output.on("error", reject);
      output.on("close", resolve);
      input.pipe(output);
    });
    await rm(partPath, { force: true });
    db.prepare("INSERT INTO upload_chunks(asset_id, kind, chunk_index, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)").run(id, kind, index, result.size, new Date().toISOString());
    return c.json({ ok: true, chunkIndex: index, size: result.size });
  } catch (error) {
    await rm(partPath, { force: true });
    return c.json({ error: error instanceof Error && error.message === "upload_too_large" ? "file_too_large" : "upload_failed" }, 413);
  }
});
app.post("/api/assets/:id/complete", async (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const token = c.req.query("token") ?? "";
  if (!verifyToken(token, id, "media", sessionSecret)) return c.json({ error: "invalid_upload_token" }, 401);
  const body = await c.req.json<{ totalSize?: number; sha256?: string }>();
  const rows = db.prepare("SELECT size_bytes FROM upload_chunks WHERE asset_id = ? AND kind = 'media' ORDER BY chunk_index").all(id) as { size_bytes: number }[];
  const totalSize = rows.reduce((sum, row) => sum + row.size_bytes, 0);
  if (!Number.isSafeInteger(body.totalSize) || body.totalSize !== totalSize || !body.sha256) return c.json({ error: "upload_incomplete" }, 400);
  const tempPath = path.join(dataDir, "media", id, ".upload-media");
  const finalPath = mediaPath(dataDir, id, "original");
  const hash = createHash("sha256");
  const input = createReadStream(tempPath);
  for await (const chunk of input) hash.update(chunk as Buffer);
  if (hash.digest("hex") !== body.sha256) return c.json({ error: "checksum_mismatch" }, 400);
  await rename(tempPath, finalPath);
  db.prepare("UPDATE assets SET size_bytes = ?, sha256 = ?, state = 'ready' WHERE id = ?").run(totalSize, body.sha256, id);
  db.prepare("UPDATE upload_tokens SET used_at = ? WHERE asset_id = ? AND kind = 'media'").run(Date.now(), id);
  return c.json({ ok: true, size: totalSize, sha256: body.sha256 });
});
app.post("/api/devices/:id/token", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  db.prepare("INSERT INTO devices(id, name, device_secret_hash, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").run(id, id, "managed-by-session-secret", new Date().toISOString());
  const now = Math.floor(Date.now() / 1000);
  return c.json({ token: createSessionToken({ subject: id, kind: "device", deviceId: id, issuedAt: now, expiresAt: now + 31_536_000 }, sessionSecret) });
});
app.post("/api/devices/:id/config", async (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const config = normalizeConfig(await c.req.json());
  const row = db.prepare("SELECT config_version FROM devices WHERE id = ?").get(c.req.param("id")) as { config_version: number } | undefined;
  const version = (row?.config_version ?? 0) + 1;
  db.prepare("UPDATE devices SET config_json = ?, config_version = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(config), version, new Date().toISOString(), c.req.param("id"));
  return c.json({ ok: deviceHub.sendConfig(c.req.param("id"), config), version });
});
app.get("/api/devices/:id/config", (c) => {
  if (admin(c.req.raw)?.kind !== "admin") return c.json({ error: "unauthorized" }, 401);
  const row = db.prepare("SELECT config_json, language, name, config_version, applied_config_version, applied_at FROM devices WHERE id = ?").get(c.req.param("id")) as { config_json: string; language: string; name: string; config_version: number; applied_config_version: number; applied_at?: string } | undefined;
  return row ? c.json({ name: row.name, language: row.language, config: normalizeConfig(JSON.parse(row.config_json)), configVersion: row.config_version, appliedConfigVersion: row.applied_config_version, appliedAt: row.applied_at }) : c.json({ error: "not_found" }, 404);
});
app.post("/api/device/sync", async (c) => {
  const body = await c.req.json<{ device_id?: string; state?: unknown; config?: unknown; applied_config_version?: number }>();
  if (!body.device_id) return c.json({ error: "device_id_required" }, 400);
  const claims = admin(c.req.raw);
  if (claims?.kind === "device" && claims.deviceId !== body.device_id) return c.json({ error: "unauthorized" }, 401);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO devices(id, name, device_secret_hash, last_seen_at, last_status, created_at, updated_at) VALUES (?, ?, ?, ?, 'online', ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at, last_status = 'online'",
  ).run(body.device_id, body.device_id, "legacy-sync", now, now, now);
  if (typeof body.applied_config_version === "number") db.prepare("UPDATE devices SET applied_config_version = ?, applied_at = ? WHERE id = ? AND applied_config_version <= ?").run(body.applied_config_version, now, body.device_id, body.applied_config_version);
  const row = db.prepare("SELECT name, config_json, config_version, applied_config_version, playlist_json FROM devices WHERE id = ?").get(body.device_id) as { name: string; config_json: string; config_version: number; applied_config_version: number; playlist_json: string } | undefined;
  const media = db.prepare("SELECT id, filename, content_type, size_bytes FROM assets WHERE state = 'ready' ORDER BY created_at").all();
  return c.json({ ok: true, device_id: body.device_id, name: row?.name ?? body.device_id, config: row ? normalizeConfig(JSON.parse(row.config_json)) : normalizeConfig(body.config), config_version: row?.config_version ?? 0, applied_config_version: row?.applied_config_version ?? 0, playlist: row?.playlist_json ? JSON.parse(row.playlist_json) : [], media, state: body.state ?? null, last_contact_at: now });
});
app.get("/api/device/media/:id", async (c) => {
  const claims = admin(c.req.raw);
  if (!claims || (claims.kind !== "admin" && claims.kind !== "device")) return c.json({ error: "unauthorized" }, 401);
  const row = db.prepare("SELECT filename, content_type FROM assets WHERE id = ? AND state = 'ready'").get(c.req.param("id")) as { filename: string; content_type: string } | undefined;
  if (!row) return c.json({ error: "not_found" }, 404);
  try {
    const file = await rangeFor(mediaPath(dataDir, c.req.param("id"), "original"), c.req.header("range"));
    file.headers.set("Content-Type", row.content_type);
    return new Response(file.stream, { status: file.status, headers: file.headers });
  } catch (error) {
    if (error instanceof Error && error.message === "range_not_satisfiable") return c.json({ error: "range_not_satisfiable" }, 416);
    return c.json({ error: "not_found" }, 404);
  }
});
app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/ws/")) return c.json({ error: "not_found" }, 404);
  const requested = c.req.path === "/" || c.req.path.startsWith("/offer") || c.req.path.startsWith("/privacy") ? "/index.html" : c.req.path;
  const file = path.resolve(publicRoot, `.${requested}`);
  if (!file.startsWith(publicRoot)) return c.text("Not found", 404);
  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream" } });
  } catch {
    const body = await readFile(path.join(publicRoot, "index.html"));
    return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
});

const wss = new WebSocketServer({ noServer: true });
const server = serve({ fetch: app.fetch, port, hostname: host });
const httpServer = server;
httpServer.on("upgrade", (request, socket, head) => {
  if (new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname !== "/ws/device") return socket.destroy();
  const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : "";
  const claims = verifySessionToken(token, sessionSecret);
  if (!claims || claims.kind !== "device" || !claims.deviceId) return socket.destroy();
  wss.handleUpgrade(request, socket, head, (ws) => {
    deviceHub.connect(claims.deviceId!, ws);
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as { type?: string; lastStatus?: string };
        deviceHub.handle(claims.deviceId!, message);
        if (message.type === "heartbeat") ws.send(JSON.stringify({ type: "heartbeat_ack", ts: Date.now() }));
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "invalid_message" }));
      }
    });
  });
});

startMaintenance(db, dataDir);
const backupTimer = setInterval(() => void backupDatabase(db, dataDir), 86_400_000);
backupTimer.unref();
console.log(`AdSense web server listening on http://${host}:${port}`);
