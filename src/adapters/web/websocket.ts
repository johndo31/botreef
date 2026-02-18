import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import type { WebSocket } from "@fastify/websocket";
import { onTaskEvent } from "../../router/event-dispatcher.js";
import { logger } from "../../util/logger.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  subscribedJobs: Set<string>;
}

export class WebAdapter implements Adapter {
  name = "web";
  private deps!: AdapterDependencies;
  private clients = new Map<string, WebSocketClient>();
  private unsubscribe?: () => void;

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.deps = deps;
  }

  async start(): Promise<void> {
    this.unsubscribe = onTaskEvent((event) => {
      this.broadcastEvent(event);
    });
    logger.info("WebSocket adapter started");
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      name: this.name,
      details: { connectedClients: this.clients.size },
    };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    this.broadcastEvent(event);
  }

  handleConnection(ws: WebSocket): void {
    const clientId = generateId();
    const client: WebSocketClient = { ws, subscribedJobs: new Set() };
    this.clients.set(clientId, client);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString("utf8"));
        this.handleClientMessage(clientId, client, msg);
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      this.clients.delete(clientId);
    });

    ws.send(JSON.stringify({ type: "connected", clientId }));
  }

  private handleClientMessage(
    clientId: string,
    client: WebSocketClient,
    msg: Record<string, unknown>,
  ): void {
    switch (msg.type) {
      case "subscribe":
        if (typeof msg.jobId === "string") {
          client.subscribedJobs.add(msg.jobId);
        }
        break;

      case "unsubscribe":
        if (typeof msg.jobId === "string") {
          client.subscribedJobs.delete(msg.jobId);
        }
        break;

      case "submit": {
        const message: InboundMessage = {
          id: generateId(),
          channel: "web",
          userId: (msg.userId as string) ?? clientId,
          projectId: msg.projectId as string,
          instruction: msg.instruction as string,
          timestamp: new Date(),
        };
        this.deps.submitMessage(message)
          .then((jobId) => {
            client.ws.send(JSON.stringify({ type: "job_created", jobId }));
            client.subscribedJobs.add(jobId);
          })
          .catch((err) => {
            client.ws.send(JSON.stringify({ type: "error", message: String(err) }));
          });
        break;
      }

      case "auth":
        client.userId = msg.userId as string;
        break;
    }
  }

  private broadcastEvent(event: TaskEvent): void {
    const payload = JSON.stringify({
      type: event.type,
      jobId: event.jobId,
      ...event.data,
    });

    for (const client of this.clients.values()) {
      if (client.subscribedJobs.has(event.jobId) || client.subscribedJobs.has("*")) {
        try {
          client.ws.send(payload);
        } catch {
          // Client disconnected
        }
      }
    }
  }
}
