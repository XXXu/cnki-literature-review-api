import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

process.env.DATABASE_URL = "file:./test-review-quota.db";

const prisma = new PrismaClient();

beforeAll(async () => {
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
});

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function registerAndGetToken(app: ReturnType<typeof createApp>) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: "student@example.com", password: "password123" }
  });
  return (response.json() as { token: string }).token;
}

const quickPayload = {
  papers: [
    {
      id: "P0001",
      title: "乡村教育数字化转型研究",
      abstract: "本文讨论乡村教育数字化转型的路径与问题。",
      keywords: ["乡村教育", "数字化转型"]
    }
  ]
};

const deepPayload = {
  papers: [
    {
      id: "P0001",
      title: "乡村教育数字化转型研究",
      abstract: "本文讨论乡村教育数字化转型的路径与问题。",
      keywords: ["乡村教育", "数字化转型"],
      fullText: "这里是用户合法获取 PDF 后由插件提取出的全文文本。"
    }
  ]
};

function makeQuickPapers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `P${String(index + 1).padStart(4, "0")}`,
    title: `测试论文 ${index + 1}`,
    abstract: "这是一段摘要。",
    keywords: ["文献综述"]
  }));
}

function makeDeepPapers(count: number) {
  return makeQuickPapers(count).map((paper) => ({
    ...paper,
    fullText: "这是一段 PDF 全文。"
  }));
}

describe("review quota routes", () => {
  it("requires auth before generating a quick review", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });

    const response = await app.inject({
      method: "POST",
      url: "/review/quick",
      payload: quickPayload
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "UNAUTHORIZED" });

    await app.close();
  });

  it("deducts one quick review quota and returns a quick report", async () => {
    const app = createApp({
      prisma,
      jwtSecret: "test-secret",
      reviewGenerator: {
        generateQuickReview: async () => "快速综述：模型生成内容",
        generateDeepReview: async () => "深度综述：模型生成内容"
      }
    });
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/review/quick",
      headers: { authorization: `Bearer ${token}` },
      payload: quickPayload
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      report: expect.stringContaining("快速综述"),
      quota: { quickReviewQuota: 2, deepReviewQuota: 0 }
    });

    await app.close();
  });

  it("rejects quick review generation when quota is exhausted", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });
    const token = await registerAndGetToken(app);
    await prisma.user.update({
      where: { email: "student@example.com" },
      data: { quickReviewQuota: 0 }
    });

    const response = await app.inject({
      method: "POST",
      url: "/review/quick",
      headers: { authorization: `Bearer ${token}` },
      payload: quickPayload
    });

    expect(response.statusCode).toBe(402);
    expect(response.json()).toEqual({ error: "QUICK_REVIEW_QUOTA_EXHAUSTED" });

    await app.close();
  });

  it("rejects quick review generation above 200 papers", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/review/quick",
      headers: { authorization: `Bearer ${token}` },
      payload: { papers: makeQuickPapers(201) }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "QUICK_REVIEW_PAPER_LIMIT_EXCEEDED" });

    await app.close();
  });

  it("keeps quick review quota when report generation fails", async () => {
    const app = createApp({
      prisma,
      jwtSecret: "test-secret",
      reviewGenerator: {
        generateQuickReview: async () => {
          throw new Error("deepseek unavailable");
        },
        generateDeepReview: async () => "deep review"
      }
    });
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/review/quick",
      headers: { authorization: `Bearer ${token}` },
      payload: quickPayload
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "student@example.com" }
    });

    expect(response.statusCode).toBe(500);
    expect(user.quickReviewQuota).toBe(3);

    await app.close();
  });

  it("deducts one deep review quota and returns a deep report", async () => {
    const app = createApp({
      prisma,
      jwtSecret: "test-secret",
      reviewGenerator: {
        generateQuickReview: async () => "快速综述：模型生成内容",
        generateDeepReview: async () => "深度综述：模型生成内容"
      }
    });
    const token = await registerAndGetToken(app);
    await prisma.user.update({
      where: { email: "student@example.com" },
      data: { deepReviewQuota: 1 }
    });

    const response = await app.inject({
      method: "POST",
      url: "/review/deep",
      headers: { authorization: `Bearer ${token}` },
      payload: deepPayload
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      report: expect.stringContaining("深度综述"),
      quota: { quickReviewQuota: 3, deepReviewQuota: 0 }
    });

    await app.close();
  });

  it("rejects deep review generation above 50 papers", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });
    const token = await registerAndGetToken(app);
    await prisma.user.update({
      where: { email: "student@example.com" },
      data: { deepReviewQuota: 1 }
    });

    const response = await app.inject({
      method: "POST",
      url: "/review/deep",
      headers: { authorization: `Bearer ${token}` },
      payload: { papers: makeDeepPapers(51) }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "DEEP_REVIEW_PAPER_LIMIT_EXCEEDED" });

    await app.close();
  });

  it("rejects deep review generation when quota is exhausted", async () => {
    const app = createApp({ prisma, jwtSecret: "test-secret" });
    const token = await registerAndGetToken(app);

    const response = await app.inject({
      method: "POST",
      url: "/review/deep",
      headers: { authorization: `Bearer ${token}` },
      payload: deepPayload
    });

    expect(response.statusCode).toBe(402);
    expect(response.json()).toEqual({ error: "DEEP_REVIEW_QUOTA_EXHAUSTED" });

    await app.close();
  });

  it("keeps deep review quota when report generation fails", async () => {
    const app = createApp({
      prisma,
      jwtSecret: "test-secret",
      reviewGenerator: {
        generateQuickReview: async () => "quick review",
        generateDeepReview: async () => {
          throw new Error("deepseek unavailable");
        }
      }
    });
    const token = await registerAndGetToken(app);
    await prisma.user.update({
      where: { email: "student@example.com" },
      data: { deepReviewQuota: 1 }
    });

    const response = await app.inject({
      method: "POST",
      url: "/review/deep",
      headers: { authorization: `Bearer ${token}` },
      payload: deepPayload
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "student@example.com" }
    });

    expect(response.statusCode).toBe(500);
    expect(user.deepReviewQuota).toBe(1);

    await app.close();
  });
});
