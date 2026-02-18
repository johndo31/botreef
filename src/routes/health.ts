import { type FastifyInstance } from "fastify";
import { healthCheckAll } from "../adapters/registry.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, _reply) => {
    const adapters = await healthCheckAll();
    const allHealthy = adapters.every((a) => a.healthy);

    return {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
      adapters,
    };
  });
}
