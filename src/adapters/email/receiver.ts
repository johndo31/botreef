import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { sendEmail } from "./sender.js";
import { logger } from "../../util/logger.js";

interface EmailConfig extends AdapterConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  fromAddress?: string;
}

export class EmailAdapter implements Adapter {
  name = "email";
  private config!: EmailConfig;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private emailJobMap = new Map<string, string>();

  async init(config: AdapterConfig, _deps: AdapterDependencies): Promise<void> {
    this.config = config as EmailConfig;
  }

  async start(): Promise<void> {
    // In a full implementation, this would connect to IMAP and poll for new emails
    logger.info("Email adapter started (IMAP polling not yet implemented — use REST API for now)");
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: true, name: this.name };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    const recipientEmail = this.emailJobMap.get(event.jobId);
    if (!recipientEmail || !this.config.fromAddress) return;

    switch (event.type) {
      case "task:completed":
        await sendEmail({
          host: this.config.smtpHost!,
          port: this.config.smtpPort!,
          user: this.config.smtpUser!,
          pass: this.config.smtpPass!,
          from: this.config.fromAddress,
          to: recipientEmail,
          subject: `[Botreef] Task completed: ${event.jobId}`,
          body: `Task completed successfully.\n\n${event.data.prUrl ? `PR: ${event.data.prUrl}\n` : ""}${event.data.commitSha ? `Commit: ${event.data.commitSha}\n` : ""}`,
        });
        this.emailJobMap.delete(event.jobId);
        break;

      case "task:failed":
        await sendEmail({
          host: this.config.smtpHost!,
          port: this.config.smtpPort!,
          user: this.config.smtpUser!,
          pass: this.config.smtpPass!,
          from: this.config.fromAddress,
          to: recipientEmail,
          subject: `[Botreef] Task failed: ${event.jobId}`,
          body: `Task failed.\n\nError: ${event.data.error ?? "Unknown error"}`,
        });
        this.emailJobMap.delete(event.jobId);
        break;
    }
  }
}
