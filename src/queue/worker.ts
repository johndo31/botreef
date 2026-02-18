import { Worker, type Job } from "bullmq";
import type { JobPayload } from "../types/job.js";
import { processJob } from "./job-processor.js";
import { logger } from "../util/logger.js";

const QUEUE_NAME = "botreef:jobs";

let _worker: Worker | null = null;

export interface WorkerDeps {
  connection: unknown;
  concurrency: number;
  onTaskEvent: (event: import("../types/task-event.js").TaskEvent) => void;
}

export function createWorker(deps: WorkerDeps): Worker {
  _worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      logger.info({ jobId: job.data.jobId }, "Processing job");
      try {
        const result = await processJob(job.data, {
          onProgress: (progress: number) => {
            job.updateProgress(progress).catch(() => {});
          },
          onEvent: deps.onTaskEvent,
        });
        return result;
      } catch (err) {
        logger.error({ jobId: job.data.jobId, err }, "Job processing failed");
        throw err;
      }
    },
    {
      connection: deps.connection as any,
      concurrency: deps.concurrency,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  );

  _worker.on("completed", (job) => {
    logger.info({ jobId: job.data.jobId }, "Job completed");
  });

  _worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.data.jobId, err: err.message }, "Job failed");
  });

  logger.info({ concurrency: deps.concurrency }, "Job worker started");
  return _worker;
}

export async function closeWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
    logger.info("Job worker closed");
  }
}
