import Fastify from "fastify";

export function createApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    ok: true,
    service: "cnki-literature-review-api"
  }));

  return app;
}
