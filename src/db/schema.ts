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

// "안정도 시작" 버튼 한 번에 6개(1일/1주/2주/1개월/2개월/3개월 후) 행이
// 같은 batchId로 묶여서 생성됩니다.
export const stabilitySchedules = sqliteTable("stability_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: text("batch_id").notNull(),
  productName: text("product_name").notNull(),
  labNo: text("lab_no").notNull(),
  targetDate: text("target_date").notNull(), // 'YYYY-MM-DD' (KST)
  targetHour: integer("target_hour").notNull(), // 0-23 (KST), "안정도 시작" 클릭 시각
  targetMinute: integer("target_minute").notNull(), // 0-59 (KST)
  label: text("label").notNull(), // '1일', '1주', '2주', '1개월', '2개월', '3개월'
  sent: integer("sent", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const batchLogs = sqliteTable("batch_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scheduleId: integer("schedule_id")
    .notNull()
    .references(() => stabilitySchedules.id),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  detail: text("detail"),
  runAt: text("run_at").notNull().default("CURRENT_TIMESTAMP"),
});
