import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"), // R1 엑셀 양식의 "Name" 칸에 쓰일 한글 이름
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

  // 미확인 시 반복 알람: 최초 발송 후 20분 간격으로 3회(1시간), 이후 6시간마다
  // 같은 패턴을 무한 반복합니다. "안정도 확인"/"나중에" 클릭으로 해제됩니다.
  nextReminderAt: integer("next_reminder_at"), // unix ms, 다음 재알림 예정 시각
  burstReminderCount: integer("burst_reminder_count").notNull().default(0), // 현재 버스트 내 재알림 횟수(0~3)
  acknowledgedAt: integer("acknowledged_at"), // unix ms, "안정도 확인" 클릭 시각(설정되면 재알림 중단)

  // "안정도 확인" 클릭 후 입력하는 조건별 등급 (0=적합, 1=적합·특이사항, 2=조건부 적합, 3=부적합)
  gradeC4: integer("grade_4c"),
  gradeC25: integer("grade_25c"),
  gradeC37: integer("grade_37c"),
  gradeC45: integer("grade_45c"),
  gradeSunlight: integer("grade_sunlight"),

  // 등급 1~3일 때 선택하는 특이사항(분리/변색/변취), 콤마로 구분해 저장
  noteC4: text("note_4c"),
  noteC25: text("note_25c"),
  noteC37: text("note_37c"),
  noteC45: text("note_45c"),
  noteSunlight: text("note_sunlight"),

  // 25℃ 항목 전용 추가 측정값
  ph25c: text("ph_25c"),
  viscosity25c: text("viscosity_25c"),

  // R1 엑셀 양식 Conclusion란에 들어갈 한 줄 평. 배치(batchId) 내 모든 행에 동일하게 저장됩니다.
  conclusion: text("conclusion"),

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
