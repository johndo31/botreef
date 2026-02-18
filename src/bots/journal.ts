import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { botJournal } from "../db/schema.js";
import { generateId } from "../util/id.js";
import { logger } from "../util/logger.js";

export type JournalEntryType = "task_started" | "task_completed" | "task_failed" | "observation" | "decision" | "learning";

export interface JournalEntry {
  id: string;
  botId: string;
  jobId: string | null;
  entryType: JournalEntryType;
  summary: string;
  details: string | null;
  storyId: string | null;
  createdAt: string;
}

export interface WriteJournalInput {
  botId: string;
  jobId?: string;
  entryType: JournalEntryType;
  summary: string;
  details?: string;
  storyId?: string;
}

export function writeJournalEntry(input: WriteJournalInput): JournalEntry {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const entry = {
    id,
    botId: input.botId,
    jobId: input.jobId ?? null,
    entryType: input.entryType,
    summary: input.summary,
    details: input.details ?? null,
    storyId: input.storyId ?? null,
    createdAt: now,
  };

  db.insert(botJournal).values(entry).run();
  logger.debug({ botId: input.botId, entryType: input.entryType }, "Journal entry written");

  return entry as JournalEntry;
}

export function getRecentJournal(botId: string, limit: number = 10): JournalEntry[] {
  const db = getDb();
  return db.select().from(botJournal)
    .where(eq(botJournal.botId, botId))
    .orderBy(desc(botJournal.createdAt))
    .limit(limit)
    .all() as JournalEntry[];
}

export function getJournalByJob(jobId: string): JournalEntry[] {
  const db = getDb();
  return db.select().from(botJournal)
    .where(eq(botJournal.jobId, jobId))
    .orderBy(desc(botJournal.createdAt))
    .all() as JournalEntry[];
}

export function getJournalByType(botId: string, entryType: JournalEntryType, limit: number = 20): JournalEntry[] {
  const db = getDb();
  return db.select().from(botJournal)
    .where(and(eq(botJournal.botId, botId), eq(botJournal.entryType, entryType)))
    .orderBy(desc(botJournal.createdAt))
    .limit(limit)
    .all() as JournalEntry[];
}
