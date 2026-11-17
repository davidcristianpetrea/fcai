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

test("rangeFor follows HTTP byte-range semantics", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "adsense-files-"));
  const filename = path.join(directory, "sample.txt");
  await writeFile(filename, "abcdef");
  try {
    const cases = [
      ["bytes=1-3", "bcd", "bytes 1-3/6"],
      ["bytes=3-", "def", "bytes 3-5/6"],
      ["bytes=-2", "ef", "bytes 4-5/6"],
      ["bytes=-99", "abcdef", "bytes 0-5/6"],
    ] as const;
    for (const [header, expectedBody, expectedRange] of cases) {
      const result = await rangeFor(filename, header);
      assert.equal(result.status, 206);
      assert.equal(result.headers.get("Content-Range"), expectedRange);
      assert.equal(await new Response(result.stream).text(), expectedBody);
    }
    for (const header of ["bytes=-0", "bytes=6-", "bytes=4-2", "bytes=not-a-range", "bytes=1-2,3-4"]) {
      await assert.rejects(() => rangeFor(filename, header), { message: "range_not_satisfiable" });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
