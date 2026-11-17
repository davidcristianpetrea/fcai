import { z } from "zod";
import { DEFAULT_LOCALE, SHARED_CONTRACT_VERSION, SUPPORTED_LOCALES } from "./constants.js";

export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const timestampSchema = z.string().datetime({ offset: true });

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  contractVersion: z.string(),
  environment: z.string(),
});

export const publicConfigSchema = z.object({
  contractVersion: z.literal(SHARED_CONTRACT_VERSION),
  defaultLocale: localeSchema.default(DEFAULT_LOCALE),
  supportedLocales: z.array(localeSchema).length(SUPPORTED_LOCALES.length),
});

export const sessionClaimsSchema = z.object({
  subject: idSchema,
  kind: z.enum(["admin", "device"]),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  deviceId: idSchema.optional(),
});

export const deviceSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  createdAt: timestampSchema,
  lastSeenAt: timestampSchema.nullable(),
});

export const offerSchema = z.object({
  id: idSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
  locale: localeSchema,
  imageKey: z.string().min(1).max(512).nullable(),
  active: z.boolean(),
});

export const redemptionSchema = z.object({
  id: idSchema,
  offerId: idSchema,
  deviceId: idSchema,
  redeemedAt: timestampSchema,
});

export const bleAuthModeSchema = z.enum(["none", "psk", "pairing"]);
export const bleHelloSchema = z.object({
  type: z.literal("hello"),
  deviceId: idSchema,
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  authMode: bleAuthModeSchema,
});
export const bleWifiCredentialsSchema = z.object({
  type: z.literal("wifi_credentials"),
  ssid: z.string().min(1).max(64),
  password: z.string().max(128),
});
export const bleWifiStatusSchema = z.object({
  type: z.literal("wifi_status"),
  connected: z.boolean(),
  error: z.string().max(256).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type SessionClaims = z.infer<typeof sessionClaimsSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Redemption = z.infer<typeof redemptionSchema>;
export type BleAuthMode = z.infer<typeof bleAuthModeSchema>;
export type BleHello = z.infer<typeof bleHelloSchema>;
export type BleWifiCredentials = z.infer<typeof bleWifiCredentialsSchema>;
export type BleWifiStatus = z.infer<typeof bleWifiStatusSchema>;
