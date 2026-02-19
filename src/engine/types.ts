import type { Verbosity } from "../types/inbound-message.js";

export interface EngineRunOptions {
  sandboxId: string;
  instruction: string;
  workspacePath: string;
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
  verbosity?: Verbosity;
  attachmentPaths?: string[];
  onOutput?: (output: string) => void;
}

export interface EngineResult {
  output: string;
  exitCode: number;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface Engine {
  name: string;
  run(options: EngineRunOptions): Promise<EngineResult>;
}
