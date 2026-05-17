import { createHmac, timingSafeEqual } from "node:crypto";

type TokenPayload = {
  sub: string;
  exp: number;
};

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signAuthToken(
  input: { userId: string },
  secret: string,
  ttlMs = 7 * 24 * 60 * 60 * 1000
) {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson({ sub: input.userId, exp: Date.now() + ttlMs });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function verifyAuthToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const unsigned = `${header}.${payload}`;
  if (!safeEqual(signature, sign(unsigned, secret))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) return null;
    return { userId: parsed.sub };
  } catch {
    return null;
  }
}
