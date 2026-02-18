import { Server, type Connection, type Session } from "ssh2";
import { readFileSync, existsSync } from "node:fs";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { SshRepl } from "./repl.js";
import { logger } from "../../util/logger.js";

interface SshConfig extends AdapterConfig {
  port: number;
  hostKeyPath: string;
}

export class SshAdapter implements Adapter {
  name = "ssh";
  private server: Server | null = null;
  private deps!: AdapterDependencies;
  private config!: SshConfig;
  private sessions = new Map<string, SshRepl>();

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.config = config as SshConfig;
    this.deps = deps;
  }

  async start(): Promise<void> {
    const hostKeyPath = this.config.hostKeyPath ?? "./host.key";
    if (!existsSync(hostKeyPath)) {
      logger.warn(`SSH host key not found at ${hostKeyPath}. Generate with: ssh-keygen -t ed25519 -f ${hostKeyPath} -N ""`);
      return;
    }

    this.server = new Server(
      { hostKeys: [readFileSync(hostKeyPath)] },
      (client: Connection) => {
        this.handleConnection(client);
      },
    );

    const port = this.config.port ?? 2222;
    this.server.listen(port, "0.0.0.0", () => {
      logger.info({ port }, "SSH server listening");
    });
  }

  async stop(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.server !== null,
      name: this.name,
      details: { activeSessions: this.sessions.size },
    };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === event.userId) {
        session.writeEvent(event);
      }
    }
  }

  private handleConnection(client: Connection): void {
    let username = "";

    client.on("authentication", (ctx) => {
      username = ctx.username;
      // Accept all auth for now — rely on identity resolution
      ctx.accept();
    });

    client.on("ready", () => {
      logger.info({ username }, "SSH client authenticated");

      client.on("session", (accept) => {
        const session = accept();
        const repl = new SshRepl(username, this.deps);
        const sessionId = `${username}-${Date.now()}`;
        this.sessions.set(sessionId, repl);

        session.on("pty", (accept) => accept());
        session.on("shell", (accept) => {
          const stream = accept();
          repl.attach(stream);
        });

        session.on("close", () => {
          repl.close();
          this.sessions.delete(sessionId);
        });
      });
    });

    client.on("error", (err) => {
      logger.error({ err }, "SSH client error");
    });
  }
}
