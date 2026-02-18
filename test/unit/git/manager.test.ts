import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("simple-git", () => {
  const mockGit = {
    clone: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
    branchLocal: vi.fn().mockResolvedValue({ current: "main", all: ["main"] }),
    status: vi.fn().mockResolvedValue({ isClean: () => false }),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ commit: "abc1234" }),
    push: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue({ latest: { hash: "abc1234" } }),
    diff: vi.fn().mockResolvedValue("+ added line"),
  };
  const factory = vi.fn().mockReturnValue(mockGit);
  return {
    default: factory,
    simpleGit: factory,
  };
});

vi.mock("../../../src/git/workspace.js", () => ({
  getProjectWorkspace: (id: string) => `/tmp/workspaces/${id}`,
}));

vi.mock("../../../src/util/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

import { getWorkspacePath, commitAndPush, getCurrentBranch, getDiff } from "../../../src/git/manager.js";

describe("Git Manager", () => {
  it("returns workspace path for project", () => {
    const path = getWorkspacePath("myapp");
    expect(path).toBe("/tmp/workspaces/myapp");
  });

  it("commits and pushes changes", async () => {
    const result = await commitAndPush("/tmp/workspaces/myapp", "test commit", true);
    expect(result.sha).toBe("abc1234");
  });

  it("gets current branch", async () => {
    const branch = await getCurrentBranch("/tmp/workspaces/myapp");
    expect(branch).toBe("main");
  });

  it("gets diff", async () => {
    const diff = await getDiff("/tmp/workspaces/myapp");
    expect(diff).toContain("added line");
  });
});
