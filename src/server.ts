import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

try {
  await app.listen({ port, host });
  app.log.info(`API service listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
