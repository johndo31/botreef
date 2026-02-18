import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        all: () => [],
        where: () => ({
          get: () => null,
          all: () => [],
          orderBy: () => ({
            all: () => [],
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("../../../src/kanban/board.js", () => ({
  getBoardByProject: vi.fn().mockReturnValue(null),
  getBoard: vi.fn(),
}));

vi.mock("../../../src/kanban/stories.js", () => ({
  moveStory: vi.fn(),
  updateStory: vi.fn(),
  getStory: vi.fn(),
}));

vi.mock("../../../src/bots/manager.js", () => ({
  getBot: vi.fn().mockReturnValue({
    id: "bot-1",
    name: "Test Bot",
    projectId: "proj-1",
    engineType: "claude-code",
    status: "idle",
    pollIntervalSeconds: 60,
    maxConcurrentStories: 1,
    idleBehavior: "wait",
  }),
  updateBotStatus: vi.fn(),
  listBots: vi.fn().mockReturnValue([]),
}));

vi.mock("../../../src/bots/journal.js", () => ({
  writeJournalEntry: vi.fn(),
}));

vi.mock("../../../src/util/id.js", () => ({
  generateId: () => "test-id-456",
}));

vi.mock("../../../src/util/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  startBotLoop,
  stopBotLoop,
  stopAllBotLoops,
  isBotLoopRunning,
  startAllBotLoops,
} from "../../../src/kanban/agent-loop.js";
import type { Bot } from "../../../src/bots/manager.js";

describe("Bot Agent Loop", () => {
  const mockSubmit = vi.fn().mockResolvedValue("job-123");
  const deps = { submitMessage: mockSubmit };

  const testBot: Bot = {
    id: "bot-1",
    name: "Test Bot",
    projectId: "proj-1",
    engineType: "claude-code",
    model: null,
    systemPrompt: null,
    status: "idle",
    pollIntervalSeconds: 60,
    maxConcurrentStories: 1,
    idleBehavior: "wait",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  afterEach(() => {
    stopAllBotLoops();
  });

  it("starts and stops a bot loop", () => {
    startBotLoop(testBot, deps);
    expect(isBotLoopRunning("bot-1")).toBe(true);

    stopBotLoop("bot-1");
    expect(isBotLoopRunning("bot-1")).toBe(false);
  });

  it("does not start the same bot twice", () => {
    startBotLoop(testBot, deps);
    startBotLoop(testBot, deps);
    expect(isBotLoopRunning("bot-1")).toBe(true);

    stopBotLoop("bot-1");
    expect(isBotLoopRunning("bot-1")).toBe(false);
  });

  it("stopAllBotLoops stops all running loops", () => {
    const bot2: Bot = { ...testBot, id: "bot-2", name: "Bot 2" };
    startBotLoop(testBot, deps);
    startBotLoop(bot2, deps);

    expect(isBotLoopRunning("bot-1")).toBe(true);
    expect(isBotLoopRunning("bot-2")).toBe(true);

    stopAllBotLoops();
    expect(isBotLoopRunning("bot-1")).toBe(false);
    expect(isBotLoopRunning("bot-2")).toBe(false);
  });

  it("handles no boards gracefully", async () => {
    startBotLoop(testBot, deps);
    // The tick should run without errors even with no boards
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isBotLoopRunning("bot-1")).toBe(true);
  });

  it("startAllBotLoops only starts active bots", () => {
    // listBots returns empty by default, so no loops should start
    startAllBotLoops(deps);
    expect(isBotLoopRunning("bot-1")).toBe(false);
  });
});
