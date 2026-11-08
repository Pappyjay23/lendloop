import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalize,
  hmacHex,
  signMessage,
  timingSafeEqualHex,
  verifyMessage,
} from "../convex/lib/hmac";

describe("canonicalize", () => {
  it("sorts object keys recursively", () => {
    const value = {
      z: 1,
      a: { y: true, b: ["x", { d: 2, c: 3 }] },
    };
    expect(canonicalize(value)).toBe(
      '{"a":{"b":["x",{"c":3,"d":2}],"y":true},"z":1}',
    );
  });

  it("matches JSON semantics for undefined and null in arrays", () => {
    expect(canonicalize({ a: undefined, b: [undefined, null] })).toBe(
      '{"b":[null,null]}',
    );
  });

  it("is stable regardless of input key order", () => {
    const first = { b: 2, a: 1, nested: { y: 2, x: 1 } };
    const second = { nested: { x: 1, y: 2 }, a: 1, b: 2 };
    expect(canonicalize(first)).toBe(canonicalize(second));
  });
});

describe("hmacHex", () => {
  it("matches the RFC 4231 test vector", async () => {
    await expect(hmacHex("Jefe", "what do ya want for nothing?")).resolves.toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});

describe("verifyMessage", () => {
  const secret = "test-secret-with-enough-entropy";
  const payload = {
    eventKind: "request.created",
    toolName: "Bosch drill",
    recipient: { email: "amara@example.com", firstName: "Amara" },
  };
  const message = canonicalize(payload);

  it("accepts a signature produced by Node's crypto (n8n parity)", async () => {
    const timestamp = Date.now();
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${message}`)
      .digest("hex");

    await expect(
      verifyMessage(secret, String(timestamp), signature, message, timestamp),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects a tampered payload", async () => {
    const timestamp = Date.now();
    const signature = await signMessage(secret, timestamp, message);
    const tampered = message.replace("Amara", "Tobi");

    await expect(
      verifyMessage(secret, String(timestamp), signature, tampered, timestamp),
    ).resolves.toEqual({ ok: false, reason: "signature" });
  });

  it("rejects stale timestamps", async () => {
    const timestamp = Date.now() - 10 * 60 * 1000;
    const signature = await signMessage(secret, timestamp, message);

    await expect(
      verifyMessage(secret, String(timestamp), signature, message, Date.now()),
    ).resolves.toEqual({ ok: false, reason: "stale" });
  });

  it("rejects missing headers", async () => {
    await expect(verifyMessage(secret, null, null, message)).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
  });
});

describe("timingSafeEqualHex", () => {
  it("compares without leaking length differences", () => {
    expect(timingSafeEqualHex("abcd", "abcd")).toBe(true);
    expect(timingSafeEqualHex("abcd", "abce")).toBe(false);
    expect(timingSafeEqualHex("abcd", "abcde")).toBe(false);
  });
});
