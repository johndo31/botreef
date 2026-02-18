import { eq, and } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users, userIdentities } from "../db/schema.js";
import { generateId } from "../util/id.js";
import type { ChannelType } from "../types/inbound-message.js";

export interface ResolvedIdentity {
  userId: string;
  userName: string;
  role: string;
}

export async function resolveIdentity(
  channel: ChannelType,
  channelUserId: string,
  channelUserName?: string,
): Promise<ResolvedIdentity | null> {
  const db = getDb();

  const identities = db
    .select({
      userId: userIdentities.userId,
      userName: users.name,
      role: users.role,
    })
    .from(userIdentities)
    .innerJoin(users, eq(users.id, userIdentities.userId))
    .where(
      and(
        eq(userIdentities.channel, channel),
        eq(userIdentities.channelUserId, channelUserId),
      ),
    )
    .all();

  if (identities.length === 0) return null;
  return identities[0]!;
}

export async function createUserWithIdentity(
  name: string,
  channel: ChannelType,
  channelUserId: string,
  channelUserName?: string,
  role: "admin" | "developer" | "viewer" = "developer",
): Promise<ResolvedIdentity> {
  const db = getDb();
  const userId = generateId();
  const identityId = generateId();
  const now = new Date().toISOString();

  db.insert(users).values({
    id: userId,
    name,
    role,
    createdAt: now,
    updatedAt: now,
  }).run();

  db.insert(userIdentities).values({
    id: identityId,
    userId,
    channel,
    channelUserId,
    channelUserName,
    createdAt: now,
  }).run();

  return { userId, userName: name, role };
}

export async function linkIdentity(
  userId: string,
  channel: ChannelType,
  channelUserId: string,
  channelUserName?: string,
): Promise<void> {
  const db = getDb();
  db.insert(userIdentities).values({
    id: generateId(),
    userId,
    channel,
    channelUserId,
    channelUserName,
    createdAt: new Date().toISOString(),
  }).run();
}
