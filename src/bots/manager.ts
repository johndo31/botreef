import { eq, and } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { bots } from "../db/schema.js";
import { generateId } from "../util/id.js";
import { NotFoundError } from "../util/errors.js";
import { logger } from "../util/logger.js";

export interface Bot {
  id: string;
  name: string;
  projectId: string;
  engineType: string;
  model: string | null;
  systemPrompt: string | null;
  status: string;
  pollIntervalSeconds: number;
  maxConcurrentStories: number;
  idleBehavior: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBotInput {
  name: string;
  projectId: string;
  engineType?: "claude-code" | "codex";
  model?: string;
  systemPrompt?: string;
  pollIntervalSeconds?: number;
  maxConcurrentStories?: number;
  idleBehavior?: "wait" | "discovery";
}

export function createBot(input: CreateBotInput): Bot {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const bot = {
    id,
    name: input.name,
    projectId: input.projectId,
    engineType: input.engineType ?? "claude-code",
    model: input.model ?? null,
    systemPrompt: input.systemPrompt ?? null,
    status: "idle" as const,
    pollIntervalSeconds: input.pollIntervalSeconds ?? 30,
    maxConcurrentStories: input.maxConcurrentStories ?? 1,
    idleBehavior: input.idleBehavior ?? "wait",
    createdAt: now,
    updatedAt: now,
  };

  db.insert(bots).values(bot).run();
  logger.info({ botId: id, name: input.name, projectId: input.projectId }, "Bot created");

  return bot as Bot;
}

export function getBot(botId: string): Bot {
  const db = getDb();
  const bot = db.select().from(bots).where(eq(bots.id, botId)).get();
  if (!bot) throw new NotFoundError("Bot", botId);
  return bot as Bot;
}

export function getBotsByProject(projectId: string): Bot[] {
  const db = getDb();
  return db.select().from(bots).where(eq(bots.projectId, projectId)).all() as Bot[];
}

export function getAllActiveBots(): Bot[] {
  const db = getDb();
  return db.select().from(bots)
    .where(eq(bots.status, "idle"))
    .all() as Bot[];
}

export function updateBot(botId: string, updates: Partial<Omit<Bot, "id" | "createdAt">>): Bot {
  const db = getDb();
  const { status, engineType, idleBehavior, ...rest } = updates;
  db.update(bots)
    .set({
      ...rest,
      ...(status ? { status: status as "idle" | "working" | "paused" | "stopped" } : {}),
      ...(engineType ? { engineType: engineType as "claude-code" | "codex" } : {}),
      ...(idleBehavior ? { idleBehavior: idleBehavior as "wait" | "discovery" } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(bots.id, botId))
    .run();
  return getBot(botId);
}

export function updateBotStatus(botId: string, status: "idle" | "working" | "paused" | "stopped"): void {
  const db = getDb();
  db.update(bots)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(bots.id, botId))
    .run();
}

export function deleteBot(botId: string): void {
  const db = getDb();
  db.delete(bots).where(eq(bots.id, botId)).run();
  logger.info({ botId }, "Bot deleted");
}

export function listBots(): Bot[] {
  const db = getDb();
  return db.select().from(bots).all() as Bot[];
}
