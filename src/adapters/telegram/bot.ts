import { Bot, type Context } from "grammy";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";
import { logger } from "../../util/logger.js";

interface TelegramConfig extends AdapterConfig {
  botToken: string;
  allowedChatIds: number[];
}

export class TelegramAdapter implements Adapter {
  name = "telegram";
  private bot: Bot | null = null;
  private deps!: AdapterDependencies;
  private config!: TelegramConfig;
  private chatJobMap = new Map<string, number>();

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.config = config as TelegramConfig;
    this.deps = deps;

    if (!this.config.botToken) {
      throw new Error("Telegram bot token is required");
    }

    this.bot = new Bot(this.config.botToken);
    this.setupHandlers();
  }

  async start(): Promise<void> {
    if (!this.bot) return;
    this.bot.start({
      onStart: () => logger.info("Telegram bot started"),
    });
  }

  async stop(): Promise<void> {
    this.bot?.stop();
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: this.bot !== null, name: this.name };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    if (!this.bot) return;

    const chatId = this.chatJobMap.get(event.jobId);
    if (!chatId) return;

    switch (event.type) {
      case "task:completed":
        await this.bot.api.sendMessage(chatId,
          `✅ *Task completed*${event.data.prUrl ? `\nPR: ${event.data.prUrl}` : ""}${event.data.commitSha ? `\nCommit: \`${event.data.commitSha.slice(0, 8)}\`` : ""}`,
          { parse_mode: "Markdown" },
        );
        this.chatJobMap.delete(event.jobId);
        break;

      case "task:failed":
        await this.bot.api.sendMessage(chatId,
          `❌ *Task failed*\n${event.data.error ?? "Unknown error"}`,
          { parse_mode: "Markdown" },
        );
        this.chatJobMap.delete(event.jobId);
        break;

      case "task:approval_required":
        await this.bot.api.sendMessage(chatId,
          `⏳ *Approval required*\nBranch: \`${event.data.branch}\`\n\nReply with /approve or /reject`,
          { parse_mode: "Markdown" },
        );
        break;

      case "task:output":
        if (event.data.output && event.data.output.length > 0) {
          const truncated = event.data.output.length > 4000
            ? event.data.output.slice(0, 4000) + "..."
            : event.data.output;
          await this.bot.api.sendMessage(chatId, `\`\`\`\n${truncated}\n\`\`\``, { parse_mode: "Markdown" });
        }
        break;
    }
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    this.bot.command("start", (ctx) => {
      ctx.reply(
        "🤖 *Botreef* — Autonomous Coding Agent\n\n" +
        "Commands:\n" +
        "/task <project> <instruction> — Submit a coding task\n" +
        "/status <jobId> — Check task status\n" +
        "/projects — List projects\n" +
        "/approve — Approve pending task\n" +
        "/reject — Reject pending task\n" +
        "/help — Show this message",
        { parse_mode: "Markdown" },
      );
    });

    this.bot.command("help", (ctx) => {
      ctx.reply("Usage: /task <project> <instruction>\nExample: /task myapp Fix the login bug");
    });

    this.bot.command("task", async (ctx) => {
      const text = ctx.message?.text ?? "";
      const args = text.replace(/^\/task\s*/, "").trim();
      const spaceIdx = args.indexOf(" ");

      if (spaceIdx === -1) {
        await ctx.reply("Usage: /task <project> <instruction>");
        return;
      }

      const projectId = args.slice(0, spaceIdx);
      const instruction = args.slice(spaceIdx + 1);

      const message: InboundMessage = {
        id: generateId(),
        channel: "telegram",
        channelMessageId: String(ctx.message?.message_id),
        userId: String(ctx.from?.id),
        userName: ctx.from?.username ?? ctx.from?.first_name,
        projectId,
        instruction,
        timestamp: new Date(),
      };

      try {
        const jobId = await this.deps.submitMessage(message);
        this.chatJobMap.set(jobId, ctx.chat.id);
        await ctx.reply(`📋 Task created: \`${jobId}\`\nI'll notify you when it's done.`, { parse_mode: "Markdown" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.reply(`❌ Error: ${msg}`);
      }
    });

    // Handle plain text as natural language task submission
    this.bot.on("message:text", async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith("/")) return; // Skip unhandled commands

      // Try to parse as "<project> <instruction>"
      const spaceIdx = text.indexOf(" ");
      if (spaceIdx === -1) {
        await ctx.reply("Send a message like: myproject Fix the login page");
        return;
      }

      const projectId = text.slice(0, spaceIdx);
      const instruction = text.slice(spaceIdx + 1);

      const message: InboundMessage = {
        id: generateId(),
        channel: "telegram",
        channelMessageId: String(ctx.message.message_id),
        userId: String(ctx.from?.id),
        userName: ctx.from?.username ?? ctx.from?.first_name,
        projectId,
        instruction,
        timestamp: new Date(),
      };

      try {
        const jobId = await this.deps.submitMessage(message);
        this.chatJobMap.set(jobId, ctx.chat.id);
        await ctx.reply(`📋 Task created: \`${jobId}\``, { parse_mode: "Markdown" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.reply(`❌ ${msg}`);
      }
    });
  }
}
