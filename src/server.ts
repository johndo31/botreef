import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { healthRoutes } from "./routes/health.js";
import { apiV1Routes } from "./routes/api-v1.js";
import { authPlugin } from "./plugins/auth.js";
import { logger } from "./util/logger.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
  });

  // Plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(websocket);
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(apiV1Routes, { prefix: "/api/v1" });

  // Global error handler
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string; details?: unknown }, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? "INTERNAL_ERROR";

    if (statusCode >= 500) {
      logger.error({ err: error, url: request.url }, "Server error");
    }

    reply.status(statusCode).send({
      error: {
        code,
        message: error.message,
        details: error.details,
      },
    });
  });

  return app;
}
