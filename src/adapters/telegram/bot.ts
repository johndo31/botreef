import { Bot } from "grammy";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage, Attachment } from "../../types/inbound-message.js";
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
      case "task:completed": {
        let text = `✅ *Task completed*`;
        if (event.data.prUrl) text += `\nPR: ${event.data.prUrl}`;
        if (event.data.commitSha) text += `\nCommit: \`${event.data.commitSha.slice(0, 8)}\``;
        if (event.data.costUsd != null) text += `\nCost: $${event.data.costUsd.toFixed(4)}`;
        if (event.data.inputTokens != null && event.data.outputTokens != null) {
          text += `\nTokens: ${event.data.inputTokens} in / ${event.data.outputTokens} out`;
        }
        await this.bot.api.sendMessage(chatId, text, { parse_mode: "Markdown" });
        this.chatJobMap.delete(event.jobId);
        break;
      }

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

  private async downloadFile(fileId: string): Promise<{ data: Buffer; filename: string }> {
    const file = await this.bot!.api.getFile(fileId);
    const filePath = file.file_path!;
    const url = `https://api.telegram.org/file/bot${this.config.botToken}/${filePath}`;
    const response = await fetch(url);
    const data = Buffer.from(await response.arrayBuffer());
    const filename = filePath.split("/").pop() ?? `file_${fileId}`;
    return { data, filename };
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
        "/help — Show this message\n\n" +
        "You can also send photos or documents with a caption to include them as attachments.",
        { parse_mode: "Markdown" },
      );
    });

    this.bot.command("help", (ctx) => {
      ctx.reply("Usage: /task <project> <instruction>\nExample: /task myapp Fix the login bug\n\nSend a photo/doc with caption: <project> <instruction>");
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

    // Handle photo messages
    this.bot.on("message:photo", async (ctx) => {
      const caption = ctx.message.caption ?? "";
      const spaceIdx = caption.indexOf(" ");

      let projectId: string;
      let instruction: string;

      if (spaceIdx === -1 && caption.length > 0) {
        projectId = caption;
        instruction = "Analyze this image";
      } else if (spaceIdx > 0) {
        projectId = caption.slice(0, spaceIdx);
        instruction = caption.slice(spaceIdx + 1);
      } else {
        await ctx.reply("Send a photo with a caption: <project> <instruction>");
        return;
      }

      try {
        const photos = ctx.message.photo;
        const largest = photos[photos.length - 1]!;
        const { data, filename } = await this.downloadFile(largest.file_id);

        const attachment: Attachment = {
          filename,
          contentType: "image/jpeg",
          content: data,
        };

        const message: InboundMessage = {
          id: generateId(),
          channel: "telegram",
          channelMessageId: String(ctx.message.message_id),
          userId: String(ctx.from?.id),
          userName: ctx.from?.username ?? ctx.from?.first_name,
          projectId,
          instruction,
          attachments: [attachment],
          timestamp: new Date(),
        };

        const jobId = await this.deps.submitMessage(message);
        this.chatJobMap.set(jobId, ctx.chat.id);
        await ctx.reply(`📋 Task created with image: \`${jobId}\``, { parse_mode: "Markdown" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.reply(`❌ ${msg}`);
      }
    });

    // Handle document messages
    this.bot.on("message:document", async (ctx) => {
      const caption = ctx.message.caption ?? "";
      const spaceIdx = caption.indexOf(" ");

      let projectId: string;
      let instruction: string;

      if (spaceIdx === -1 && caption.length > 0) {
        projectId = caption;
        instruction = "Analyze this file";
      } else if (spaceIdx > 0) {
        projectId = caption.slice(0, spaceIdx);
        instruction = caption.slice(spaceIdx + 1);
      } else {
        await ctx.reply("Send a document with a caption: <project> <instruction>");
        return;
      }

      try {
        const doc = ctx.message.document;
        const { data, filename } = await this.downloadFile(doc.file_id);

        const attachment: Attachment = {
          filename: doc.file_name ?? filename,
          contentType: doc.mime_type ?? "application/octet-stream",
          content: data,
        };

        const message: InboundMessage = {
          id: generateId(),
          channel: "telegram",
          channelMessageId: String(ctx.message.message_id),
          userId: String(ctx.from?.id),
          userName: ctx.from?.username ?? ctx.from?.first_name,
          projectId,
          instruction,
          attachments: [attachment],
          timestamp: new Date(),
        };

        const jobId = await this.deps.submitMessage(message);
        this.chatJobMap.set(jobId, ctx.chat.id);
        await ctx.reply(`📋 Task created with attachment: \`${jobId}\``, { parse_mode: "Markdown" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await ctx.reply(`❌ ${msg}`);
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
