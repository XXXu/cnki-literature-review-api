import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

process.env.DATABASE_URL = "file:./test-auth.db";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "EmailVerificationCode"`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "User"`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "quickReviewQuota" INTEGER NOT NULL DEFAULT 3,
      "deepReviewQuota" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "EmailVerificationCode" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "codeHash" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "consumedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "EmailVerificationCode"`);
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth routes", () => {
  const createAuthApp = () => createApp({
    prisma,
    jwtSecret: "test-secret",
    emailSender: {
      sendVerificationCode: async () => undefined
    },
    verificationCodeGenerator: () => "123456"
  });

  async function requestVerificationCode(app: ReturnType<typeof createApp>, email = "student@example.com") {
    return app.inject({
      method: "POST",
      url: "/auth/verification-code",
      payload: { email }
    });
  }

  it("sends a verification code before registration", async () => {
    const app = createAuthApp();

    const response = await requestVerificationCode(app, "Student@Example.com");
    const rows = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT "email" FROM "EmailVerificationCode"
    `;

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(rows).toEqual([{ email: "student@example.com" }]);

    await app.close();
  });

  it("rejects registration without a valid verification code", async () => {
    const app = createAuthApp();

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123", verificationCode: "000000" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "INVALID_VERIFICATION_CODE" });

    await app.close();
  });

  it("registers a user and returns the starter quota", async () => {
    const app = createAuthApp();

    await requestVerificationCode(app, "Student@Example.com");

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "Student@Example.com", password: "password123", verificationCode: "123456" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      token: expect.any(String),
      user: {
        email: "student@example.com",
        quickReviewQuota: 3,
        deepReviewQuota: 1
      }
    });

    await app.close();
  });

  it("rejects duplicate email registration", async () => {
    const app = createAuthApp();

    await requestVerificationCode(app);
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123", verificationCode: "123456" }
    });
    await requestVerificationCode(app);
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123", verificationCode: "123456" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "EMAIL_ALREADY_REGISTERED" });

    await app.close();
  });

  it("logs in with valid credentials", async () => {
    const app = createAuthApp();

    await requestVerificationCode(app);
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123", verificationCode: "123456" }
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "student@example.com", password: "password123" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      token: expect.any(String),
      user: { email: "student@example.com" }
    });

    await app.close();
  });

  it("rejects invalid login credentials", async () => {
    const app = createAuthApp();

    await requestVerificationCode(app);
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123", verificationCode: "123456" }
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "student@example.com", password: "wrong-password" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "INVALID_CREDENTIALS" });

    await app.close();
  });

  it("returns the current user for a valid bearer token", async () => {
    const app = createAuthApp();

    await requestVerificationCode(app);
    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123", verificationCode: "123456" }
    });
    const { token } = registerResponse.json() as { token: string };
    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        email: "student@example.com",
        quickReviewQuota: 3,
        deepReviewQuota: 1
      }
    });

    await app.close();
  });
});
