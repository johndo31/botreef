import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/bots/journal.js", () => ({
  getRecentJournal: vi.fn().mockReturnValue([]),
}));

import { buildBotContext, buildInstructionWithContext } from "../../../src/bots/context-builder.js";
import { getRecentJournal } from "../../../src/bots/journal.js";
import type { Bot } from "../../../src/bots/manager.js";

const makeBot = (overrides?: Partial<Bot>): Bot => ({
  id: "bot-1",
  name: "TestBot",
  projectId: "proj-1",
  engineType: "claude-code",
  model: null,
  systemPrompt: null,
  status: "idle",
  pollIntervalSeconds: 30,
  maxConcurrentStories: 1,
  idleBehavior: "wait",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

describe("Context Builder", () => {
  it("builds basic context with bot name", () => {
    const bot = makeBot();
    const ctx = buildBotContext(bot);

    expect(ctx.preamble).toContain('You are "TestBot"');
    expect(ctx.preamble).toContain("## Current Task");
    expect(ctx.recentEntries).toEqual([]);
  });

  it("includes system prompt when set", () => {
    const bot = makeBot({ systemPrompt: "You are a specialist in React." });
    const ctx = buildBotContext(bot);

    expect(ctx.preamble).toContain("## Instructions");
    expect(ctx.preamble).toContain("You are a specialist in React.");
  });

  it("includes recent activity when journal has entries", () => {
    const entries = [
      {
        id: "j-1",
        botId: "bot-1",
        entryType: "task_completed" as const,
        summary: "Fixed the login bug",
        details: null,
        jobId: "job-1",
        storyId: null,
        createdAt: "2025-01-15T10:00:00.000Z",
      },
      {
        id: "j-2",
        botId: "bot-1",
        entryType: "learning" as const,
        summary: "The project uses Tailwind CSS",
        details: null,
        jobId: null,
        storyId: null,
        createdAt: "2025-01-14T10:00:00.000Z",
      },
    ];
    vi.mocked(getRecentJournal).mockReturnValueOnce(entries);

    const bot = makeBot();
    const ctx = buildBotContext(bot);

    expect(ctx.preamble).toContain("## Recent Activity");
    expect(ctx.preamble).toContain("Completed: Fixed the login bug");
    expect(ctx.preamble).toContain("## Things You've Learned");
    expect(ctx.preamble).toContain("The project uses Tailwind CSS");
    expect(ctx.recentEntries).toHaveLength(2);
  });

  it("buildInstructionWithContext prepends preamble", () => {
    const bot = makeBot({ name: "Worker" });
    const result = buildInstructionWithContext(bot, "Fix the button alignment");

    expect(result).toContain('You are "Worker"');
    expect(result).toContain("## Current Task");
    expect(result).toContain("Fix the button alignment");
  });

  it("entries are shown in chronological order", () => {
    const entries = [
      {
        id: "j-new",
        botId: "bot-1",
        entryType: "task_completed" as const,
        summary: "Second task",
        details: null,
        jobId: null,
        storyId: null,
        createdAt: "2025-01-16T10:00:00.000Z",
      },
      {
        id: "j-old",
        botId: "bot-1",
        entryType: "task_started" as const,
        summary: "First task",
        details: null,
        jobId: null,
        storyId: null,
        createdAt: "2025-01-15T10:00:00.000Z",
      },
    ];
    vi.mocked(getRecentJournal).mockReturnValueOnce(entries);

    const bot = makeBot();
    const ctx = buildBotContext(bot);

    // Entries should be reversed (chronological), so "First task" before "Second task"
    const firstIdx = ctx.preamble.indexOf("First task");
    const secondIdx = ctx.preamble.indexOf("Second task");
    expect(firstIdx).toBeLessThan(secondIdx);
  });
});
