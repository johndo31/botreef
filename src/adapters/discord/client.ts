import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } from "discord.js";
import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "../types.js";
import type { TaskEvent } from "../../types/task-event.js";
import { generateId } from "../../util/id.js";
import type { InboundMessage } from "../../types/inbound-message.js";
import { logger } from "../../util/logger.js";

interface DiscordConfig extends AdapterConfig {
  botToken: string;
  guildId?: string;
}

export class DiscordAdapter implements Adapter {
  name = "discord";
  private client: Client | null = null;
  private deps!: AdapterDependencies;
  private config!: DiscordConfig;
  private channelJobMap = new Map<string, string>();

  async init(config: AdapterConfig, deps: AdapterDependencies): Promise<void> {
    this.config = config as DiscordConfig;
    this.deps = deps;

    if (!this.config.botToken) {
      throw new Error("Discord bot token is required");
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async start(): Promise<void> {
    if (!this.client) return;

    // Register slash commands
    await this.registerCommands();

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === "botreef") {
        const projectId = interaction.options.getString("project", true);
        const instruction = interaction.options.getString("instruction", true);

        const message: InboundMessage = {
          id: generateId(),
          channel: "discord",
          channelMessageId: interaction.id,
          userId: interaction.user.id,
          userName: interaction.user.username,
          projectId,
          instruction,
          timestamp: new Date(),
        };

        await interaction.deferReply();

        try {
          const jobId = await this.deps.submitMessage(message);
          this.channelJobMap.set(jobId, interaction.channelId);
          await interaction.editReply(`📋 Task created: \`${jobId}\``);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await interaction.editReply(`❌ Error: ${msg}`);
        }
      }
    });

    await this.client.login(this.config.botToken);
    logger.info("Discord adapter started");
  }

  async stop(): Promise<void> {
    this.client?.destroy();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: this.client?.isReady() ?? false,
      name: this.name,
    };
  }

  async sendEvent(event: TaskEvent): Promise<void> {
    if (!this.client) return;

    const channelId = this.channelJobMap.get(event.jobId);
    if (!channelId) return;

    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased() || !("send" in channel)) return;

    switch (event.type) {
      case "task:completed":
        await channel.send({
          embeds: [{
            title: "✅ Task Completed",
            color: 0x00ff00,
            fields: [
              ...(event.data.prUrl ? [{ name: "Pull Request", value: event.data.prUrl }] : []),
              ...(event.data.commitSha ? [{ name: "Commit", value: `\`${event.data.commitSha.slice(0, 8)}\`` }] : []),
            ],
          }],
        });
        this.channelJobMap.delete(event.jobId);
        break;

      case "task:failed":
        await channel.send({
          embeds: [{
            title: "❌ Task Failed",
            description: event.data.error ?? "Unknown error",
            color: 0xff0000,
          }],
        });
        this.channelJobMap.delete(event.jobId);
        break;

      case "task:approval_required":
        await channel.send({
          embeds: [{
            title: "⏳ Approval Required",
            description: `Branch: \`${event.data.branch}\``,
            color: 0xffaa00,
          }],
        });
        break;
    }
  }

  private async registerCommands(): Promise<void> {
    const rest = new REST().setToken(this.config.botToken);
    const command = new SlashCommandBuilder()
      .setName("botreef")
      .setDescription("Submit a coding task to Botreef")
      .addStringOption((opt) =>
        opt.setName("project").setDescription("Project ID").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("instruction").setDescription("What to do").setRequired(true),
      );

    try {
      if (this.config.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(this.client!.user!.id, this.config.guildId),
          { body: [command.toJSON()] },
        );
      } else {
        await rest.put(Routes.applicationCommands(this.client!.user!.id), {
          body: [command.toJSON()],
        });
      }
      logger.info("Discord slash commands registered");
    } catch (err) {
      logger.error({ err }, "Failed to register Discord commands");
    }
  }
}
