import type { Engine, EngineRunOptions, EngineResult } from "./types.js";
import { execInSandbox } from "../sandbox/manager.js";
import { logger } from "../util/logger.js";

export class CodexEngine implements Engine {
  name = "codex";

  async run(options: EngineRunOptions): Promise<EngineResult> {
    const startTime = Date.now();
    const verbosity = options.verbosity ?? "normal";

    const command = [
      "codex",
      "--approval-mode", "full-auto",
    ];

    if (verbosity !== "verbose") {
      command.push("--quiet");
    }

    command.push(options.instruction);

    logger.info(
      { sandboxId: options.sandboxId, verbosity },
      "Running Codex engine",
    );

    const result = await execInSandbox(
      options.sandboxId,
      command,
      options.onOutput,
    );

    const durationMs = Date.now() - startTime;
    logger.info(
      { sandboxId: options.sandboxId, exitCode: result.exitCode, durationMs },
      "Codex engine completed",
    );

    return {
      output: result.stdout + (result.stderr ? `\n\nStderr:\n${result.stderr}` : ""),
      exitCode: result.exitCode,
      durationMs,
    };
  }
}
