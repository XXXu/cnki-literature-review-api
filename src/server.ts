import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { loadEnvFile } from "./config/envFile.js";
import { initDatabase } from "./db/initDatabase.js";

loadEnvFile();

const prisma = new PrismaClient();
await initDatabase(prisma);

const app = createApp({ prisma, logger: true });
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
