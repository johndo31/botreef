import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";

// REST adapter routes are handled in src/routes/api-v1.ts
// This module provides the adapter wrapper for the registry

export class RestAdapter implements Adapter {
  name = "rest";
  private deps!: AdapterDependencies;

  async init(_config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.deps = deps;
  }

  async start(): Promise<void> {
    this.deps.logger.info("REST adapter started (routes registered in Fastify)");
  }

  async stop(): Promise<void> {
    // Nothing to stop — Fastify handles it
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: true, name: this.name };
  }

  async sendEvent(_event: TaskEvent): Promise<void> {
    // REST responses are handled via SSE/polling, not push
  }
}
