import type { InboundMessage } from "../types/inbound-message.js";
import type { TaskEvent } from "../types/task-event.js";

export interface Adapter {
  name: string;
  init(config: AdapterConfig, deps: AdapterDependencies): Promise<void>;
  start(): Promise<void>;
  stop(timeoutMs?: number): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  sendEvent(event: TaskEvent): Promise<void>;
}

export interface AdapterConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface AdapterDependencies {
  submitMessage: (message: InboundMessage) => Promise<string>;
  logger: import("../util/logger.js").Logger;
}

export interface HealthStatus {
  healthy: boolean;
  name: string;
  details?: Record<string, unknown>;
}
