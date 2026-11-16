import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifySessionToken } from "./auth.js";

test("creates and verifies a signed session token", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await createSessionToken({
    subject: "device_1",
    kind: "device",
    issuedAt: now,
    expiresAt: now + 60,
    deviceId: "device_1",
  }, "test-secret");
  assert.equal((await verifySessionToken(token, "test-secret"))?.subject, "device_1");
  assert.equal(await verifySessionToken(token, "wrong-secret"), null);
});

test("rejects expired session tokens", async () => {
  const token = await createSessionToken({
    subject: "device_1",
    kind: "device",
    issuedAt: 1,
    expiresAt: 1,
    deviceId: "device_1",
  }, "test-secret");
  assert.equal(await verifySessionToken(token, "test-secret"), null);
});
