import type { Adapter, AdapterConfig, AdapterDependencies, HealthStatus } from "./types.js";
import { logger } from "../util/logger.js";

const _adapters = new Map<string, Adapter>();

export async function registerAdapter(
  adapter: Adapter,
  config: AdapterConfig,
  deps: AdapterDependencies,
): Promise<void> {
  if (!config.enabled) {
    logger.info({ adapter: adapter.name }, "Adapter disabled, skipping");
    return;
  }

  await adapter.init(config, deps);
  _adapters.set(adapter.name, adapter);
  logger.info({ adapter: adapter.name }, "Adapter registered");
}

export async function startAllAdapters(): Promise<void> {
  for (const [name, adapter] of _adapters) {
    try {
      await adapter.start();
      logger.info({ adapter: name }, "Adapter started");
    } catch (err) {
      logger.error({ adapter: name, err }, "Failed to start adapter");
    }
  }
}

export async function stopAllAdapters(timeoutMs = 5000): Promise<void> {
  for (const [name, adapter] of _adapters) {
    try {
      await adapter.stop(timeoutMs);
      logger.info({ adapter: name }, "Adapter stopped");
    } catch (err) {
      logger.error({ adapter: name, err }, "Failed to stop adapter");
    }
  }
  _adapters.clear();
}

export function getAdapter(name: string): Adapter | undefined {
  return _adapters.get(name);
}

export async function healthCheckAll(): Promise<HealthStatus[]> {
  const results: HealthStatus[] = [];
  for (const adapter of _adapters.values()) {
    try {
      results.push(await adapter.healthCheck());
    } catch (err) {
      results.push({ healthy: false, name: adapter.name, details: { error: String(err) } });
    }
  }
  return results;
}

export function getRegisteredAdapters(): string[] {
  return [..._adapters.keys()];
}
