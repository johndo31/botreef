import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        all: () => [{ id: "proj-1", name: "Test Project" }],
        where: () => ({
          get: () => null,
          all: () => [],
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
  getAgentTodoStories: vi.fn().mockReturnValue([]),
  moveStory: vi.fn(),
  updateStory: vi.fn(),
  getStory: vi.fn(),
}));

vi.mock("../../../src/util/id.js", () => ({
  generateId: () => "test-id-456",
}));

vi.mock("../../../src/util/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  startAgentLoop,
  stopAgentLoop,
  isAgentLoopRunning,
} from "../../../src/kanban/agent-loop.js";

describe("Agent Loop", () => {
  const mockSubmit = vi.fn().mockResolvedValue("job-123");
  const config = {
    enabled: true,
    pollIntervalSeconds: 60,
    maxConcurrentStories: 1,
    idleBehavior: "wait" as const,
  };

  afterEach(() => {
    stopAgentLoop();
  });

  it("starts and stops the agent loop", () => {
    startAgentLoop({ submitMessage: mockSubmit, config });
    expect(isAgentLoopRunning()).toBe(true);

    stopAgentLoop();
    expect(isAgentLoopRunning()).toBe(false);
  });

  it("does not start twice", () => {
    startAgentLoop({ submitMessage: mockSubmit, config });
    startAgentLoop({ submitMessage: mockSubmit, config });
    expect(isAgentLoopRunning()).toBe(true);

    stopAgentLoop();
    expect(isAgentLoopRunning()).toBe(false);
  });

  it("handles no boards gracefully", async () => {
    startAgentLoop({ submitMessage: mockSubmit, config });
    // The tick should run without errors even with no boards
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isAgentLoopRunning()).toBe(true);
  });
});
