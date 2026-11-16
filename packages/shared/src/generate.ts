import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SHARED_CONTRACT_VERSION, API_PATHS, BLE, BLE_MESSAGE_TYPES, DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./constants.js";
import { bleAuthModeSchema, bleHelloSchema, bleWifiCredentialsSchema, bleWifiStatusSchema, deviceSchema, healthResponseSchema, offerSchema, redemptionSchema, sessionClaimsSchema } from "./schemas.js";

const generatedDirectory = new URL("../generated/", import.meta.url);
const vectorsDirectory = new URL("test-vectors/", generatedDirectory);
await mkdir(vectorsDirectory, { recursive: true });
await writeFile(
  new URL("constants.json", generatedDirectory),
  `${JSON.stringify({ contractVersion: SHARED_CONTRACT_VERSION, apiPaths: API_PATHS, defaultLocale: DEFAULT_LOCALE, supportedLocales: SUPPORTED_LOCALES, ble: BLE, bleMessageTypes: BLE_MESSAGE_TYPES }, null, 2)}\n`,
);
const generatedSchema = z.object({
  health: healthResponseSchema,
  sessionClaims: sessionClaimsSchema,
  device: deviceSchema,
  offer: offerSchema,
  redemption: redemptionSchema,
  bleAuthMode: bleAuthModeSchema,
  bleHello: bleHelloSchema,
  bleWifiCredentials: bleWifiCredentialsSchema,
  bleWifiStatus: bleWifiStatusSchema,
});

const pythonConstants = `"""Generated from packages/shared/src/constants.ts; do not edit manually."""

BLE_SERVICE_UUID = ${JSON.stringify(BLE.serviceUuid)}
BLE_CONTROL_CHARACTERISTIC_UUID = ${JSON.stringify(BLE.controlCharacteristicUuid)}
BLE_NOTIFY_CHARACTERISTIC_UUID = ${JSON.stringify(BLE.notifyCharacteristicUuid)}
BLE_PROTOCOL_VERSION = ${BLE.protocolVersion}
BLE_MAX_CHUNK_PAYLOAD = ${BLE.maxChunkPayload}
BLE_MESSAGE_TYPES = ${JSON.stringify(BLE_MESSAGE_TYPES)}
`;
await writeFile(new URL("python_constants.py", generatedDirectory), pythonConstants);
await writeFile(new URL("../../../device/agent/adsense_agent/generated_protocol.py", import.meta.url), pythonConstants);

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
