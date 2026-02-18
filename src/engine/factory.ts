import type { Engine } from "./types.js";
import { ClaudeCodeEngine } from "./claude-code.js";
import { CodexEngine } from "./codex.js";

const engines: Record<string, Engine> = {
  "claude-code": new ClaudeCodeEngine(),
  "codex": new CodexEngine(),
};

export function selectEngine(engineType: string): Engine {
  const engine = engines[engineType];
  if (!engine) {
    throw new Error(`Unknown engine type: ${engineType}. Available: ${Object.keys(engines).join(", ")}`);
  }
  return engine;
}

export function registerEngine(engine: Engine): void {
  engines[engine.name] = engine;
}
