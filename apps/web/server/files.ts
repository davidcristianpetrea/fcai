import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type Database from "better-sqlite3";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const CHUNK_BYTES = 8 * 1024 * 1024;

export function tokenFor(assetId: string, kind: "media" | "thumb", expiresAt: number, secret: string): string {
  const payload = `${assetId}.${kind}.${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyToken(token: string, assetId: string, kind: "media" | "thumb", secret: string): boolean {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const [id, tokenKind, expiresAt] = payload.split(".");
  return id === assetId && tokenKind === kind && Number(expiresAt) > Date.now();
}

export async function streamUpload(body: ReadableStream<Uint8Array>, destination: string): Promise<{ size: number; sha256: string }> {
  await mkdir(path.dirname(destination), { recursive: true });
  const hash = createHash("sha256");
  let size = 0;
  const input = Readable.fromWeb(body as never);
  const output = createWriteStream(destination, { flags: "wx" });
  try {
    for await (const chunk of input) {
      size += (chunk as Buffer).length;
      if (size > MAX_UPLOAD_BYTES) throw new Error("upload_too_large");
      hash.update(chunk as Buffer);
      if (!output.write(chunk)) await new Promise<void>((resolve) => output.once("drain", resolve));
    }

    await new Promise<void>((resolve, reject) => {
      output.end(() => resolve());
      output.once("error", reject);
    });
  } catch (error) {
    output.destroy();
    await rm(destination, { force: true });
    throw error;
  }
  return { size, sha256: hash.digest("hex") };
}

export async function streamChunk(body: ReadableStream<Uint8Array>, destination: string): Promise<{ size: number; sha256: string }> {
  return streamUpload(body, destination);
}

export async function rangeFor(file: string, range: string | undefined): Promise<{ stream: ReadableStream; headers: Headers; status: number }> {
  const info = await stat(file);
  const headers = new Headers({ "Accept-Ranges": "bytes", "Content-Length": String(info.size) });
  if (!range) return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream, headers, status: 200 };
  const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
  if (!match || (!match[1] && !match[2])) throw new Error("range_not_satisfiable");
  const requestedStart = match[1] ? Number(match[1]) : undefined;
  const requestedEnd = match[2] ? Number(match[2]) : undefined;
  if ([requestedStart, requestedEnd].some((value) => value !== undefined && !Number.isSafeInteger(value))) {
    throw new Error("range_not_satisfiable");
  }
  if (requestedStart === undefined && requestedEnd === 0) throw new Error("range_not_satisfiable");
  const start = requestedStart === undefined ? Math.max(0, info.size - requestedEnd!) : requestedStart;
  const end = requestedEnd === undefined || requestedStart === undefined
    ? info.size - 1
    : Math.min(info.size - 1, requestedEnd);
  if (start > end || start >= info.size) throw new Error("range_not_satisfiable");
  headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  headers.set("Content-Length", String(end - start + 1));
  return { stream: Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, headers, status: 206 };
}

export function mediaPath(dataDir: string, assetId: string, filename: string): string {
  return path.join(dataDir, "media", assetId, filename);
}

export function createRateLimit(db: Database.Database, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const row = db.prepare("SELECT window_started_at, count FROM rate_limits WHERE key = ?").get(key) as { window_started_at: number; count: number } | undefined;
  if (!row || now - row.window_started_at >= windowMs) {
    db.prepare("INSERT INTO rate_limits(key, window_started_at, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_started_at = excluded.window_started_at, count = 1").run(key, now);
    return true;
  }
  if (row.count >= limit) return false;
  db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
  return true;
}
