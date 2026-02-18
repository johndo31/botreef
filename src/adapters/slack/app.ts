import { App } from "@slack/bolt";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";
import { logger } from "../../util/logger.js";

interface SlackConfig extends AdapterConfig {
  botToken: string;
  signingSecret: string;
  appToken: string;
}

export class SlackAdapter implements Adapter {
  name = "slack";
  private app: App | null = null;
  private deps!: AdapterDependencies;
  private config!: SlackConfig;
  private channelJobMap = new Map<string, { channel: string; threadTs?: string }>();

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.config = config as SlackConfig;
    this.deps = deps;

    if (!this.config.botToken || !this.config.signingSecret) {
      throw new Error("Slack bot token and signing secret are required");
    }

    this.app = new App({
      token: this.config.botToken,
      signingSecret: this.config.signingSecret,
      appToken: this.config.appToken,
      socketMode: !!this.config.appToken,
    });

    this.setupHandlers();
  }

  async start(): Promise<void> {
    if (!this.app) return;
    await this.app.start();
    logger.info("Slack adapter started");
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: this.app !== null, name: this.name };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    if (!this.app) return;

    const target = this.channelJobMap.get(event.jobId);
    if (!target) return;

    switch (event.type) {
      case "task:completed":
        await this.app.client.chat.postMessage({
          channel: target.channel,
          thread_ts: target.threadTs,
          text: `✅ Task completed${event.data.prUrl ? ` — <${event.data.prUrl}|View PR>` : ""}`,
        });
        this.channelJobMap.delete(event.jobId);
        break;

      case "task:failed":
        await this.app.client.chat.postMessage({
          channel: target.channel,
          thread_ts: target.threadTs,
          text: `❌ Task failed: ${event.data.error ?? "Unknown error"}`,
        });
        this.channelJobMap.delete(event.jobId);
        break;

      case "task:approval_required":
        await this.app.client.chat.postMessage({
          channel: target.channel,
          thread_ts: target.threadTs,
          text: `⏳ Approval required for branch \`${event.data.branch}\``,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `⏳ *Approval required*\nBranch: \`${event.data.branch}\`` },
            },
            {
              type: "actions",
              elements: [
                { type: "button", text: { type: "plain_text", text: "Approve" }, style: "primary", action_id: `approve_${event.jobId}` },
                { type: "button", text: { type: "plain_text", text: "Reject" }, style: "danger", action_id: `reject_${event.jobId}` },
              ],
            },
          ],
        });
        break;
    }
  }

  private setupHandlers(): void {
    if (!this.app) return;

    this.app.command("/botreef", async ({ command, ack, respond }) => {
      await ack();

      const args = command.text.trim();
      const spaceIdx = args.indexOf(" ");
      if (spaceIdx === -1) {
        await respond("Usage: /botreef <project> <instruction>");
        return;
      }

      const projectId = args.slice(0, spaceIdx);
      const instruction = args.slice(spaceIdx + 1);

      const message: InboundMessage = {
        id: generateId(),
        channel: "slack",
        channelMessageId: command.trigger_id,
        userId: command.user_id,
        userName: command.user_name,
        projectId,
        instruction,
        timestamp: new Date(),
      };

      try {
        const jobId = await this.deps.submitMessage(message);
        this.channelJobMap.set(jobId, { channel: command.channel_id });
        await respond(`📋 Task created: \`${jobId}\``);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await respond(`❌ Error: ${msg}`);
      }
    });

    this.app.event("app_mention", async ({ event, say }) => {
      const text = event.text.replace(/<@[^>]+>\s*/, "").trim();
      const spaceIdx = text.indexOf(" ");

      if (spaceIdx === -1) {
        await say({ text: "Usage: @botreef <project> <instruction>", thread_ts: event.ts });
        return;
      }

      const projectId = text.slice(0, spaceIdx);
      const instruction = text.slice(spaceIdx + 1);

      const message: InboundMessage = {
        id: generateId(),
        channel: "slack",
        channelMessageId: event.ts,
        userId: event.user ?? "",
        projectId,
        instruction,
        timestamp: new Date(),
      };

      try {
        const jobId = await this.deps.submitMessage(message);
        this.channelJobMap.set(jobId, { channel: event.channel, threadTs: event.ts });
        await say({ text: `📋 Task created: \`${jobId}\``, thread_ts: event.ts });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await say({ text: `❌ ${msg}`, thread_ts: event.ts });
      }
    });
  }
}
