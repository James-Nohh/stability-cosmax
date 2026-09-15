import type { users } from "./db/schema";

export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  TEAMS_WEBHOOK_URL: string;
}

export interface Variables {
  user: typeof users.$inferSelect;
}
