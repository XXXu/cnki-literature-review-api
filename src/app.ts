import { Prisma, PrismaClient, type User } from "@prisma/client";
import Fastify, { type FastifyServerOptions } from "fastify";
import { z } from "zod";
import { createDeepSeekClient } from "./ai/deepseekClient.js";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { signAuthToken, verifyAuthToken } from "./auth/token.js";
import { loadConfig } from "./config/env.js";
import { createReviewGenerator, type ReviewGenerator } from "./review/reviewGenerator.js";

type AppOptions = {
  prisma?: PrismaClient;
  jwtSecret?: string;
  reviewGenerator?: ReviewGenerator;
  logger?: FastifyServerOptions["logger"];
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

const QUICK_REVIEW_MAX_PAPERS = 200;
const DEEP_REVIEW_MAX_PAPERS = 50;
const STARTER_QUICK_REVIEW_QUOTA = 3;
const STARTER_DEEP_REVIEW_QUOTA = 1;

const reviewRequestSchema = z.object({
  papers: z.array(paperSchema).min(1)
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

export function createApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const config = loadConfig();
  const prisma = options.prisma ?? new PrismaClient();
  const jwtSecret = options.jwtSecret ?? config.jwtSecret;
  const reviewGenerator = options.reviewGenerator ?? createReviewGenerator(createDeepSeekClient({
    apiKey: config.deepSeekApiKey,
    baseUrl: config.deepSeekBaseUrl,
    model: config.deepSeekModel
  }));

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
        data: {
          email,
          passwordHash,
          quickReviewQuota: STARTER_QUICK_REVIEW_QUOTA,
          deepReviewQuota: STARTER_DEEP_REVIEW_QUOTA
        }
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
    if (parsed.data.papers.length > QUICK_REVIEW_MAX_PAPERS) {
      return reply.code(400).send({ error: "QUICK_REVIEW_PAPER_LIMIT_EXCEEDED" });
    }
    if (user.quickReviewQuota < 1) {
      return reply.code(402).send({ error: "QUICK_REVIEW_QUOTA_EXHAUSTED" });
    }

    request.log.info({
      userId: user.id,
      paperCount: parsed.data.papers.length
    }, "quick_review_started");
    let report: string;
    try {
      report = await reviewGenerator.generateQuickReview(parsed.data.papers);
    } catch (error) {
      request.log.error({ err: error, userId: user.id }, "quick_review_failed");
      throw error;
    }
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { quickReviewQuota: { decrement: 1 } }
    });
    request.log.info({
      userId: user.id,
      quickReviewQuota: updatedUser.quickReviewQuota
    }, "quick_review_completed");

    return {
      report,
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
    if (parsed.data.papers.length > DEEP_REVIEW_MAX_PAPERS) {
      return reply.code(400).send({ error: "DEEP_REVIEW_PAPER_LIMIT_EXCEEDED" });
    }
    if (user.deepReviewQuota < 1) {
      return reply.code(402).send({ error: "DEEP_REVIEW_QUOTA_EXHAUSTED" });
    }

    request.log.info({
      userId: user.id,
      paperCount: parsed.data.papers.length
    }, "deep_review_started");
    let report: string;
    try {
      report = await reviewGenerator.generateDeepReview(parsed.data.papers);
    } catch (error) {
      request.log.error({ err: error, userId: user.id }, "deep_review_failed");
      throw error;
    }
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { deepReviewQuota: { decrement: 1 } }
    });
    request.log.info({
      userId: user.id,
      deepReviewQuota: updatedUser.deepReviewQuota
    }, "deep_review_completed");

    return {
      report,
      quota: quota(updatedUser)
    };
  });

  return app;
}
