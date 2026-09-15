import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { sessions, users } from "../db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일

export async function createSession(db: DrizzleD1Database, userId: number): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return token;
}

export async function getUserBySession(db: DrizzleD1Database, token: string | undefined) {
  if (!token) return null;
  const [session] = await db.select().from(sessions).where(eq(sessions.id, token)).limit(1);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user ?? null;
}

export async function deleteSession(db: DrizzleD1Database, token: string | undefined) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, token));
}
