import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { initDatabase } from "../src/db/initDatabase.js";

process.env.DATABASE_URL = "file:./test-init.db";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("initDatabase", () => {
  it("creates the user table needed by auth routes", async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "User"`);

    await initDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        email: "student@example.com",
        passwordHash: "hash"
      }
    });

    expect(user.quickReviewQuota).toBe(3);
    expect(user.deepReviewQuota).toBe(1);
  });
});
