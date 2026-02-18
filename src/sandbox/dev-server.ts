import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { devServers } from "../db/schema.js";
import { execInSandbox } from "./manager.js";
import { generateId } from "../util/id.js";
import { logger } from "../util/logger.js";

export interface DevServerInfo {
  id: string;
  containerId: string;
  port: number;
  previewUrl: string;
  authToken: string;
}

let _nextPort = 10000;
let _baseUrl = "http://localhost:3000";

export function configureDevServer(baseUrl: string): void {
  _baseUrl = baseUrl;
}

export async function startDevServer(
  jobId: string,
  containerId: string,
  command = "npm run dev",
): Promise<DevServerInfo> {
  const port = _nextPort++;
  const authToken = randomBytes(24).toString("hex");
  const id = generateId();
  const previewUrl = `${_baseUrl}/preview/${jobId}?token=${authToken}`;

  const db = getDb();
  db.insert(devServers).values({
    id,
    jobId,
    containerId,
    port,
    previewUrl,
    authToken,
    status: "starting",
    createdAt: new Date().toISOString(),
  }).run();

  // Start dev server in background (non-blocking exec)
  execInSandbox(containerId, ["sh", "-c", command], (output) => {
    logger.debug({ jobId, output: output.slice(0, 200) }, "Dev server output");
  }).then(() => {
    db.update(devServers)
      .set({ status: "stopped", stoppedAt: new Date().toISOString() })
      .where(eq(devServers.id, id))
      .run();
  }).catch((err) => {
    logger.error({ jobId, err }, "Dev server failed");
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
  return { id, containerId, port, previewUrl, authToken };
}

export async function stopDevServer(id: string): Promise<void> {
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
    containerId: server.containerId,
    port: server.port,
    previewUrl: server.previewUrl ?? "",
    authToken: server.authToken,
  };
}
