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
    const token = bearerToken(request.headers.authorization);
    const auth = token ? verifyAuthToken(token, jwtSecret) : null;
    if (!auth) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    return { user: serializeUser(user) };
  });

  return app;
}
