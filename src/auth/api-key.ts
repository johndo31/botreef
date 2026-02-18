import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { encrypt, decrypt } from "../util/crypto.js";
import { AuthError } from "../util/errors.js";

const API_KEY_PREFIX = "br_";

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString("hex");
}

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function saveApiKey(
  userId: string,
  apiKey: string,
  encryptionKey?: Buffer,
): Promise<void> {
  const db = getDb();
  const hash = hashApiKey(apiKey);
  const encrypted = encryptionKey ? encrypt(apiKey, encryptionKey) : undefined;

  db.update(users)
    .set({
      apiKeyHash: hash,
      encryptedApiKey: encrypted,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .run();
}

export async function validateApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) return null;

  const db = getDb();
  const hash = hashApiKey(apiKey);
  const result = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.apiKeyHash, hash))
    .get();

  return result?.id ?? null;
}

export async function rotateApiKey(
  userId: string,
  encryptionKey?: Buffer,
): Promise<string> {
  const newKey = generateApiKey();
  await saveApiKey(userId, newKey, encryptionKey);
  return newKey;
}
