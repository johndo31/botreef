import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { devServers } from "../db/schema.js";
import { getSandboxWorkspace } from "./manager.js";
import { generateId } from "../util/id.js";
import { logger } from "../util/logger.js";

export interface DevServerInfo {
  id: string;
  sandboxId: string;
  port: number;
  previewUrl: string;
  authToken: string;
}

let _nextPort = 10000;
let _baseUrl = "http://localhost:3000";

const _processes = new Map<string, ChildProcess>();

export function configureDevServer(baseUrl: string): void {
  _baseUrl = baseUrl;
}

export async function startDevServer(
  jobId: string,
  sandboxId: string,
  command = "npm run dev",
): Promise<DevServerInfo> {
  const port = _nextPort++;
  const authToken = randomBytes(24).toString("hex");
  const id = generateId();
  const previewUrl = `${_baseUrl}/preview/${jobId}?token=${authToken}`;

  const workspacePath = getSandboxWorkspace(sandboxId);

  const db = getDb();
  db.insert(devServers).values({
    id,
    jobId,
    sandboxId,
    port,
    previewUrl,
    authToken,
    status: "starting",
    createdAt: new Date().toISOString(),
  }).run();

  const child = spawn("sh", ["-c", command], {
    cwd: workspacePath,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  _processes.set(id, child);

  child.stdout.on("data", (chunk: Buffer) => {
    logger.debug({ jobId, output: chunk.toString("utf8").slice(0, 200) }, "Dev server output");
  });

  child.stderr.on("data", (chunk: Buffer) => {
    logger.debug({ jobId, output: chunk.toString("utf8").slice(0, 200) }, "Dev server stderr");
  });

  child.on("close", (code) => {
    _processes.delete(id);
    const status = code === 0 ? "stopped" : "failed";
    db.update(devServers)
      .set({ status, stoppedAt: new Date().toISOString() })
      .where(eq(devServers.id, id))
      .run();
    if (status === "failed") {
      logger.error({ jobId, exitCode: code }, "Dev server failed");
    }
  });

  child.on("error", (err) => {
    _processes.delete(id);
    logger.error({ jobId, err }, "Dev server error");
    db.update(devServers)
      .set({ status: "failed", stoppedAt: new Date().toISOString() })
      .where(eq(devServers.id, id))
      .run();
  });

  // Mark as running after a short delay
  setTimeout(() => {
    db.update(devServers)
      .set({ status: "running" })
      .where(eq(devServers.id, id))
      .run();
  }, 2000);

  logger.info({ jobId, port, previewUrl }, "Dev server starting");
  return { id, sandboxId, port, previewUrl, authToken };
}

export async function stopDevServer(id: string): Promise<void> {
  const child = _processes.get(id);
  if (child) {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 5000);
    _processes.delete(id);
  }

  const db = getDb();
  db.update(devServers)
    .set({ status: "stopped", stoppedAt: new Date().toISOString() })
    .where(eq(devServers.id, id))
    .run();
  logger.info({ devServerId: id }, "Dev server stopped");
}

export async function getDevServerForJob(jobId: string): Promise<DevServerInfo | null> {
  const db = getDb();
  const server = db
    .select()
    .from(devServers)
    .where(eq(devServers.jobId, jobId))
    .get();

  if (!server || server.status === "stopped" || server.status === "failed") return null;

  return {
    id: server.id,
    sandboxId: server.sandboxId,
    port: server.port,
    previewUrl: server.previewUrl ?? "",
    authToken: server.authToken,
  };
}
