import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { kanbanBoards, kanbanColumns } from "../db/schema.js";
import { generateId } from "../util/id.js";
import { NotFoundError } from "../util/errors.js";
import { logger } from "../util/logger.js";

const DEFAULT_COLUMNS = [
  { name: "Backlog", position: 0, isTerminal: false },
  { name: "Todo", position: 1, isTerminal: false },
  { name: "In Progress", position: 2, isTerminal: false },
  { name: "Review", position: 3, isTerminal: false },
  { name: "Done", position: 4, isTerminal: true },
];

export interface Board {
  id: string;
  projectId: string;
  name: string;
  columns: Column[];
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isTerminal: boolean;
}

export function createBoard(projectId: string, name: string): Board {
  const db = getDb();
  const boardId = generateId();

  db.insert(kanbanBoards).values({
    id: boardId,
    projectId,
    name,
    createdAt: new Date().toISOString(),
  }).run();

  const columns: Column[] = DEFAULT_COLUMNS.map((col) => {
    const colId = generateId();
    db.insert(kanbanColumns).values({
      id: colId,
      boardId,
      name: col.name,
      position: col.position,
      isTerminal: col.isTerminal,
    }).run();
    return { id: colId, boardId, ...col };
  });

  logger.info({ boardId, projectId }, "Kanban board created");
  return { id: boardId, projectId, name, columns };
}

export function getBoard(boardId: string): Board {
  const db = getDb();
  const board = db.select().from(kanbanBoards).where(eq(kanbanBoards.id, boardId)).get();
  if (!board) throw new NotFoundError("Board", boardId);

  const columns = db
    .select()
    .from(kanbanColumns)
    .where(eq(kanbanColumns.boardId, boardId))
    .all()
    .sort((a, b) => a.position - b.position);

  return {
    id: board.id,
    projectId: board.projectId,
    name: board.name,
    columns: columns.map((c) => ({
      id: c.id,
      boardId: c.boardId,
      name: c.name,
      position: c.position,
      isTerminal: c.isTerminal,
    })),
  };
}

export function getBoardByProject(projectId: string): Board | null {
  const db = getDb();
  const board = db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.projectId, projectId))
    .get();

  if (!board) return null;
  return getBoard(board.id);
}

export function deleteBoard(boardId: string): void {
  const db = getDb();
  db.delete(kanbanColumns).where(eq(kanbanColumns.boardId, boardId)).run();
  db.delete(kanbanBoards).where(eq(kanbanBoards.id, boardId)).run();
  logger.info({ boardId }, "Kanban board deleted");
}
