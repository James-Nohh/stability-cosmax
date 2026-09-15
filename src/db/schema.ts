import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // 세션 토큰
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
});

export const alarmConfigs = sqliteTable("alarm_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  scheduleHour: integer("schedule_hour").notNull(), // 0-23, KST 기준
  scheduleMinute: integer("schedule_minute").notNull(), // 0-59, KST 기준
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunDate: text("last_run_date"), // 'YYYY-MM-DD' (KST), 하루 1회만 발송하기 위한 중복 방지
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const batchLogs = sqliteTable("batch_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alarmConfigId: integer("alarm_config_id")
    .notNull()
    .references(() => alarmConfigs.id),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  detail: text("detail"),
  runAt: text("run_at").notNull().default("CURRENT_TIMESTAMP"),
});
