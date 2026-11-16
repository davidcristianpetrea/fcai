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
