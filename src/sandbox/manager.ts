import { spawn, type ChildProcess } from "node:child_process";
import { generateId } from "../util/id.js";
import { logger } from "../util/logger.js";

interface SandboxRecord {
  id: string;
  workspacePath: string;
  processes: Map<number, ChildProcess>;
}

const _sandboxes = new Map<string, SandboxRecord>();

let _defaultWorkspaceDir = "./workspaces";
let _defaultTimeoutSeconds = 1800;

export function configureSandbox(options: {
  workspaceDir?: string;
  timeoutSeconds?: number;
}): void {
  if (options.workspaceDir) _defaultWorkspaceDir = options.workspaceDir;
  if (options.timeoutSeconds) _defaultTimeoutSeconds = options.timeoutSeconds;
}

export function getWorkspaceDir(): string {
  return _defaultWorkspaceDir;
}

export async function createSandbox(workspacePath: string): Promise<string> {
  const id = generateId();
  _sandboxes.set(id, { id, workspacePath, processes: new Map() });
  logger.info({ sandboxId: id, workspacePath }, "Sandbox created");
  return id;
}

export function getSandboxWorkspace(sandboxId: string): string {
  const record = _sandboxes.get(sandboxId);
  if (!record) throw new Error(`Sandbox not found: ${sandboxId}`);
  return record.workspacePath;
}

export async function execInSandbox(
  sandboxId: string,
  command: string[],
  onOutput?: (output: string) => void,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const record = _sandboxes.get(sandboxId);
  if (!record) throw new Error(`Sandbox not found: ${sandboxId}`);

  const [cmd, ...args] = command;
  if (!cmd) throw new Error("Empty command");

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: record.workspacePath,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    const pid = child.pid;
    if (pid != null) record.processes.set(pid, child);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      onOutput?.(chunk.toString("utf8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      onOutput?.(chunk.toString("utf8"));
    });

    const timeout = setTimeout(() => {
      logger.warn({ sandboxId, pid }, "Sandbox process timed out, sending SIGTERM");
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }, _defaultTimeoutSeconds * 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (pid != null) record.processes.delete(pid);

      const exitCode = code ?? 1;
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      logger.info({ sandboxId, exitCode }, "Sandbox exec completed");
      resolve({ exitCode, stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      if (pid != null) record.processes.delete(pid);
      reject(err);
    });
  });
}

export async function destroySandbox(sandboxId: string): Promise<void> {
  const record = _sandboxes.get(sandboxId);
  if (!record) return;

  for (const [pid, child] of record.processes) {
    try {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    } catch {
      // Process may already be dead
    }
    logger.debug({ sandboxId, pid }, "Killed sandbox process");
  }

  _sandboxes.delete(sandboxId);
  logger.info({ sandboxId }, "Sandbox destroyed");
}

export async function listSandboxes(): Promise<string[]> {
  return Array.from(_sandboxes.keys());
}
