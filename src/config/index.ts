import { loadConfig } from "./loader.js";
import type { AppConfig } from "./schema.js";

export type { AppConfig } from "./schema.js";
export { loadConfig } from "./loader.js";
export { configSchema } from "./schema.js";

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function setConfig(config: AppConfig): void {
  _config = config;
}
