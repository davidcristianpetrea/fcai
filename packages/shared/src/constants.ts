export const SHARED_CONTRACT_VERSION = "1.0.0";

export const SUPPORTED_LOCALES = ["en", "ro"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ro";

export const API_PATHS = {
  health: "/api/health",
  publicConfig: "/api/public/config",
  session: "/api/session",
  devices: "/api/devices",
  offers: "/api/offers",
  redemptions: "/api/redemptions",
} as const;

export const SECURITY = {
  sessionTtlSeconds: 60 * 60 * 24 * 30,
  authorizationScheme: "Bearer",
  deviceIdHeader: "X-Device-Id",
} as const;

export const BLE = {
  serviceUuid: "7b2f0001-4d7e-4e8f-9f4e-6b0f4e4c0001",
  controlCharacteristicUuid: "7b2f0002-4d7e-4e8f-9f4e-6b0f4e4c0001",
  notifyCharacteristicUuid: "7b2f0003-4d7e-4e8f-9f4e-6b0f4e4c0001",
  protocolVersion: 1,
  maxChunkPayload: 180,
} as const;

export const BLE_MESSAGE_TYPES = {
  hello: 1,
  wifiCredentials: 2,
  wifiStatus: 3,
  identify: 4,
  error: 255,
} as const;
