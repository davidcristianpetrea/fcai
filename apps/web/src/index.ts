import { Hono } from "hono";
import { API_PATHS, DEFAULT_LOCALE, SHARED_CONTRACT_VERSION, SUPPORTED_LOCALES, publicConfigSchema } from "@adsense/shared";
import type { Env } from "./env.js";
import { requireSession } from "./auth.js";
import { DeviceHub } from "./device-hub.js";

const app = new Hono<{ Bindings: Env }>();

app.get(API_PATHS.health, (context) => context.json({
  ok: true,
  contractVersion: SHARED_CONTRACT_VERSION,
  environment: context.env.ENVIRONMENT || "production",
}));

app.get(API_PATHS.publicConfig, (context) => context.json(publicConfigSchema.parse({
  contractVersion: SHARED_CONTRACT_VERSION,
  defaultLocale: DEFAULT_LOCALE,
  supportedLocales: SUPPORTED_LOCALES,
})));

app.get("/api/session/me", requireSession, (context) => context.json({ session: context.get("session") }));

app.all("/api/session", (context) => context.json({ error: "not_implemented", message: "Session issuance is reserved for the identity integration milestone." }, 501));
app.all("/api/devices", (context) => context.json({ error: "not_implemented", message: "Device management is reserved for the device onboarding milestone." }, 501));
app.all("/api/offers", (context) => context.json({ error: "not_implemented", message: "Offer management is reserved for the offer-management milestone." }, 501));
app.all("/api/redemptions", (context) => context.json({ error: "not_implemented", message: "Redemption processing is reserved for the redemption milestone." }, 501));

app.notFound((context) => {
  if (context.req.path.startsWith("/api/")) return context.json({ error: "not_found" }, 404);
  return context.env.ASSETS.fetch(context.req.raw);
});

export { DeviceHub };
export default app;
