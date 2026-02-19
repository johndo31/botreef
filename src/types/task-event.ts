export type TaskEventType =
  | "task:created"
  | "task:started"
  | "task:progress"
  | "task:output"
  | "task:completed"
  | "task:failed"
  | "task:approval_required";

export interface TaskEvent {
  type: TaskEventType;
  jobId: string;
  projectId: string;
  channel: string;
  channelMessageId?: string;
  userId: string;
  timestamp: Date;
  data: TaskEventData;
}

export interface TaskEventData {
  status?: string;
  output?: string;
  error?: string;
  progress?: number;
  branch?: string;
  prUrl?: string;
  commitSha?: string;
  previewUrl?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}
