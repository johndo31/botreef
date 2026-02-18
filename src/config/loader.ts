import { readFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import { configSchema, type AppConfig } from "./schema.js";
import { logger } from "../util/logger.js";

function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, envVar: string) => {
    const envValue = process.env[envVar];
    if (envValue === undefined) {
      logger.warn(`Environment variable ${envVar} is not set`);
      return "";
    }
    return envValue;
  });
}

function deepInterpolate(obj: unknown): unknown {
  if (typeof obj === "string") {
    return interpolateEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(deepInterpolate);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepInterpolate(value);
    }
    return result;
  }
  return obj;
}

export function loadConfig(configPath?: string): AppConfig {
  const path = configPath ?? process.env.BOTREEF_CONFIG ?? "./config.yaml";

  let raw: unknown = {};
  if (existsSync(path)) {
    const content = readFileSync(path, "utf-8");
    raw = yaml.load(content);
    logger.info(`Loaded config from ${path}`);
  } else {
    logger.warn(`Config file not found at ${path}, using defaults`);
  }

  const interpolated = deepInterpolate(raw);
  const result = configSchema.safeParse(interpolated);

  if (!result.success) {
    logger.error({ errors: result.error.flatten() }, "Invalid configuration");
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}
