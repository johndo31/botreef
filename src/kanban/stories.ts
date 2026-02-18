import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { kanbanStories, kanbanColumns } from "../db/schema.js";
import { generateId } from "../util/id.js";
import { NotFoundError, ValidationError } from "../util/errors.js";
import { logger } from "../util/logger.js";

export interface Story {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
  priority: number;
  storyPoints?: number | null;
  assignee?: string | null;
  assigneeType?: string | null;
  position: number;
  jobId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryInput {
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  priority?: number;
  storyPoints?: number;
  assignee?: string;
  assigneeType?: "user" | "agent";
}

export function createStory(input: CreateStoryInput): Story {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  // Get max position in the target column
  const existing = db
    .select({ position: kanbanStories.position })
    .from(kanbanStories)
    .where(eq(kanbanStories.columnId, input.columnId))
    .all();
  const maxPosition = existing.reduce((max, s) => Math.max(max, s.position), -1);

  const story: typeof kanbanStories.$inferInsert = {
    id,
    boardId: input.boardId,
    columnId: input.columnId,
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    priority: input.priority ?? 0,
    storyPoints: input.storyPoints,
    assignee: input.assignee,
    assigneeType: input.assigneeType ?? "user",
    position: maxPosition + 1,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(kanbanStories).values(story).run();
  logger.info({ storyId: id, boardId: input.boardId }, "Story created");

  return { ...story, id } as Story;
}

export function getStory(storyId: string): Story {
  const db = getDb();
  const story = db.select().from(kanbanStories).where(eq(kanbanStories.id, storyId)).get();
  if (!story) throw new NotFoundError("Story", storyId);
  return story as Story;
}

export function getStoriesByBoard(boardId: string): Story[] {
  const db = getDb();
  return db
    .select()
    .from(kanbanStories)
    .where(eq(kanbanStories.boardId, boardId))
    .orderBy(asc(kanbanStories.position))
    .all() as Story[];
}

export function getStoriesByColumn(columnId: string): Story[] {
  const db = getDb();
  return db
    .select()
    .from(kanbanStories)
    .where(eq(kanbanStories.columnId, columnId))
    .orderBy(asc(kanbanStories.priority), asc(kanbanStories.position))
    .all() as Story[];
}

export function moveStory(storyId: string, targetColumnId: string, position?: number): Story {
  const db = getDb();
  const story = getStory(storyId);

  db.update(kanbanStories)
    .set({
      columnId: targetColumnId,
      position: position ?? 0,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(kanbanStories.id, storyId))
    .run();

  logger.info({ storyId, targetColumnId }, "Story moved");
  return { ...story, columnId: targetColumnId, position: position ?? 0 };
}

export function updateStory(
  storyId: string,
  updates: Partial<Pick<Story, "title" | "description" | "acceptanceCriteria" | "priority" | "storyPoints" | "assignee" | "assigneeType" | "jobId">>,
): Story {
  const db = getDb();
  db.update(kanbanStories)
    .set({ ...updates, assigneeType: updates.assigneeType as "user" | "agent" | undefined, updatedAt: new Date().toISOString() })
    .where(eq(kanbanStories.id, storyId))
    .run();
  return getStory(storyId);
}

export function deleteStory(storyId: string): void {
  const db = getDb();
  db.delete(kanbanStories).where(eq(kanbanStories.id, storyId)).run();
  logger.info({ storyId }, "Story deleted");
}

export function getAgentTodoStories(boardId: string): Story[] {
  const db = getDb();
  // Find the "Todo" column for this board
  const todoColumn = db
    .select()
    .from(kanbanColumns)
    .where(and(eq(kanbanColumns.boardId, boardId), eq(kanbanColumns.name, "Todo")))
    .get();

  if (!todoColumn) return [];

  return db
    .select()
    .from(kanbanStories)
    .where(
      and(
        eq(kanbanStories.columnId, todoColumn.id),
        eq(kanbanStories.assigneeType, "agent"),
      ),
    )
    .orderBy(asc(kanbanStories.priority), asc(kanbanStories.position))
    .all() as Story[];
}
