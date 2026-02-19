import { and, eq, asc } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { kanbanColumns, kanbanStories } from "../db/schema.js";
import { getBoardByProject, getBoard, type Board } from "./board.js";
import { moveStory, updateStory, type Story } from "./stories.js";
import { generateId } from "../util/id.js";
import type { InboundMessage, Attachment } from "../types/inbound-message.js";
import { logger } from "../util/logger.js";
import type { Bot } from "../bots/manager.js";
import { getBot, updateBotStatus, listBots } from "../bots/manager.js";
import { writeJournalEntry } from "../bots/journal.js";
import * as fs from "node:fs";

export interface AgentLoopDeps {
  submitMessage: (message: InboundMessage) => Promise<string>;
}

interface BotLoop {
  botId: string;
  timer: ReturnType<typeof setInterval>;
  activeStories: number;
}

const _botLoops = new Map<string, BotLoop>();

export function startBotLoop(bot: Bot, deps: AgentLoopDeps): void {
  if (_botLoops.has(bot.id)) return;

  logger.info(
    { botId: bot.id, name: bot.name, pollInterval: bot.pollIntervalSeconds },
    "Bot loop started",
  );

  const loop: BotLoop = {
    botId: bot.id,
    timer: null as any,
    activeStories: 0,
  };

  tickBotLoop(bot.id, deps).catch((err) => {
    logger.error({ botId: bot.id, err }, "Bot loop tick error");
  });

  loop.timer = setInterval(() => {
    tickBotLoop(bot.id, deps).catch((err) => {
      logger.error({ botId: bot.id, err }, "Bot loop tick error");
    });
  }, bot.pollIntervalSeconds * 1000);

  _botLoops.set(bot.id, loop);
}

export function stopBotLoop(botId: string): void {
  const loop = _botLoops.get(botId);
  if (loop) {
    clearInterval(loop.timer);
    _botLoops.delete(botId);
    logger.info({ botId }, "Bot loop stopped");
  }
}

export function stopAllBotLoops(): void {
  for (const [botId] of _botLoops) {
    stopBotLoop(botId);
  }
  logger.info("All bot loops stopped");
}

export function isBotLoopRunning(botId: string): boolean {
  return _botLoops.has(botId);
}

export function startAllBotLoops(deps: AgentLoopDeps): void {
  const allBots = listBots();
  for (const bot of allBots) {
    if (bot.status !== "stopped" && bot.status !== "paused") {
      startBotLoop(bot, deps);
    }
  }
}

async function tickBotLoop(botId: string, deps: AgentLoopDeps): Promise<void> {
  const loop = _botLoops.get(botId);
  if (!loop) return;

  let bot: Bot;
  try {
    bot = getBot(botId);
  } catch {
    stopBotLoop(botId);
    return;
  }

  if (bot.status === "stopped" || bot.status === "paused") {
    stopBotLoop(botId);
    return;
  }

  if (loop.activeStories >= bot.maxConcurrentStories) return;

  const board = getBoardByProject(bot.projectId);
  if (!board) return;

  const stories = getBotTodoStories(board.id, botId);
  if (stories.length === 0) return;

  const story = stories[0]!;
  await pickAndExecuteStory(bot, board, story, deps, loop);
}

function getBotTodoStories(boardId: string, botId: string): Story[] {
  const db = getDb();

  const todoColumn = db
    .select()
    .from(kanbanColumns)
    .where(and(eq(kanbanColumns.boardId, boardId), eq(kanbanColumns.name, "Todo")))
    .get();

  if (!todoColumn) return [];

  return db
    .select()
    .from(kanbanStories)
    .where(
      and(
        eq(kanbanStories.columnId, todoColumn.id),
        eq(kanbanStories.assigneeType, "bot"),
        eq(kanbanStories.assignee, botId),
      ),
    )
    .orderBy(asc(kanbanStories.priority), asc(kanbanStories.position))
    .all() as Story[];
}

async function pickAndExecuteStory(
  bot: Bot,
  board: Board,
  story: Story,
  deps: AgentLoopDeps,
  loop: BotLoop,
): Promise<void> {
  loop.activeStories++;
  updateBotStatus(bot.id, "working");

  try {
    const inProgressColumn = board.columns.find((c) => c.name === "In Progress");
    if (inProgressColumn) {
      moveStory(story.id, inProgressColumn.id);
    }

    logger.info({ botId: bot.id, storyId: story.id, title: story.title }, "Bot picked story");

    writeJournalEntry({
      botId: bot.id,
      entryType: "task_started",
      summary: `Started working on: ${story.title}`,
      storyId: story.id,
    });

    let instruction = story.title;
    if (story.description) {
      instruction += `\n\n${story.description}`;
    }
    if (story.acceptanceCriteria) {
      instruction += `\n\nAcceptance Criteria:\n${story.acceptanceCriteria}`;
    }

    // Parse story attachments if present
    let attachments: Attachment[] | undefined;
    if (story.attachments) {
      try {
        const parsed = JSON.parse(story.attachments) as Array<{ filename: string; path: string }>;
        attachments = [];
        for (const att of parsed) {
          if (fs.existsSync(att.path)) {
            attachments.push({
              filename: att.filename,
              contentType: "application/octet-stream",
              content: fs.readFileSync(att.path),
            });
          }
        }
        if (attachments.length === 0) attachments = undefined;
      } catch {
        // Invalid JSON — ignore attachments
      }
    }

    const message: InboundMessage = {
      id: generateId(),
      channel: "bot",
      userId: bot.id,
      botId: bot.id,
      projectId: bot.projectId,
      instruction,
      attachments,
      timestamp: new Date(),
    };

    const jobId = await deps.submitMessage(message);
    updateStory(story.id, { jobId });

    logger.info({ botId: bot.id, storyId: story.id, jobId }, "Bot story submitted as job");
  } catch (err) {
    logger.error({ botId: bot.id, storyId: story.id, err }, "Bot failed to execute story");

    writeJournalEntry({
      botId: bot.id,
      entryType: "task_failed",
      summary: `Failed to start: ${story.title} — ${err instanceof Error ? err.message : String(err)}`,
      storyId: story.id,
    });
  } finally {
    loop.activeStories--;
    if (loop.activeStories === 0) {
      updateBotStatus(bot.id, "idle");
    }
  }
}

export function onStoryJobCompleted(
  storyId: string,
  boardId: string,
  success: boolean,
  botId?: string,
): void {
  try {
    const board = getBoard(boardId);
    const targetColumn = success
      ? board.columns.find((c) => c.name === "Review") ?? board.columns.find((c) => c.isTerminal)
      : board.columns.find((c) => c.name === "Todo");

    if (targetColumn) {
      moveStory(storyId, targetColumn.id);
      logger.info({ storyId, column: targetColumn.name, success, botId }, "Story moved after job completion");
    }

    if (botId) {
      writeJournalEntry({
        botId,
        entryType: success ? "task_completed" : "task_failed",
        summary: success ? `Completed story ${storyId}` : `Failed story ${storyId}`,
        storyId,
      });
    }
  } catch (err) {
    logger.error({ storyId, boardId, err }, "Failed to move story after job completion");
  }
}
