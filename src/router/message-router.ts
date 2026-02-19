import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { jobs, projects } from "../db/schema.js";
import { resolveIdentity, createUserWithIdentity } from "../auth/identity.js";
import { requirePermission, getUserRole } from "../auth/rbac.js";
import { enqueueJob } from "../queue/producer.js";
import { generateId } from "../util/id.js";
import { NotFoundError } from "../util/errors.js";
import type { InboundMessage } from "../types/inbound-message.js";
import type { JobPayload } from "../types/job.js";
import type { AppConfig } from "../config/schema.js";
import { logger } from "../util/logger.js";
import { getBot } from "../bots/manager.js";

export interface MessageRouterDeps {
  config: AppConfig;
}

let _config: AppConfig | null = null;

export function initRouter(deps: MessageRouterDeps): void {
  _config = deps.config;
}

export async function submitMessage(message: InboundMessage): Promise<string> {
  if (!_config) throw new Error("Router not initialized");

  // 1. Resolve or auto-create user identity
  let identity = await resolveIdentity(message.channel, message.userId, message.userName);
  if (!identity) {
    // Auto-create user for known channels
    identity = await createUserWithIdentity(
      message.userName ?? `${message.channel}-${message.userId}`,
      message.channel,
      message.userId,
      message.userName,
    );
    logger.info({ userId: identity.userId, channel: message.channel }, "Auto-created user");
  }

  // 2. Check permissions
  const role = await getUserRole(identity.userId);
  requirePermission(role, "task:create");

  // 3. Resolve project
  const projectConfig = _config.projects[message.projectId];
  if (!projectConfig) {
    // Check database for project
    const db = getDb();
    const project = db.select().from(projects).where(eq(projects.id, message.projectId)).get();
    if (!project) {
      throw new NotFoundError("Project", message.projectId);
    }
  }

  const projConf = projectConfig ?? {
    repoUrl: "",
    defaultBranch: "main",
    branchStrategy: "feature-per-job" as const,
    autoPush: true,
    autoCreatePr: true,
    requireApproval: false,
  };

  // 4. Create job record
  const db = getDb();
  const jobId = generateId();
  const now = new Date().toISOString();

  db.insert(jobs).values({
    id: jobId,
    projectId: message.projectId,
    userId: identity.userId,
    channel: message.channel,
    channelMessageId: message.channelMessageId,
    instruction: message.instruction,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  }).run();

  // 5. Resolve engine type (bot-specific overrides global)
  let engineType: "claude-code" | "codex" = _config.engine.type;
  if (message.botId) {
    try {
      const bot = getBot(message.botId);
      engineType = bot.engineType as "claude-code" | "codex";
    } catch {
      // Bot may have been deleted — use global engine
    }
  }

  // 5b. Write attachments to disk
  let attachmentPaths: string[] | undefined;
  if (message.attachments && message.attachments.length > 0) {
    const attachDir = path.join(_config.sandbox.workspaceDir, ".attachments", jobId);
    fs.mkdirSync(attachDir, { recursive: true });

    attachmentPaths = [];
    for (const att of message.attachments) {
      const filePath = path.join(attachDir, att.filename);
      const data = typeof att.content === "string" ? Buffer.from(att.content, "base64") : att.content;
      fs.writeFileSync(filePath, data);
      attachmentPaths.push(filePath);
    }
    logger.info({ jobId, count: attachmentPaths.length }, "Attachments written to disk");
  }

  // 6. Enqueue job
  const payload: JobPayload = {
    jobId,
    projectId: message.projectId,
    instruction: message.instruction,
    userId: identity.userId,
    channel: message.channel,
    channelMessageId: message.channelMessageId,
    repoUrl: projConf.repoUrl,
    defaultBranch: projConf.defaultBranch,
    branchStrategy: projConf.branchStrategy,
    autoPush: projConf.autoPush,
    autoCreatePr: projConf.autoCreatePr,
    requireApproval: projConf.requireApproval,
    engineType,
    botId: message.botId,
    verbosity: message.verbosity ?? _config.engine.defaultVerbosity,
    attachmentPaths,
    metadata: message.metadata,
  };

  await enqueueJob(payload);
  logger.info({ jobId, projectId: message.projectId, channel: message.channel }, "Message routed to job");

  return jobId;
}
