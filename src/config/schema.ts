import { z } from "zod";

const sshConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().default(2222),
  hostKeyPath: z.string().default("./host.key"),
});

const telegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().optional(),
  allowedChatIds: z.array(z.number()).default([]),
});

const slackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().optional(),
  signingSecret: z.string().optional(),
  appToken: z.string().optional(),
});

const discordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().optional(),
  guildId: z.string().optional(),
});

const githubWebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  webhookSecret: z.string().optional(),
});

const emailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  smtpHost: z.string().optional(),
  smtpPort: z.number().default(587),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().default(993),
  imapUser: z.string().optional(),
  imapPass: z.string().optional(),
  fromAddress: z.string().optional(),
});

const kanbanWebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  secret: z.string().optional(),
  provider: z.enum(["trello", "linear", "github"]).optional(),
});

const restConfigSchema = z.object({
  enabled: z.boolean().default(true),
});

const webConfigSchema = z.object({
  enabled: z.boolean().default(true),
  staticDir: z.string().default("./frontend/dist"),
});

const interfacesConfigSchema = z.object({
  rest: restConfigSchema.default({}),
  web: webConfigSchema.default({}),
  ssh: sshConfigSchema.default({}),
  telegram: telegramConfigSchema.default({}),
  slack: slackConfigSchema.default({}),
  discord: discordConfigSchema.default({}),
  github: githubWebhookConfigSchema.default({}),
  email: emailConfigSchema.default({}),
  kanban: kanbanWebhookConfigSchema.default({}),
});

const engineConfigSchema = z.object({
  type: z.enum(["claude-code", "codex"]).default("claude-code"),
  defaultModel: z.string().default("claude-sonnet-4-20250514"),
  maxTurns: z.number().default(50),
  timeoutMinutes: z.number().default(30),
  apiKey: z.string().optional(),
  defaultVerbosity: z.enum(["quiet", "normal", "verbose"]).default("normal"),
});

const schedulerConfigSchema = z.object({
  enabled: z.boolean().default(false),
  timezone: z.string().default("UTC"),
});

const sandboxConfigSchema = z.object({
  workspaceDir: z.string().default("./workspaces"),
  timeoutSeconds: z.number().default(1800),
});

const serverConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().default(3000),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  maxConcurrentJobs: z.number().default(2),
  encryptionKey: z.string().optional(),
  jwtSecret: z.string().optional(),
  baseUrl: z.string().default("http://localhost:3000"),
});

const redisConfigSchema = z.object({
  host: z.string().default("localhost"),
  port: z.number().default(6379),
  password: z.string().optional(),
  db: z.number().default(0),
});

const databaseConfigSchema = z.object({
  path: z.string().default("./botreef.db"),
});

const agentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  pollIntervalSeconds: z.number().default(30),
  maxConcurrentStories: z.number().default(1),
  idleBehavior: z.enum(["wait", "discovery"]).default("wait"),
});

const projectConfigSchema = z.object({
  repoUrl: z.string(),
  defaultBranch: z.string().default("main"),
  branchStrategy: z.enum(["feature-per-job", "shared", "main-only"]).default("feature-per-job"),
  autoPush: z.boolean().default(true),
  autoCreatePr: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
});

export const configSchema = z.object({
  server: serverConfigSchema.default({}),
  database: databaseConfigSchema.default({}),
  redis: redisConfigSchema.default({}),
  engine: engineConfigSchema.default({}),
  sandbox: sandboxConfigSchema.default({}),
  interfaces: interfacesConfigSchema.default({}),
  agent: agentConfigSchema.default({}),
  scheduler: schedulerConfigSchema.default({}),
  projects: z.record(z.string(), projectConfigSchema).default({}),
});

export type AppConfig = z.infer<typeof configSchema>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type EngineConfig = z.infer<typeof engineConfigSchema>;
export type SandboxConfig = z.infer<typeof sandboxConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;
