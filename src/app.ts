import { Prisma, PrismaClient, type User } from "@prisma/client";
import Fastify from "fastify";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { signAuthToken, verifyAuthToken } from "./auth/token.js";

type AppOptions = {
  prisma?: PrismaClient;
  jwtSecret?: string;
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const paperSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  abstract: z.string().optional().default(""),
  keywords: z.array(z.string()).optional().default([]),
  fullText: z.string().optional()
});

const reviewRequestSchema = z.object({
  papers: z.array(paperSchema).min(1).max(200)
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    quickReviewQuota: user.quickReviewQuota,
    deepReviewQuota: user.deepReviewQuota
  };
}

function bearerToken(authorization: string | undefined) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAuthenticatedUser(
  prisma: PrismaClient,
  authorization: string | undefined,
  jwtSecret: string
) {
  const token = bearerToken(authorization);
  const auth = token ? verifyAuthToken(token, jwtSecret) : null;
  if (!auth) return null;

  return prisma.user.findUnique({ where: { id: auth.userId } });
}

function quota(user: User) {
  return {
    quickReviewQuota: user.quickReviewQuota,
    deepReviewQuota: user.deepReviewQuota
  };
}

function buildQuickReport(papers: Array<z.infer<typeof paperSchema>>) {
  return [
    "# 快速综述",
    "",
    `本次基于 ${papers.length} 篇文献的题录、摘要和关键词生成初步综述素材。`,
    "",
    "## 待分析文献",
    "",
    ...papers.map((paper) => `- ${paper.id} ${paper.title}`)
  ].join("\n");
}

function buildDeepReport(papers: Array<z.infer<typeof paperSchema>>) {
  return [
    "# 深度综述",
    "",
    `本次基于 ${papers.length} 篇文献的题录、摘要、关键词和 PDF 全文生成深度综述素材。`,
    "",
    "## 全文文献",
    "",
    ...papers.map((paper) => `- ${paper.id} ${paper.title}`)
  ].join("\n");
}

export function createApp(options: AppOptions = {}) {
  const app = Fastify({ logger: false });
  const prisma = options.prisma ?? new PrismaClient();
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? "development-secret";

  if (!options.prisma) {
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  }

  app.get("/health", async () => ({
    ok: true,
    service: "cnki-literature-review-api"
  }));

  app.post("/auth/register", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }

    const email = normalizeEmail(parsed.data.email);
    const passwordHash = await hashPassword(parsed.data.password);

    try {
      const user = await prisma.user.create({
        data: { email, passwordHash }
      });
      return reply.code(201).send({
        token: signAuthToken({ userId: user.id }, jwtSecret),
        user: serializeUser(user)
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
      }
      throw error;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }

    const email = normalizeEmail(parsed.data.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    return {
      token: signAuthToken({ userId: user.id }, jwtSecret),
      user: serializeUser(user)
    };
  });

  app.get("/me", async (request, reply) => {
    const user = await getAuthenticatedUser(prisma, request.headers.authorization, jwtSecret);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    return { user: serializeUser(user) };
  });

  app.post("/review/quick", async (request, reply) => {
    const user = await getAuthenticatedUser(prisma, request.headers.authorization, jwtSecret);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const parsed = reviewRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }
    if (user.quickReviewQuota < 1) {
      return reply.code(402).send({ error: "QUICK_REVIEW_QUOTA_EXHAUSTED" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { quickReviewQuota: { decrement: 1 } }
    });

    return {
      report: buildQuickReport(parsed.data.papers),
      quota: quota(updatedUser)
    };
  });

  app.post("/review/deep", async (request, reply) => {
    const user = await getAuthenticatedUser(prisma, request.headers.authorization, jwtSecret);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const parsed = reviewRequestSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.papers.some((paper) => !paper.fullText)) {
      return reply.code(400).send({ error: "INVALID_REQUEST" });
    }
    if (user.deepReviewQuota < 1) {
      return reply.code(402).send({ error: "DEEP_REVIEW_QUOTA_EXHAUSTED" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { deepReviewQuota: { decrement: 1 } }
    });

    return {
      report: buildDeepReport(parsed.data.papers),
      quota: quota(updatedUser)
    };
  });

  return app;
}
