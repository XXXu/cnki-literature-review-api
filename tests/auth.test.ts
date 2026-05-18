import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

process.env.DATABASE_URL = "file:./test-auth.db";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "User"`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "quickReviewQuota" INTEGER NOT NULL DEFAULT 3,
      "deepReviewQuota" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
});

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth routes", () => {
  it("registers a user and returns the starter quota", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "Student@Example.com", password: "password123" }
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
    const app = createApp({ prisma, jwtSecret: "test-secret" });

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123" }
    });
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123" }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "EMAIL_ALREADY_REGISTERED" });

    await app.close();
  });

  it("logs in with valid credentials", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123" }
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
    const app = createApp({ prisma, jwtSecret: "test-secret" });

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123" }
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
    const app = createApp({ prisma, jwtSecret: "test-secret" });

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@example.com", password: "password123" }
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
