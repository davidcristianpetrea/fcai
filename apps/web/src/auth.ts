import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionClaimsSchema, type SessionClaims } from "@adsense/shared";

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(claims: SessionClaims, secret: string): string {
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string, secret: string): SessionClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const claims = sessionClaimsSchema.parse(JSON.parse(decode(payload)));
    return claims.expiresAt > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}
