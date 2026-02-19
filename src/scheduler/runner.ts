import { Cron } from "croner";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { scheduledTasks } from "../db/schema.js";
import { generateId } from "../util/id.js";
import { logger } from "../util/logger.js";
import type { InboundMessage } from "../types/inbound-message.js";
import type { AppConfig } from "../config/schema.js";

interface SchedulerDeps {
  submitMessage: (message: InboundMessage) => Promise<string>;
  config: AppConfig;
}

interface LiveCron {
  taskId: string;
  cron: Cron;
}

let _deps: SchedulerDeps | null = null;
const _liveCrons = new Map<string, LiveCron>();

export function startScheduler(deps: SchedulerDeps): void {
  _deps = deps;

  if (!deps.config.scheduler.enabled) {
    logger.info("Scheduler disabled in config");
    return;
  }

  const db = getDb();
  const tasks = db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.enabled, true))
    .all();

  for (const task of tasks) {
    createLiveCron(task);
  }

  logger.info({ count: tasks.length }, "Scheduler started");
}

export function stopScheduler(): void {
  for (const [, live] of _liveCrons) {
    live.cron.stop();
  }
  _liveCrons.clear();
  _deps = null;
  logger.info("Scheduler stopped");
}

export function addScheduledTask(input: {
  projectId: string;
  instruction: string;
  cronExpression: string;
  timezone?: string;
  botId?: string;
}) {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const timezone = input.timezone ?? _deps?.config.scheduler.timezone ?? "UTC";

  const task = {
    id,
    projectId: input.projectId,
    botId: input.botId ?? null,
    instruction: input.instruction,
    cronExpression: input.cronExpression,
    timezone,
    enabled: true,
    lastRunAt: null,
    nextRunAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(scheduledTasks).values(task).run();
  logger.info({ taskId: id, cron: input.cronExpression }, "Scheduled task created");

  if (_deps?.config.scheduler.enabled) {
    createLiveCron(task);
  }

  return task;
}

export function removeScheduledTask(id: string): void {
  const live = _liveCrons.get(id);
  if (live) {
    live.cron.stop();
    _liveCrons.delete(id);
  }

  const db = getDb();
  db.delete(scheduledTasks).where(eq(scheduledTasks.id, id)).run();
  logger.info({ taskId: id }, "Scheduled task removed");
}

export function updateScheduledTask(
  id: string,
  updates: {
    instruction?: string;
    cronExpression?: string;
    timezone?: string;
    enabled?: boolean;
    botId?: string;
  },
) {
  const db = getDb();
  db.update(scheduledTasks)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(scheduledTasks.id, id))
    .run();

  // Recreate cron if expression or enabled state changed
  const live = _liveCrons.get(id);
  if (live) {
    live.cron.stop();
    _liveCrons.delete(id);
  }

  const task = db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).get();
  if (task && task.enabled && _deps?.config.scheduler.enabled) {
    createLiveCron(task);
  }

  logger.info({ taskId: id }, "Scheduled task updated");
  return task;
}

export function getScheduledTask(id: string) {
  const db = getDb();
  return db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).get();
}

export function listScheduledTasks() {
  const db = getDb();
  return db.select().from(scheduledTasks).all();
}

function createLiveCron(task: {
  id: string;
  projectId: string;
  botId?: string | null;
  instruction: string;
  cronExpression: string;
  timezone: string;
}) {
  if (!_deps) return;

  try {
    const cron = new Cron(task.cronExpression, {
      timezone: task.timezone,
    }, () => {
      fireCron(task.id).catch((err) => {
        logger.error({ taskId: task.id, err }, "Cron fire error");
      });
    });

    _liveCrons.set(task.id, { taskId: task.id, cron });

    // Update nextRunAt
    const nextRun = cron.nextRun();
    if (nextRun) {
      const db = getDb();
      db.update(scheduledTasks)
        .set({ nextRunAt: nextRun.toISOString() })
        .where(eq(scheduledTasks.id, task.id))
        .run();
    }
  } catch (err) {
    logger.error({ taskId: task.id, cronExpression: task.cronExpression, err }, "Invalid cron expression");
  }
}

async function fireCron(taskId: string): Promise<void> {
  if (!_deps) return;

  const db = getDb();
  const task = db.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).get();
  if (!task || !task.enabled) return;

  logger.info({ taskId, instruction: task.instruction.slice(0, 80) }, "Cron firing");

  const message: InboundMessage = {
    id: generateId(),
    channel: "rest",
    userId: "scheduler",
    projectId: task.projectId,
    botId: task.botId ?? undefined,
    instruction: task.instruction,
    timestamp: new Date(),
  };

  try {
    const jobId = await _deps.submitMessage(message);
    logger.info({ taskId, jobId }, "Cron job submitted");
  } catch (err) {
    logger.error({ taskId, err }, "Cron job submission failed");
  }

  // Update lastRunAt and nextRunAt
  const live = _liveCrons.get(taskId);
  const nextRun = live?.cron.nextRun();
  db.update(scheduledTasks)
    .set({
      lastRunAt: new Date().toISOString(),
      nextRunAt: nextRun?.toISOString() ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(scheduledTasks.id, taskId))
    .run();
}
