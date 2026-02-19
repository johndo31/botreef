import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role", { enum: ["admin", "developer", "viewer"] }).notNull().default("developer"),
  apiKeyHash: text("api_key_hash"),
  encryptedApiKey: text("encrypted_api_key"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const userIdentities = sqliteTable("user_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  channel: text("channel").notNull(),
  channelUserId: text("channel_user_id").notNull(),
  channelUserName: text("channel_user_name"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repoUrl: text("repo_url").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  branchStrategy: text("branch_strategy", {
    enum: ["feature-per-job", "shared", "main-only"],
  }).notNull().default("feature-per-job"),
  autoPush: integer("auto_push", { mode: "boolean" }).notNull().default(true),
  autoCreatePr: integer("auto_create_pr", { mode: "boolean" }).notNull().default(true),
  requireApproval: integer("require_approval", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  userId: text("user_id").notNull().references(() => users.id),
  channel: text("channel").notNull(),
  channelMessageId: text("channel_message_id"),
  instruction: text("instruction").notNull(),
  status: text("status", {
    enum: ["queued", "cloning", "running", "committing", "pushing", "awaiting_approval", "completed", "failed"],
  }).notNull().default("queued"),
  output: text("output"),
  error: text("error"),
  branch: text("branch"),
  commitSha: text("commit_sha"),
  prUrl: text("pr_url"),
  previewUrl: text("preview_url"),
  durationMs: integer("duration_ms"),
  storyId: text("story_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  details: text("details"),
  ip: text("ip"),
  channel: text("channel"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobs.id),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewerId: text("reviewer_id").references(() => users.id),
  comment: text("comment"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  resolvedAt: text("resolved_at"),
});

export const kanbanBoards = sqliteTable("kanban_boards", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const kanbanColumns = sqliteTable("kanban_columns", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => kanbanBoards.id),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  isTerminal: integer("is_terminal", { mode: "boolean" }).notNull().default(false),
});

export const kanbanStories = sqliteTable("kanban_stories", {
  id: text("id").primaryKey(),
  boardId: text("board_id").notNull().references(() => kanbanBoards.id),
  columnId: text("column_id").notNull().references(() => kanbanColumns.id),
  title: text("title").notNull(),
  description: text("description"),
  acceptanceCriteria: text("acceptance_criteria"),
  priority: integer("priority").notNull().default(0),
  storyPoints: integer("story_points"),
  assignee: text("assignee"),
  assigneeType: text("assignee_type", { enum: ["user", "bot"] }).default("user"),
  position: integer("position").notNull().default(0),
  jobId: text("job_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const devServers = sqliteTable("dev_servers", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobs.id),
  sandboxId: text("sandbox_id").notNull(),
  port: integer("port").notNull(),
  previewUrl: text("preview_url"),
  authToken: text("auth_token").notNull(),
  status: text("status", { enum: ["starting", "running", "stopped", "failed"] }).notNull().default("starting"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  stoppedAt: text("stopped_at"),
});

export const bots = sqliteTable("bots", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  projectId: text("project_id").notNull().references(() => projects.id),
  engineType: text("engine_type", { enum: ["claude-code", "codex"] }).notNull().default("claude-code"),
  model: text("model"),
  systemPrompt: text("system_prompt"),
  status: text("status", { enum: ["idle", "working", "paused", "stopped"] }).notNull().default("idle"),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
  maxConcurrentStories: integer("max_concurrent_stories").notNull().default(1),
  idleBehavior: text("idle_behavior", { enum: ["wait", "discovery"] }).notNull().default("wait"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const botJournal = sqliteTable("bot_journal", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull().references(() => bots.id),
  jobId: text("job_id").references(() => jobs.id),
  entryType: text("entry_type", { enum: ["task_started", "task_completed", "task_failed", "observation", "decision", "learning"] }).notNull(),
  summary: text("summary").notNull(),
  details: text("details"),
  storyId: text("story_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});
