import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { ForbiddenError } from "../util/errors.js";

export type Role = "admin" | "developer" | "viewer" | "bot";

const PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set([
    "project:create", "project:read", "project:update", "project:delete",
    "task:create", "task:read", "task:cancel",
    "user:create", "user:read", "user:update", "user:delete",
    "approval:approve", "approval:reject",
    "kanban:create", "kanban:read", "kanban:update", "kanban:delete",
    "settings:read", "settings:update",
    "preview:view",
  ]),
  developer: new Set([
    "project:read",
    "task:create", "task:read",
    "approval:approve", "approval:reject",
    "kanban:create", "kanban:read", "kanban:update",
    "preview:view",
  ]),
  viewer: new Set([
    "project:read",
    "task:read",
    "kanban:read",
    "preview:view",
  ]),
  bot: new Set([
    "project:read",
    "task:create", "task:read",
    "kanban:read", "kanban:update",
  ]),
};

export function hasPermission(role: Role, permission: string): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false;
}

export function requirePermission(role: Role, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Role '${role}' lacks permission '${permission}'`);
  }
}

export async function getUserRole(userId: string): Promise<Role> {
  const db = getDb();
  const result = db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get();
  if (!result) throw new ForbiddenError("User not found");
  return result.role as Role;
}
