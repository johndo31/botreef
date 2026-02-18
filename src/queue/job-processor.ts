import { eq } from "drizzle-orm";
import type { JobPayload, JobResult, JobStatus } from "../types/job.js";
import type { TaskEvent } from "../types/task-event.js";
import { getDb } from "../db/client.js";
import { jobs } from "../db/schema.js";
import { cloneOrPull, createBranch, commitAndPush, getWorkspacePath } from "../git/manager.js";
import { createPullRequest } from "../git/pr.js";
import { createSandbox, destroySandbox, execInSandbox } from "../sandbox/manager.js";
import { selectEngine } from "../engine/factory.js";
import { generateId } from "../util/id.js";
import { logger } from "../util/logger.js";

export interface ProcessorCallbacks {
  onProgress: (progress: number) => void;
  onEvent: (event: TaskEvent) => void;
}

function emitEvent(
  payload: JobPayload,
  type: TaskEvent["type"],
  data: TaskEvent["data"],
  callbacks: ProcessorCallbacks,
) {
  callbacks.onEvent({
    type,
    jobId: payload.jobId,
    projectId: payload.projectId,
    channel: payload.channel,
    channelMessageId: payload.channelMessageId,
    userId: payload.userId,
    timestamp: new Date(),
    data,
  });
}

function updateJobStatus(jobId: string, status: JobStatus, extra?: Record<string, unknown>) {
  const db = getDb();
  db.update(jobs)
    .set({ status, updatedAt: new Date().toISOString(), ...extra })
    .where(eq(jobs.id, jobId))
    .run();
}

export async function processJob(
  payload: JobPayload,
  callbacks: ProcessorCallbacks,
): Promise<JobResult> {
  const startTime = Date.now();
  let branch: string | undefined;
  let commitSha: string | undefined;
  let prUrl: string | undefined;
  let containerId: string | undefined;

  try {
    // Step 1: Clone or pull repository
    emitEvent(payload, "task:started", { status: "cloning" }, callbacks);
    updateJobStatus(payload.jobId, "cloning");
    callbacks.onProgress(10);

    const workspacePath = getWorkspacePath(payload.projectId);
    await cloneOrPull(payload.repoUrl, workspacePath, payload.defaultBranch);

    // Step 2: Create feature branch
    if (payload.branchStrategy === "feature-per-job") {
      branch = `botreef/${payload.jobId.toLowerCase().slice(0, 12)}`;
      await createBranch(workspacePath, branch);
    }
    callbacks.onProgress(20);

    // Step 3: Create sandbox container
    emitEvent(payload, "task:progress", { status: "running", progress: 20 }, callbacks);
    updateJobStatus(payload.jobId, "running");

    containerId = await createSandbox(workspacePath);
    callbacks.onProgress(30);

    // Step 4: Run AI engine in sandbox
    const engine = selectEngine(payload.engineType);
    const engineResult = await engine.run({
      containerId,
      instruction: payload.instruction,
      workspacePath,
      onOutput: (output: string) => {
        emitEvent(payload, "task:output", { output }, callbacks);
      },
    });
    callbacks.onProgress(70);

    // Step 5: Commit changes
    emitEvent(payload, "task:progress", { status: "committing", progress: 70 }, callbacks);
    updateJobStatus(payload.jobId, "committing");

    const commitResult = await commitAndPush(
      workspacePath,
      `botreef: ${payload.instruction.slice(0, 72)}`,
      payload.autoPush,
    );
    commitSha = commitResult.sha;
    callbacks.onProgress(85);

    // Step 6: Push and create PR
    if (payload.autoPush && payload.autoCreatePr && branch) {
      emitEvent(payload, "task:progress", { status: "pushing", progress: 85 }, callbacks);
      updateJobStatus(payload.jobId, "pushing");

      prUrl = await createPullRequest({
        repoUrl: payload.repoUrl,
        branch,
        baseBranch: payload.defaultBranch,
        title: `botreef: ${payload.instruction.slice(0, 72)}`,
        body: `## Instruction\n${payload.instruction}\n\n## Output\n${engineResult.output.slice(0, 2000)}`,
      });
    }

    // Step 7: Check if approval required
    if (payload.requireApproval) {
      updateJobStatus(payload.jobId, "awaiting_approval", {
        branch,
        commitSha,
        prUrl,
        output: engineResult.output,
      });
      emitEvent(payload, "task:approval_required", { branch, commitSha, prUrl }, callbacks);
    } else {
      updateJobStatus(payload.jobId, "completed", {
        branch,
        commitSha,
        prUrl,
        output: engineResult.output,
        durationMs: Date.now() - startTime,
      });
    }

    callbacks.onProgress(100);
    emitEvent(payload, "task:completed", { branch, commitSha, prUrl }, callbacks);

    return {
      jobId: payload.jobId,
      status: payload.requireApproval ? "awaiting_approval" : "completed",
      output: engineResult.output,
      branch,
      commitSha,
      prUrl,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    updateJobStatus(payload.jobId, "failed", { error, durationMs: Date.now() - startTime });
    emitEvent(payload, "task:failed", { error }, callbacks);

    return {
      jobId: payload.jobId,
      status: "failed",
      output: "",
      error,
      durationMs: Date.now() - startTime,
    };
  } finally {
    if (containerId) {
      await destroySandbox(containerId).catch((err) => {
        logger.error({ containerId, err }, "Failed to destroy sandbox");
      });
    }
  }
}
