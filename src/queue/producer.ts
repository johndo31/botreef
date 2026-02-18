import { Queue } from "bullmq";
import type { JobPayload } from "../types/job.js";
import { logger } from "../util/logger.js";

const QUEUE_NAME = "botreef:jobs";

let _queue: Queue | null = null;

export function createJobQueue(connection: unknown): Queue {
  _queue = new Queue(QUEUE_NAME, {
    connection: connection as any,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });

  logger.info("Job queue created");
  return _queue;
}

export function getJobQueue(): Queue {
  if (!_queue) {
    throw new Error("Job queue not initialized. Call createJobQueue() first.");
  }
  return _queue;
}

export async function enqueueJob(payload: JobPayload): Promise<string> {
  const queue = getJobQueue();
  const job = await queue.add(payload.jobId, payload, {
    jobId: payload.jobId,
  });
  logger.info({ jobId: payload.jobId, projectId: payload.projectId }, "Job enqueued");
  return job.id!;
}

export async function closeJobQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
    logger.info("Job queue closed");
  }
}
