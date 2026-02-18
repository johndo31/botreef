import { sql } from "drizzle-orm";
import { getDb } from "./client.js";
import { logger } from "../util/logger.js";
import * as schema from "./schema.js";

export function runMigrations() {
  const db = getDb();

  const tables = [
    { name: "users", def: schema.users },
    { name: "user_identities", def: schema.userIdentities },
    { name: "projects", def: schema.projects },
    { name: "jobs", def: schema.jobs },
    { name: "audit_logs", def: schema.auditLogs },
    { name: "approvals", def: schema.approvals },
    { name: "kanban_boards", def: schema.kanbanBoards },
    { name: "kanban_columns", def: schema.kanbanColumns },
    { name: "kanban_stories", def: schema.kanbanStories },
    { name: "dev_servers", def: schema.devServers },
    { name: "bots", def: schema.bots },
    { name: "bot_journal", def: schema.botJournal },
  ];

  for (const table of tables) {
    try {
      db.run(sql`SELECT 1 FROM ${sql.identifier(table.name)} LIMIT 1`);
    } catch {
      logger.info(`Table ${table.name} needs creation`);
    }
  }

  // Use Drizzle's push approach - create tables if they don't exist
  // In production, use drizzle-kit generate + migrate
  createTablesIfNotExist(db);
  logger.info("Schema migrations complete");
}

function createTablesIfNotExist(db: ReturnType<typeof getDb>) {
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'developer',
    api_key_hash TEXT,
    encrypted_api_key TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS user_identities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    channel TEXT NOT NULL,
    channel_user_id TEXT NOT NULL,
    channel_user_name TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    branch_strategy TEXT NOT NULL DEFAULT 'feature-per-job',
    auto_push INTEGER NOT NULL DEFAULT 1,
    auto_create_pr INTEGER NOT NULL DEFAULT 1,
    require_approval INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    channel TEXT NOT NULL,
    channel_message_id TEXT,
    instruction TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    output TEXT,
    error TEXT,
    branch TEXT,
    commit_sha TEXT,
    pr_url TEXT,
    preview_url TEXT,
    duration_ms INTEGER,
    story_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip TEXT,
    channel TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_id TEXT REFERENCES users(id),
    comment TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS kanban_boards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS kanban_columns (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES kanban_boards(id),
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    is_terminal INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS kanban_stories (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES kanban_boards(id),
    column_id TEXT NOT NULL REFERENCES kanban_columns(id),
    title TEXT NOT NULL,
    description TEXT,
    acceptance_criteria TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    story_points INTEGER,
    assignee TEXT,
    assignee_type TEXT DEFAULT 'user',
    position INTEGER NOT NULL DEFAULT 0,
    job_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS dev_servers (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    container_id TEXT NOT NULL,
    port INTEGER NOT NULL,
    preview_url TEXT,
    auth_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'starting',
    created_at TEXT NOT NULL,
    stopped_at TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    engine_type TEXT NOT NULL DEFAULT 'claude-code',
    model TEXT,
    system_prompt TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    poll_interval_seconds INTEGER NOT NULL DEFAULT 30,
    max_concurrent_stories INTEGER NOT NULL DEFAULT 1,
    idle_behavior TEXT NOT NULL DEFAULT 'wait',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS bot_journal (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL REFERENCES bots(id),
    job_id TEXT REFERENCES jobs(id),
    entry_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    story_id TEXT,
    created_at TEXT NOT NULL
  )`);

  // Create indexes
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_user_identities_channel ON user_identities(channel, channel_user_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_kanban_stories_board ON kanban_stories(board_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_kanban_stories_column ON kanban_stories(column_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_bots_project ON bots(project_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_bot_journal_bot ON bot_journal(bot_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_bot_journal_job ON bot_journal(job_id)`);
}
