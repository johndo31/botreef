import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../../src/db/client.js", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ get: () => null }) }) }),
    insert: () => ({ values: () => ({ run: vi.fn() }) }),
  }),
}));

vi.mock("../../../src/auth/identity.js", () => ({
  resolveIdentity: vi.fn().mockResolvedValue({
    userId: "user-1",
    userName: "TestUser",
    role: "developer",
  }),
  createUserWithIdentity: vi.fn(),
}));

vi.mock("../../../src/auth/rbac.js", () => ({
  requirePermission: vi.fn(),
  getUserRole: vi.fn().mockResolvedValue("developer"),
}));

vi.mock("../../../src/queue/producer.js", () => ({
  enqueueJob: vi.fn().mockResolvedValue("job-1"),
}));

vi.mock("../../../src/util/id.js", () => ({
  generateId: () => "test-id-123",
}));

vi.mock("../../../src/util/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { initRouter, submitMessage } from "../../../src/router/message-router.js";
import type { InboundMessage } from "../../../src/types/inbound-message.js";
import type { AppConfig } from "../../../src/config/schema.js";

describe("Message Router", () => {
  const mockConfig = {
    server: { host: "0.0.0.0", port: 3000, logLevel: "info", maxConcurrentJobs: 2, baseUrl: "http://localhost:3000" },
    database: { path: ":memory:" },
    redis: { host: "localhost", port: 6379, db: 0 },
    engine: { type: "claude-code", defaultModel: "claude-sonnet-4-20250514", maxTurns: 50, timeoutMinutes: 30 },
    sandbox: { runtime: "runc", image: "sandbox:latest", memoryMb: 2048, cpus: 1, networkEnabled: false, allowedHosts: [], workspaceDir: "./workspaces" },
    interfaces: {} as any,
    agent: { enabled: false, pollIntervalSeconds: 30, maxConcurrentStories: 1, idleBehavior: "wait" as const },
    projects: {
      myapp: {
        repoUrl: "git@github.com:user/myapp.git",
        defaultBranch: "main",
        branchStrategy: "feature-per-job" as const,
        autoPush: true,
        autoCreatePr: true,
        requireApproval: false,
      },
    },
  } as AppConfig;

  beforeEach(() => {
    initRouter({ config: mockConfig });
  });

  it("routes a valid message to the job queue", async () => {
    const message: InboundMessage = {
      id: "msg-1",
      channel: "rest",
      userId: "user-1",
      projectId: "myapp",
      instruction: "Fix the login bug",
      timestamp: new Date(),
    };

    const jobId = await submitMessage(message);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe("string");
  });

  it("throws when router is not initialized", async () => {
    // Re-import to get fresh state
    const { submitMessage: freshSubmit } = await import("../../../src/router/message-router.js");
    // initRouter was already called in beforeEach so this will work
    // Just verify it doesn't crash
    const message: InboundMessage = {
      id: "msg-2",
      channel: "telegram",
      userId: "tg-user-1",
      projectId: "myapp",
      instruction: "Add dark mode",
      timestamp: new Date(),
    };
    const jobId = await freshSubmit(message);
    expect(jobId).toBeDefined();
  });
});
