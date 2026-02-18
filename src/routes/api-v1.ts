import { type FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { jobs, projects } from "../db/schema.js";
import { submitMessage } from "../router/message-router.js";
import { generateId } from "../util/id.js";
import { requirePermission } from "../auth/rbac.js";
import type { InboundMessage } from "../types/inbound-message.js";

export async function apiV1Routes(app: FastifyInstance): Promise<void> {
  // All routes require authentication
  app.addHook("preHandler", (app as any).authenticate);

  // Create task
  app.post<{
    Body: { projectId: string; instruction: string; metadata?: Record<string, unknown> };
  }>("/tasks", async (request, reply) => {
    requirePermission(request.userRole!, "task:create");

    const { projectId, instruction, metadata } = request.body;
    const message: InboundMessage = {
      id: generateId(),
      channel: "rest",
      userId: request.userId!,
      projectId,
      instruction,
      metadata,
      timestamp: new Date(),
    };

    const jobId = await submitMessage(message);
    reply.status(201).send({ jobId });
  });

  // Get task
  app.get<{ Params: { id: string } }>("/tasks/:id", async (request) => {
    requirePermission(request.userRole!, "task:read");

    const db = getDb();
    const job = db.select().from(jobs).where(eq(jobs.id, request.params.id)).get();
    if (!job) {
      return { error: { code: "NOT_FOUND", message: "Task not found" } };
    }
    return job;
  });

  // List tasks
  app.get<{ Querystring: { projectId?: string; status?: string; limit?: number } }>(
    "/tasks",
    async (request) => {
      requirePermission(request.userRole!, "task:read");

      const db = getDb();
      let query = db.select().from(jobs);
      // Filtering is applied at the DB level
      const results = query.all();

      return {
        tasks: results,
        total: results.length,
      };
    },
  );

  // List projects
  app.get("/projects", async (request) => {
    requirePermission(request.userRole!, "project:read");

    const db = getDb();
    const allProjects = db.select().from(projects).all();
    return { projects: allProjects };
  });

  // Get project
  app.get<{ Params: { id: string } }>("/projects/:id", async (request) => {
    requirePermission(request.userRole!, "project:read");

    const db = getDb();
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) {
      return { error: { code: "NOT_FOUND", message: "Project not found" } };
    }
    return project;
  });

  // Kanban endpoints
  app.get<{ Params: { projectId: string } }>("/projects/:projectId/board", async (request) => {
    requirePermission(request.userRole!, "kanban:read");

    const { getBoardByProject } = await import("../kanban/board.js");
    const board = getBoardByProject(request.params.projectId);
    if (!board) {
      return { error: { code: "NOT_FOUND", message: "Board not found" } };
    }

    const { getStoriesByBoard } = await import("../kanban/stories.js");
    const stories = getStoriesByBoard(board.id);

    return { board, stories };
  });

  app.post<{
    Params: { projectId: string };
    Body: {
      columnId: string;
      title: string;
      description?: string;
      acceptanceCriteria?: string;
      priority?: number;
      storyPoints?: number;
      assignee?: string;
      assigneeType?: "user" | "bot";
    };
  }>("/projects/:projectId/stories", async (request, reply) => {
    requirePermission(request.userRole!, "kanban:create");

    const { getBoardByProject } = await import("../kanban/board.js");
    const board = getBoardByProject(request.params.projectId);
    if (!board) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Board not found" } });
    }

    const { createStory } = await import("../kanban/stories.js");
    const story = createStory({
      boardId: board.id,
      ...request.body,
    });

    reply.status(201).send(story);
  });

  app.patch<{
    Params: { storyId: string };
    Body: { columnId?: string; title?: string; description?: string; priority?: number; assignee?: string; assigneeType?: "user" | "bot" };
  }>("/stories/:storyId", async (request) => {
    requirePermission(request.userRole!, "kanban:update");

    const { columnId, ...updates } = request.body;
    const { updateStory, moveStory } = await import("../kanban/stories.js");

    if (columnId) {
      moveStory(request.params.storyId, columnId);
    }
    if (Object.keys(updates).length > 0) {
      return updateStory(request.params.storyId, updates);
    }

    const { getStory } = await import("../kanban/stories.js");
    return getStory(request.params.storyId);
  });

  app.delete<{ Params: { storyId: string } }>("/stories/:storyId", async (request, reply) => {
    requirePermission(request.userRole!, "kanban:delete");

    const { deleteStory } = await import("../kanban/stories.js");
    deleteStory(request.params.storyId);
    reply.status(204).send();
  });

  // === Bot endpoints ===

  // List all bots
  app.get("/bots", async (request) => {
    requirePermission(request.userRole!, "project:read");

    const { listBots } = await import("../bots/manager.js");
    return { bots: listBots() };
  });

  // Get bot
  app.get<{ Params: { botId: string } }>("/bots/:botId", async (request) => {
    requirePermission(request.userRole!, "project:read");

    const { getBot } = await import("../bots/manager.js");
    try {
      return getBot(request.params.botId);
    } catch {
      return { error: { code: "NOT_FOUND", message: "Bot not found" } };
    }
  });

  // List bots for a project
  app.get<{ Params: { projectId: string } }>("/projects/:projectId/bots", async (request) => {
    requirePermission(request.userRole!, "project:read");

    const { getBotsByProject } = await import("../bots/manager.js");
    return { bots: getBotsByProject(request.params.projectId) };
  });

  // Create bot
  app.post<{
    Body: {
      name: string;
      projectId: string;
      engineType?: "claude-code" | "codex";
      model?: string;
      systemPrompt?: string;
      pollIntervalSeconds?: number;
      maxConcurrentStories?: number;
      idleBehavior?: "wait" | "discovery";
    };
  }>("/bots", async (request, reply) => {
    requirePermission(request.userRole!, "project:update");

    const { createBot } = await import("../bots/manager.js");
    const bot = createBot(request.body);
    reply.status(201).send(bot);
  });

  // Update bot
  app.patch<{
    Params: { botId: string };
    Body: {
      name?: string;
      engineType?: "claude-code" | "codex";
      model?: string;
      systemPrompt?: string;
      status?: "idle" | "working" | "paused" | "stopped";
      pollIntervalSeconds?: number;
      maxConcurrentStories?: number;
      idleBehavior?: "wait" | "discovery";
    };
  }>("/bots/:botId", async (request) => {
    requirePermission(request.userRole!, "project:update");

    const { updateBot } = await import("../bots/manager.js");
    return updateBot(request.params.botId, request.body);
  });

  // Delete bot
  app.delete<{ Params: { botId: string } }>("/bots/:botId", async (request, reply) => {
    requirePermission(request.userRole!, "project:delete");

    const { deleteBot } = await import("../bots/manager.js");
    const { stopBotLoop } = await import("../kanban/agent-loop.js");
    stopBotLoop(request.params.botId);
    deleteBot(request.params.botId);
    reply.status(204).send();
  });

  // Start/stop bot loop
  app.post<{
    Params: { botId: string };
    Body: { action: "start" | "stop" | "pause" };
  }>("/bots/:botId/loop", async (request) => {
    requirePermission(request.userRole!, "project:update");

    const { getBot, updateBotStatus } = await import("../bots/manager.js");
    const { startBotLoop, stopBotLoop, isBotLoopRunning } = await import("../kanban/agent-loop.js");
    const { submitMessage } = await import("../router/message-router.js");

    const bot = getBot(request.params.botId);
    const { action } = request.body;

    if (action === "start") {
      updateBotStatus(bot.id, "idle");
      startBotLoop(bot, { submitMessage });
    } else if (action === "stop") {
      updateBotStatus(bot.id, "stopped");
      stopBotLoop(bot.id);
    } else if (action === "pause") {
      updateBotStatus(bot.id, "paused");
      stopBotLoop(bot.id);
    }

    return { botId: bot.id, running: isBotLoopRunning(bot.id), status: bot.status };
  });

  // Get bot journal
  app.get<{
    Params: { botId: string };
    Querystring: { limit?: number; type?: string };
  }>("/bots/:botId/journal", async (request) => {
    requirePermission(request.userRole!, "project:read");

    const { getRecentJournal, getJournalByType } = await import("../bots/journal.js");
    const limit = request.query.limit ?? 20;
    const type = request.query.type as import("../bots/journal.js").JournalEntryType | undefined;

    if (type) {
      return { entries: getJournalByType(request.params.botId, type, limit) };
    }
    return { entries: getRecentJournal(request.params.botId, limit) };
  });
}
