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
  // Appearance(외관: 분리/변색)와 Odor(변취)를 각각 독립적으로 입력받습니다.
  gradeAppearanceC4: integer("grade_appearance_4c"),
  gradeOdorC4: integer("grade_odor_4c"),
  noteAppearanceC4: text("note_appearance_4c"), // 분리/변색, 콤마로 구분

  gradeAppearanceC25: integer("grade_appearance_25c"),
  gradeOdorC25: integer("grade_odor_25c"),
  noteAppearanceC25: text("note_appearance_25c"),

  gradeAppearanceC37: integer("grade_appearance_37c"),
  gradeOdorC37: integer("grade_odor_37c"),
  noteAppearanceC37: text("note_appearance_37c"),

  gradeAppearanceC45: integer("grade_appearance_45c"),
  gradeOdorC45: integer("grade_odor_45c"),
  noteAppearanceC45: text("note_appearance_45c"),

  gradeAppearanceSunlight: integer("grade_appearance_sunlight"),
  gradeOdorSunlight: integer("grade_odor_sunlight"),
  noteAppearanceSunlight: text("note_appearance_sunlight"),

  // 25℃ 항목 전용 추가 측정값. specificGravity25c는 "0일"(안정도 시작 시점) 행에만 입력됩니다.
  ph25c: text("ph_25c"),
  viscosity25c: text("viscosity_25c"),
  specificGravity25c: text("specific_gravity_25c"),

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
