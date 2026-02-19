import type { Engine, EngineRunOptions, EngineResult } from "./types.js";
import { execInSandbox } from "../sandbox/manager.js";
import { logger } from "../util/logger.js";

export class ClaudeCodeEngine implements Engine {
  name = "claude-code";

  async run(options: EngineRunOptions): Promise<EngineResult> {
    const startTime = Date.now();
    const model = options.model ?? "claude-sonnet-4-20250514";
    const maxTurns = options.maxTurns ?? 50;

    const command = [
      "claude",
      "--print",
      "--model", model,
      "--max-turns", String(maxTurns),
      options.instruction,
    ];

    logger.info(
      { sandboxId: options.sandboxId, model, maxTurns },
      "Running Claude Code engine",
    );

    const result = await execInSandbox(
      options.sandboxId,
      command,
      options.onOutput,
    );

    const durationMs = Date.now() - startTime;
    logger.info(
      { sandboxId: options.sandboxId, exitCode: result.exitCode, durationMs },
      "Claude Code engine completed",
    );

    return {
      output: result.stdout + (result.stderr ? `\n\nStderr:\n${result.stderr}` : ""),
      exitCode: result.exitCode,
      durationMs,
    };
  }
}
