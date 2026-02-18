import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { logger } from "../util/logger.js";

let _baseDir = "./workspaces";

export function setWorkspaceBaseDir(dir: string): void {
  _baseDir = dir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(`Created workspace directory: ${dir}`);
  }
}

export function getWorkspaceBaseDir(): string {
  return resolve(_baseDir);
}

export function getProjectWorkspace(projectId: string): string {
  const dir = join(getWorkspaceBaseDir(), projectId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
