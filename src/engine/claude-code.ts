import type { Engine, EngineRunOptions, EngineResult } from "./types.js";
import { execInSandbox } from "../sandbox/manager.js";
import { logger } from "../util/logger.js";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-opus-4-20250514": { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  "claude-haiku-3-5-20241022": { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};

export class ClaudeCodeEngine implements Engine {
  name = "claude-code";

  async run(options: EngineRunOptions): Promise<EngineResult> {
    const startTime = Date.now();
    const model = options.model ?? "claude-sonnet-4-20250514";
    const maxTurns = options.maxTurns ?? 50;
    const verbosity = options.verbosity ?? "normal";

    const command = [
      "claude",
      "--print",
      "--output-format", "json",
      "--model", model,
      "--max-turns", String(maxTurns),
    ];

    if (verbosity === "verbose") {
      command.push("--verbose");
    }

    if (options.attachmentPaths) {
      for (const imgPath of options.attachmentPaths) {
        command.push("--image", imgPath);
      }
    }

    command.push(options.instruction);

    logger.info(
      { sandboxId: options.sandboxId, model, maxTurns, verbosity },
      "Running Claude Code engine",
    );

    const result = await execInSandbox(
      options.sandboxId,
      command,
      options.onOutput,
    );

    const durationMs = Date.now() - startTime;

    let output: string;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let costUsd: number | undefined;

    try {
      const parsed = JSON.parse(result.stdout);
      output = parsed.result ?? result.stdout;
      inputTokens = parsed.input_tokens;
      outputTokens = parsed.output_tokens;

      if (inputTokens != null && outputTokens != null) {
        const pricing = MODEL_PRICING[model];
        if (pricing) {
          costUsd = inputTokens * pricing.input + outputTokens * pricing.output;
        }
      }
    } catch {
      // Older CLI or non-JSON output — fall back to raw stdout
      output = result.stdout + (result.stderr ? `\n\nStderr:\n${result.stderr}` : "");
    }

    logger.info(
      { sandboxId: options.sandboxId, exitCode: result.exitCode, durationMs, inputTokens, outputTokens, costUsd },
      "Claude Code engine completed",
    );

    return {
      output,
      exitCode: result.exitCode,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd,
    };
  }
}
