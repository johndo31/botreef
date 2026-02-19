import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";
import { logger } from "../../util/logger.js";

interface KanbanWebhookConfig extends AdapterConfig {
  secret?: string;
  provider?: "trello" | "linear" | "github";
}

export class KanbanWebhookAdapter implements Adapter {
  name = "kanban";
  private deps!: AdapterDependencies;
  private config!: KanbanWebhookConfig;

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.config = config as KanbanWebhookConfig;
    this.deps = deps;
  }

  async start(): Promise<void> {
    logger.info("Kanban webhook adapter started");
  }

  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: true, name: this.name };
  }

  async sendEvent(_event: TaskEvent): Promise<void> {
    // External kanban boards are update-only via their APIs if needed
  }

  registerRoutes(app: FastifyInstance): void {
    app.post("/webhooks/kanban", async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = request.body as Record<string, unknown>;

      const parsed = this.parseWebhook(payload);
      if (!parsed) {
        return reply.status(200).send({ message: "Event ignored" });
      }

      try {
        const jobId = await this.deps.submitMessage(parsed);
        reply.status(201).send({ jobId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reply.status(400).send({ error: msg });
      }
    });
  }

  private parseWebhook(payload: Record<string, unknown>): InboundMessage | null {
    if (this.config.secret && payload.secret !== this.config.secret) return null;

    const card = payload.card as Record<string, unknown> | undefined;

    if (!card) return null;

    // Only trigger on card moves to specific lists/columns
    const title = (card.name ?? card.title ?? "") as string;
    const description = (card.desc ?? card.description ?? "") as string;
    const board = payload.board as Record<string, unknown> | undefined;
    const projectId = (payload.projectId ?? board?.name ?? "default") as string;

    if (!title) return null;

    return {
      id: generateId(),
      channel: "kanban",
      userId: (payload.userId ?? "kanban-webhook") as string,
      projectId,
      instruction: `${title}\n\n${description}`.trim(),
      timestamp: new Date(),
    };
  }
}
