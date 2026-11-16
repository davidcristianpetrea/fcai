import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SHARED_CONTRACT_VERSION, API_PATHS, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./constants.js";
import { deviceSchema, healthResponseSchema, offerSchema, redemptionSchema, sessionClaimsSchema } from "./schemas.js";

const generatedDirectory = new URL("../generated/", import.meta.url);
const vectorsDirectory = new URL("test-vectors/", generatedDirectory);
await mkdir(vectorsDirectory, { recursive: true });
await writeFile(
  new URL("constants.json", generatedDirectory),
  `${JSON.stringify({ contractVersion: SHARED_CONTRACT_VERSION, apiPaths: API_PATHS, defaultLocale: DEFAULT_LOCALE, supportedLocales: SUPPORTED_LOCALES }, null, 2)}\n`,
);
const generatedSchema = z.object({
  health: healthResponseSchema,
  sessionClaims: sessionClaimsSchema,
  device: deviceSchema,
  offer: offerSchema,
  redemption: redemptionSchema,
});

await writeFile(
  new URL("schema.json", generatedDirectory),
  `${JSON.stringify(zodToJsonSchema(generatedSchema, "SharedContract"), null, 2)}\n`,
);
await writeFile(
  new URL("test-vectors/health.json", generatedDirectory),
  `${JSON.stringify({ ok: true, contractVersion: SHARED_CONTRACT_VERSION, environment: "test" }, null, 2)}\n`,
);
await writeFile(
  new URL("test-vectors/public-config.json", generatedDirectory),
  `${JSON.stringify({ contractVersion: SHARED_CONTRACT_VERSION, defaultLocale: DEFAULT_LOCALE, supportedLocales: SUPPORTED_LOCALES }, null, 2)}\n`,
);
