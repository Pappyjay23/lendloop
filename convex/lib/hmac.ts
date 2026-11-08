/**
 * Deterministic JSON + HMAC-SHA256 helpers shared conceptually with the n8n
 * workflows. Both sides canonicalise the payload with sorted object keys so a
 * signature remains valid whether the bytes crossed an HTTP boundary or were
 * re-serialised by a parser.
 *
 * Uses Web Crypto only, so this module also runs in the Convex V8 runtime and
 * in Vitest/Node without polyfills.
 */

export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : sortValue(item)));
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== undefined) {
        out[key] = sortValue(item);
      }
    }
    return out;
  }
  return value;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

const encoder = new TextEncoder();

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function signedMessage(timestamp: number, message: string): string {
  return `${timestamp}.${message}`;
}

export async function signMessage(
  secret: string,
  timestamp: number,
  message: string,
): Promise<string> {
  return hmacHex(secret, signedMessage(timestamp, message));
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "stale" | "signature" };

export async function verifyMessage(
  secret: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  message: string,
  now = Date.now(),
  maxSkewMs = MAX_CLOCK_SKEW_MS,
): Promise<VerifyResult> {
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, reason: "missing" };
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > maxSkewMs) {
    return { ok: false, reason: "stale" };
  }
  const expected = await signMessage(secret, timestamp, message);
  if (!timingSafeEqualHex(expected, signatureHeader.trim().toLowerCase())) {
    return { ok: false, reason: "signature" };
  }
  return { ok: true };
}
