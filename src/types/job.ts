export interface JobPayload {
  jobId: string;
  projectId: string;
  instruction: string;
  userId: string;
  channel: string;
  channelMessageId?: string;
  repoUrl: string;
  defaultBranch: string;
  branchStrategy: BranchStrategy;
  autoPush: boolean;
  autoCreatePr: boolean;
  requireApproval: boolean;
  engineType: string;
  metadata?: Record<string, unknown>;
}

export type BranchStrategy = "feature-per-job" | "shared" | "main-only";

export type JobStatus =
  | "queued"
  | "cloning"
  | "running"
  | "committing"
  | "pushing"
  | "awaiting_approval"
  | "completed"
  | "failed";

export interface JobResult {
  jobId: string;
  status: JobStatus;
  output: string;
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  previewUrl?: string;
  error?: string;
  durationMs: number;
}
