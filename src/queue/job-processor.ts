import { eq } from "drizzle-orm";
import type { JobPayload, JobResult, JobStatus } from "../types/job.js";
import type { TaskEvent } from "../types/task-event.js";
import { getDb } from "../db/client.js";
import { jobs } from "../db/schema.js";
import { cloneOrPull, createBranch, commitAndPush, getWorkspacePath } from "../git/manager.js";
import { createPullRequest } from "../git/pr.js";
import { createSandbox, destroySandbox } from "../sandbox/manager.js";
import { selectEngine } from "../engine/factory.js";
import { logger } from "../util/logger.js";
import { writeJournalEntry } from "../bots/journal.js";
import { buildInstructionWithContext } from "../bots/context-builder.js";
import { getBot } from "../bots/manager.js";

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
  let sandboxId: string | undefined;

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

    // Step 3: Create sandbox
    emitEvent(payload, "task:progress", { status: "running", progress: 20 }, callbacks);
    updateJobStatus(payload.jobId, "running");

    sandboxId = await createSandbox(workspacePath);
    callbacks.onProgress(30);

    // Step 3.5: Inject bot context if this is a bot job
    let finalInstruction = payload.instruction;
    if (payload.botId) {
      try {
        const bot = getBot(payload.botId);
        finalInstruction = buildInstructionWithContext(bot, payload.instruction);
      } catch {
        // Bot may have been deleted — proceed with raw instruction
      }
    }

    // Resolve verbosity
    const verbosity = payload.verbosity ?? "normal";

    // Step 4: Run AI engine in sandbox
    const engine = selectEngine(payload.engineType);
    const engineResult = await engine.run({
      sandboxId,
      instruction: finalInstruction,
      workspacePath,
      verbosity,
      attachmentPaths: payload.attachmentPaths,
      onOutput: (output: string) => {
        if (verbosity !== "quiet") {
          emitEvent(payload, "task:output", { output }, callbacks);
        }
      },
    });
    callbacks.onProgress(70);

    // Save cost data to DB
    const costExtra: Record<string, unknown> = {};
    if (engineResult.inputTokens != null) costExtra.inputTokens = engineResult.inputTokens;
    if (engineResult.outputTokens != null) costExtra.outputTokens = engineResult.outputTokens;
    if (engineResult.costUsd != null) costExtra.costUsd = engineResult.costUsd;

    // Write journal entry for bot
    if (payload.botId) {
      writeJournalEntry({
        botId: payload.botId,
        jobId: payload.jobId,
        entryType: "task_completed",
        summary: `Completed: ${payload.instruction.slice(0, 100)}`,
        details: engineResult.output.slice(0, 2000),
      });
    }

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
        ...costExtra,
      });
      emitEvent(payload, "task:approval_required", { branch, commitSha, prUrl }, callbacks);
    } else {
      updateJobStatus(payload.jobId, "completed", {
        branch,
        commitSha,
        prUrl,
        output: engineResult.output,
        durationMs: Date.now() - startTime,
        ...costExtra,
      });
    }

    callbacks.onProgress(100);
    emitEvent(payload, "task:completed", {
      branch,
      commitSha,
      prUrl,
      inputTokens: engineResult.inputTokens,
      outputTokens: engineResult.outputTokens,
      costUsd: engineResult.costUsd,
    }, callbacks);

    return {
      jobId: payload.jobId,
      status: payload.requireApproval ? "awaiting_approval" : "completed",
      output: engineResult.output,
      branch,
      commitSha,
      prUrl,
      durationMs: Date.now() - startTime,
      inputTokens: engineResult.inputTokens,
      outputTokens: engineResult.outputTokens,
      costUsd: engineResult.costUsd,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    updateJobStatus(payload.jobId, "failed", { error, durationMs: Date.now() - startTime });
    emitEvent(payload, "task:failed", { error }, callbacks);

    if (payload.botId) {
      writeJournalEntry({
        botId: payload.botId,
        jobId: payload.jobId,
        entryType: "task_failed",
        summary: `Failed: ${payload.instruction.slice(0, 100)} — ${error}`,
      });
    }

    return {
      jobId: payload.jobId,
      status: "failed",
      output: "",
      error,
      durationMs: Date.now() - startTime,
    };
  } finally {
    if (sandboxId) {
      await destroySandbox(sandboxId).catch((err) => {
        logger.error({ sandboxId, err }, "Failed to destroy sandbox");
      });
    }
  }
}
