import { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "../../util/logger.js";

export async function registerWebRoutes(app: FastifyInstance, staticDir: string): Promise<void> {
  const resolvedDir = resolve(staticDir);

  if (existsSync(resolvedDir)) {
    await app.register(fastifyStatic, {
      root: resolvedDir,
      prefix: "/",
      wildcard: false,
    });

    // SPA fallback
    app.setNotFoundHandler((_request, reply) => {
      reply.sendFile("index.html");
    });

    logger.info({ staticDir: resolvedDir }, "Web UI static files registered");
  } else {
    logger.warn({ staticDir: resolvedDir }, "Frontend build not found, Web UI unavailable");
  }
}
