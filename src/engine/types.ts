export interface EngineRunOptions {
  containerId: string;
  instruction: string;
  workspacePath: string;
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
  onOutput?: (output: string) => void;
}

export interface EngineResult {
  output: string;
  exitCode: number;
  durationMs: number;
}

export interface Engine {
  name: string;
  run(options: EngineRunOptions): Promise<EngineResult>;
}
