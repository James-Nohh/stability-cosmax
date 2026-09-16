import type { users } from "./db/schema";

export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  TEAMS_WEBHOOK_URL: string; // 채널
  TEAMS_WEBHOOK_URL_DM: string; // 개인 채팅
}

export interface Variables {
  user: typeof users.$inferSelect;
}
