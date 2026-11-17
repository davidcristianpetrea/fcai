import assert from "node:assert/strict";
import test from "node:test";
import { getApiState } from "./status.js";

test("classifies 501 as a reserved feature instead of an outage", async () => {
  assert.equal(await getApiState(async () => new Response(null, { status: 501 })), "reserved");
});

test("classifies successful API responses as healthy", async () => {
  assert.equal(await getApiState(async () => new Response(null, { status: 200 })), "healthy");
});
