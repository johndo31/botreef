import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);

vi.mock("../../../src/db/client.js", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        run: mockRun,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
          all: mockAll,
        }),
        all: mockAll,
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: mockRun,
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        run: mockRun,
      }),
    }),
  }),
}));

vi.mock("../../../src/util/id.js", () => ({
  generateId: () => "bot-test-123",
}));

import { createBot, getBot, updateBot, updateBotStatus, deleteBot, listBots } from "../../../src/bots/manager.js";

describe("Bot Manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createBot returns a bot with generated id", () => {
    const bot = createBot({
      name: "My Bot",
      projectId: "proj-1",
    });

    expect(bot.id).toBe("bot-test-123");
    expect(bot.name).toBe("My Bot");
    expect(bot.projectId).toBe("proj-1");
    expect(bot.engineType).toBe("claude-code");
    expect(bot.status).toBe("idle");
    expect(bot.pollIntervalSeconds).toBe(30);
    expect(bot.maxConcurrentStories).toBe(1);
    expect(bot.idleBehavior).toBe("wait");
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it("createBot uses provided overrides", () => {
    const bot = createBot({
      name: "Custom Bot",
      projectId: "proj-2",
      engineType: "codex",
      model: "gpt-4",
      systemPrompt: "You are a specialist.",
      pollIntervalSeconds: 10,
      maxConcurrentStories: 3,
      idleBehavior: "discovery",
    });

    expect(bot.engineType).toBe("codex");
    expect(bot.model).toBe("gpt-4");
    expect(bot.systemPrompt).toBe("You are a specialist.");
    expect(bot.pollIntervalSeconds).toBe(10);
    expect(bot.maxConcurrentStories).toBe(3);
    expect(bot.idleBehavior).toBe("discovery");
  });

  it("getBot throws when bot not found", () => {
    mockGet.mockReturnValueOnce(undefined);
    expect(() => getBot("nonexistent")).toThrow("Bot not found");
  });

  it("getBot returns bot when found", () => {
    const mockBot = { id: "bot-1", name: "Found Bot", status: "idle" };
    mockGet.mockReturnValueOnce(mockBot);

    const result = getBot("bot-1");
    expect(result).toEqual(mockBot);
  });

  it("updateBot calls db update", () => {
    const mockBot = { id: "bot-1", name: "Updated", status: "idle" };
    mockGet.mockReturnValueOnce(mockBot);

    const result = updateBot("bot-1", { name: "Renamed" });
    expect(mockRun).toHaveBeenCalled();
    expect(result).toEqual(mockBot);
  });

  it("updateBotStatus calls db update", () => {
    updateBotStatus("bot-1", "working");
    expect(mockRun).toHaveBeenCalled();
  });

  it("deleteBot calls db delete", () => {
    deleteBot("bot-1");
    expect(mockRun).toHaveBeenCalled();
  });

  it("listBots returns all bots", () => {
    const bots = [{ id: "bot-1" }, { id: "bot-2" }];
    mockAll.mockReturnValueOnce(bots);

    const result = listBots();
    expect(result).toEqual(bots);
  });
});
