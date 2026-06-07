import { createHash, randomInt, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type VerificationCodeRow = {
  id: string;
  codeHash: string;
  expiresAt: Date | string;
};

export type VerificationEmailSender = {
  sendVerificationCode(email: string, code: string): Promise<void>;
};

export const DEFAULT_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

export function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashVerificationCode(email: string, code: string, secret: string) {
  return createHash("sha256")
    .update(`${email}:${code}:${secret}`)
    .digest("hex");
}

export async function saveVerificationCode(
  prisma: PrismaClient,
  email: string,
  codeHash: string,
  expiresAt: Date
) {
  await prisma.$executeRaw`
    INSERT INTO "EmailVerificationCode" ("id", "email", "codeHash", "expiresAt")
    VALUES (${randomUUID()}, ${email}, ${codeHash}, ${expiresAt})
  `;
}

export async function findLatestVerificationCode(prisma: PrismaClient, email: string) {
  const rows = await prisma.$queryRaw<VerificationCodeRow[]>`
    SELECT "id", "codeHash", "expiresAt"
    FROM "EmailVerificationCode"
    WHERE "email" = ${email} AND "consumedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function consumeVerificationCode(prisma: PrismaClient, id: string) {
  await prisma.$executeRaw`
    UPDATE "EmailVerificationCode"
    SET "consumedAt" = ${new Date()}
    WHERE "id" = ${id}
  `;
}

export async function cleanupExpiredVerificationCodes(prisma: PrismaClient, now: Date) {
  await prisma.$executeRaw`
    DELETE FROM "EmailVerificationCode"
    WHERE "expiresAt" < ${now}
  `;
}

