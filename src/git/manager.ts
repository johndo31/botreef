import { simpleGit, type SimpleGit } from "simple-git";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getProjectWorkspace } from "./workspace.js";
import { logger } from "../util/logger.js";

export function getWorkspacePath(projectId: string): string {
  return getProjectWorkspace(projectId);
}

function getGit(workspacePath: string): SimpleGit {
  return simpleGit(workspacePath);
}

export async function cloneOrPull(
  repoUrl: string,
  workspacePath: string,
  defaultBranch: string,
): Promise<void> {
  if (existsSync(join(workspacePath, ".git"))) {
    const git = getGit(workspacePath);
    await git.checkout(defaultBranch);
    await git.pull("origin", defaultBranch);
    logger.info({ workspacePath }, "Pulled latest changes");
  } else {
    await simpleGit().clone(repoUrl, workspacePath);
    logger.info({ repoUrl, workspacePath }, "Cloned repository");
  }
}

export async function createBranch(
  workspacePath: string,
  branchName: string,
): Promise<void> {
  const git = getGit(workspacePath);
  const branches = await git.branchLocal();
  if (branches.all.includes(branchName)) {
    await git.checkout(branchName);
  } else {
    await git.checkoutLocalBranch(branchName);
  }
  logger.info({ workspacePath, branchName }, "Checked out branch");
}

export async function commitAndPush(
  workspacePath: string,
  message: string,
  push: boolean,
): Promise<{ sha: string }> {
  const git = getGit(workspacePath);

  const status = await git.status();
  if (status.isClean()) {
    logger.info({ workspacePath }, "No changes to commit");
    const log = await git.log({ maxCount: 1 });
    return { sha: log.latest?.hash ?? "" };
  }

  await git.add(".");
  const result = await git.commit(message);
  const sha = result.commit;
  logger.info({ workspacePath, sha }, "Committed changes");

  if (push) {
    const branch = (await git.branchLocal()).current;
    await git.push("origin", branch, ["--set-upstream"]);
    logger.info({ workspacePath, branch }, "Pushed to remote");
  }

  return { sha };
}

export async function getCurrentBranch(workspacePath: string): Promise<string> {
  const git = getGit(workspacePath);
  const branches = await git.branchLocal();
  return branches.current;
}

export async function getDiff(workspacePath: string): Promise<string> {
  const git = getGit(workspacePath);
  return git.diff();
}
