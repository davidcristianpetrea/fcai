import assert from "node:assert/strict";
import test from "node:test";
import { healthResponseSchema, publicConfigSchema } from "./schemas.js";

test("validates the public health vector", () => {
  assert.equal(healthResponseSchema.safeParse({
    ok: true,
    contractVersion: "1.0.0",
    environment: "test",
  }).success, true);
});

test("rejects unsupported locales in public config", () => {
  assert.equal(publicConfigSchema.safeParse({
    contractVersion: "1.0.0",
    defaultLocale: "fr",
    supportedLocales: ["en", "ro"],
  }).success, false);
});

test("uses Romanian as the default public locale", () => {
  assert.equal(publicConfigSchema.parse({
    contractVersion: "1.0.0",
    supportedLocales: ["en", "ro"],
  }).defaultLocale, "ro");
});
