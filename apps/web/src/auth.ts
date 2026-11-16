import { sessionClaimsSchema, type SessionClaims } from "@adsense/shared";
import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "./env.js";

const encoder = new TextEncoder();

function encode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSessionToken(claims: SessionClaims, secret: string): Promise<string> {
  const payload = encode(encoder.encode(JSON.stringify(claims)));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload, secret)) !== signature) return null;
  try {
    const claims = sessionClaimsSchema.parse(JSON.parse(new TextDecoder().decode(decode(payload))));
    return claims.expiresAt > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}

export function bearerToken(context: Context<{ Bindings: Env }>): string | null {
  const authorization = context.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

export const requireSession: MiddlewareHandler<{ Bindings: Env; Variables: { session: SessionClaims } }> = async (context, next) => {
  const token = bearerToken(context);
  const claims = token ? await verifySessionToken(token, context.env.SESSION_SECRET) : null;
  if (!claims) return context.json({ error: "unauthorized" }, 401);
  context.set("session", claims);
  await next();
};
