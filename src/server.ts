import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { loadEnvFile } from "./config/envFile.js";
import { loadLoggerConfig } from "./config/logger.js";
import { initDatabase } from "./db/initDatabase.js";

loadEnvFile();

const prisma = new PrismaClient();
await initDatabase(prisma);

const logger = loadLoggerConfig();
mkdirSync(dirname(resolve(logger.file)), { recursive: true });

const app = createApp({ prisma, logger });
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
  app.log.info(`API service listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
