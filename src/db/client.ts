import Database, { type Database as SqliteDatabase } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { logger } from "../util/logger.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: SqliteDatabase | null = null;

export function initDatabase(dbPath: string) {
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("busy_timeout = 5000");

  _db = drizzle(_sqlite, { schema });
  logger.info(`Database initialized at ${dbPath}`);
  return _db;
}

export function getDb() {
  if (!_db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return _db;
}

export function getSqlite(): SqliteDatabase {
  if (!_sqlite) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return _sqlite;
}

export function closeDatabase() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
    logger.info("Database closed");
  }
}

export type BotreefDb = ReturnType<typeof drizzle<typeof schema>>;
