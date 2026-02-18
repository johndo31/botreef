import { getDb } from "../db/client.js";
import { projects } from "../db/schema.js";
import { getBoardByProject, getBoard, type Board } from "./board.js";
import { getAgentTodoStories, moveStory, updateStory, type Story } from "./stories.js";
import { generateId } from "../util/id.js";
import type { InboundMessage } from "../types/inbound-message.js";
import { logger } from "../util/logger.js";

export interface AgentLoopConfig {
  enabled: boolean;
  pollIntervalSeconds: number;
  maxConcurrentStories: number;
  idleBehavior: "wait" | "discovery";
}

export interface AgentLoopDeps {
  submitMessage: (message: InboundMessage) => Promise<string>;
  config: AgentLoopConfig;
}

let _running = false;
let _timer: ReturnType<typeof setInterval> | null = null;
let _activeStories = 0;

export function startAgentLoop(deps: AgentLoopDeps): void {
  if (_running) return;
  _running = true;

  logger.info(
    { pollInterval: deps.config.pollIntervalSeconds, maxConcurrent: deps.config.maxConcurrentStories },
    "Agent loop started",
  );

  tickAgentLoop(deps).catch((err) => {
    logger.error({ err }, "Agent loop tick error");
  });

  _timer = setInterval(() => {
    tickAgentLoop(deps).catch((err) => {
      logger.error({ err }, "Agent loop tick error");
    });
  }, deps.config.pollIntervalSeconds * 1000);
}

export function stopAgentLoop(): void {
  _running = false;
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  logger.info("Agent loop stopped");
}

export function isAgentLoopRunning(): boolean {
  return _running;
}

async function tickAgentLoop(deps: AgentLoopDeps): Promise<void> {
  if (!_running) return;
  if (_activeStories >= deps.config.maxConcurrentStories) return;

  const db = getDb();
  const allProjects = db.select().from(projects).all();

  for (const project of allProjects) {
    if (_activeStories >= deps.config.maxConcurrentStories) break;

    const board = getBoardByProject(project.id);
    if (!board) continue;

    const stories = getAgentTodoStories(board.id);
    if (stories.length === 0) continue;

    const story = stories[0]!;
    await pickAndExecuteStory(board, story, project.id, deps);
  }
}

async function pickAndExecuteStory(
  board: Board,
  story: Story,
  projectId: string,
  deps: AgentLoopDeps,
): Promise<void> {
  _activeStories++;

  try {
    const inProgressColumn = board.columns.find((c) => c.name === "In Progress");
    if (inProgressColumn) {
      moveStory(story.id, inProgressColumn.id);
    }

    logger.info({ storyId: story.id, title: story.title }, "Agent picked story");

    let instruction = story.title;
    if (story.description) {
      instruction += `\n\n${story.description}`;
    }
    if (story.acceptanceCriteria) {
      instruction += `\n\nAcceptance Criteria:\n${story.acceptanceCriteria}`;
    }

    const message: InboundMessage = {
      id: generateId(),
      channel: "agent",
      userId: "agent",
      projectId,
      instruction,
      timestamp: new Date(),
    };

    const jobId = await deps.submitMessage(message);
    updateStory(story.id, { jobId });

    logger.info({ storyId: story.id, jobId }, "Story submitted as job");
  } catch (err) {
    logger.error({ storyId: story.id, err }, "Failed to execute story");
  } finally {
    _activeStories--;
  }
}

export function onStoryJobCompleted(
  storyId: string,
  boardId: string,
  success: boolean,
): void {
  try {
    const board = getBoard(boardId);
    const targetColumn = success
      ? board.columns.find((c) => c.name === "Review") ?? board.columns.find((c) => c.isTerminal)
      : board.columns.find((c) => c.name === "Todo");

    if (targetColumn) {
      moveStory(storyId, targetColumn.id);
      logger.info({ storyId, column: targetColumn.name, success }, "Story moved after job completion");
    }
  } catch (err) {
    logger.error({ storyId, boardId, err }, "Failed to move story after job completion");
  }
}
