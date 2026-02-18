import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { parseGitHubEvent, type ParsedGitHubEvent } from "./parser.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";
import { logger } from "../../util/logger.js";

interface GitHubWebhookConfig extends AdapterConfig {
  webhookSecret?: string;
}

export class GitHubWebhookAdapter implements Adapter {
  name = "github";
  private deps!: AdapterDependencies;
  private config!: GitHubWebhookConfig;

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.config = config as GitHubWebhookConfig;
    this.deps = deps;
  }

  async start(): Promise<void> {
    logger.info("GitHub webhook adapter started (routes registered in Fastify)");
  }

  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: true, name: this.name };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    // GitHub notifications are handled via PR comments by the git/pr module
  }

  registerRoutes(app: FastifyInstance): void {
    app.post("/webhooks/github", async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify signature
      if (this.config.webhookSecret) {
        const signature = request.headers["x-hub-signature-256"] as string;
        if (!signature || !this.verifySignature(JSON.stringify(request.body), signature)) {
          return reply.status(401).send({ error: "Invalid signature" });
        }
      }

      const eventType = request.headers["x-github-event"] as string;
      const payload = request.body as Record<string, unknown>;

      const parsed = parseGitHubEvent(eventType, payload);
      if (!parsed) {
        return reply.status(200).send({ message: "Event ignored" });
      }

      const message: InboundMessage = {
        id: generateId(),
        channel: "github",
        channelMessageId: String(parsed.id),
        userId: parsed.userId,
        userName: parsed.userName,
        projectId: parsed.projectId,
        instruction: parsed.instruction,
        timestamp: new Date(),
      };

      try {
        const jobId = await this.deps.submitMessage(message);
        reply.status(201).send({ jobId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reply.status(400).send({ error: msg });
      }
    });
  }

  private verifySignature(payload: string, signature: string): boolean {
    const expected = "sha256=" + createHmac("sha256", this.config.webhookSecret!)
      .update(payload)
      .digest("hex");
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
