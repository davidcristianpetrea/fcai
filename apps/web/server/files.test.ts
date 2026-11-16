import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rangeFor, tokenFor, verifyToken } from "./files.js";

test("upload tokens are bound to asset, kind, expiry, and secret", () => {
  const token = tokenFor("asset-1", "media", Date.now() + 60_000, "secret");
  assert.equal(verifyToken(token, "asset-1", "media", "secret"), true);
  assert.equal(verifyToken(token, "asset-2", "media", "secret"), false);
  assert.equal(verifyToken(token, "asset-1", "thumb", "secret"), false);
  assert.equal(verifyToken(token, "asset-1", "media", "wrong"), false);
});

test("rangeFor supports suffix ranges", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "adsense-files-"));
  const filename = path.join(directory, "sample.txt");
  await writeFile(filename, "abcdef");
  try {
    const result = await rangeFor(filename, "bytes=-2");
    assert.equal(result.status, 206);
    assert.equal(result.headers.get("Content-Range"), "bytes 4-5/6");
    assert.equal(await new Response(result.stream).text(), "ef");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
