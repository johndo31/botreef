import RedisModule from "ioredis";
import { logger } from "../util/logger.js";

const Redis = RedisModule.default ?? RedisModule;
type RedisClient = InstanceType<typeof Redis>;

let _connection: RedisClient | null = null;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export function createRedisConnection(config: RedisConfig): RedisClient {
  _connection = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db ?? 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  _connection.on("connect", () => {
    logger.info(`Connected to Redis/Valkey at ${config.host}:${config.port}`);
  });

  _connection.on("error", (err: Error) => {
    logger.error({ err }, "Redis connection error");
  });

  return _connection;
}

export function getRedisConnection(): RedisClient {
  if (!_connection) {
    throw new Error("Redis not initialized. Call createRedisConnection() first.");
  }
  return _connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit();
    _connection = null;
    logger.info("Redis connection closed");
  }
}

export type { RedisClient };
