import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq, lte, isNull } from "drizzle-orm";
import { stabilitySchedules, batchLogs } from "./db/schema";
import { sendTeamsAlarm } from "./lib/teams";
import { nowKst } from "./lib/time";
import type { Env } from "./types";

const REMINDER_INTERVAL_MS = 20 * 60 * 1000; // 20분
const BURST_LIMIT = 3; // 20분 간격으로 3회(1시간)
const BURST_GAP_MS = 6 * 60 * 60 * 1000; // 그 후 6시간마다 버스트 반복

type Schedule = typeof stabilitySchedules.$inferSelect;

// 구간 순서(경과 시간 순). 알람을 보낼 구간보다 앞선 구간들만 과거 이력으로 취급합니다.
const SEGMENT_ORDER = ["0일", "1일", "1주", "2주", "1개월", "2개월", "3개월"];
const SEGMENT_LABELS: Record<string, string> = {
  "0일": "0D",
  "1일": "1D",
  "1주": "1W",
  "2주": "2W",
  "1개월": "1M",
  "2개월": "2M",
  "3개월": "3M",
};

const CONDITION_DEFS: {
  label: string;
  appearanceField: keyof Schedule;
  odorField: keyof Schedule;
  noteField: keyof Schedule;
}[] = [
  { label: "4℃", appearanceField: "gradeAppearanceC4", odorField: "gradeOdorC4", noteField: "noteAppearanceC4" },
  { label: "25℃", appearanceField: "gradeAppearanceC25", odorField: "gradeOdorC25", noteField: "noteAppearanceC25" },
  { label: "37℃", appearanceField: "gradeAppearanceC37", odorField: "gradeOdorC37", noteField: "noteAppearanceC37" },
  { label: "45℃", appearanceField: "gradeAppearanceC45", odorField: "gradeOdorC45", noteField: "noteAppearanceC45" },
  {
    label: "일광",
    appearanceField: "gradeAppearanceSunlight",
    odorField: "gradeOdorSunlight",
    noteField: "noteAppearanceSunlight",
  },
];

// 이전 구간들 중 등급 1(적합·특이사항 있음)이 기록된 조건이 있으면 주의 문구를 만듭니다.
async function buildCautionText(db: DrizzleD1Database, schedule: Schedule): Promise<string | null> {
  const orderIdx = SEGMENT_ORDER.indexOf(schedule.label);
  if (orderIdx <= 0) return null;
  const priorLabels = new Set(SEGMENT_ORDER.slice(0, orderIdx));

  const rows = await db
    .select()
    .from(stabilitySchedules)
    .where(eq(stabilitySchedules.batchId, schedule.batchId));

  const isIssueGrade = (g: number | null) => g === 1 || g === 2 || g === 3;

  const lines: string[] = [];
  for (const row of rows) {
    if (!priorLabels.has(row.label)) continue;
    const segLabel = SEGMENT_LABELS[row.label] ?? row.label;
    for (const cond of CONDITION_DEFS) {
      const appearanceGrade = row[cond.appearanceField] as number | null;
      const odorGrade = row[cond.odorField] as number | null;
      if (!isIssueGrade(appearanceGrade) && !isIssueGrade(odorGrade)) continue;
      const note = row[cond.noteField] as string | null;
      const appearanceText = note ? `${appearanceGrade} (${note})` : String(appearanceGrade ?? "-");
      const odorText = odorGrade == null ? "-" : String(odorGrade);
      lines.push(`${segLabel}, ${cond.label}, 외관 ${appearanceText}, 냄새 ${odorText} 발생. 안정도 주의 요망`);
    }
  }

  return lines.length ? lines.join("\n\n") : null;
}

// Cron Trigger(매분)가 호출합니다.
// 1) target_date/시각이 지났고 아직 최초 발송 안 된 스케줄을 발송
// 2) 최초 발송했지만 미확인(acknowledgedAt 없음) 상태로 다음 재알림 시각이 지난 스케줄을 재발송
export async function runDueAlarms(env: Env) {
  const db = drizzle(env.DB);
  const { hour, minute, dateStr } = nowKst();
  const nowMinutes = hour * 60 + minute;
  const nowMs = Date.now();

  const initialCandidates = await db
    .select()
    .from(stabilitySchedules)
    .where(and(eq(stabilitySchedules.sent, false), lte(stabilitySchedules.targetDate, dateStr)));

  const initialDue = initialCandidates.filter(
    (s) => s.targetDate < dateStr || nowMinutes >= s.targetHour * 60 + s.targetMinute
  );

  for (const schedule of initialDue) {
    await sendAndLog(env, db, schedule);
    await db
      .update(stabilitySchedules)
      .set({ sent: true, nextReminderAt: nowMs + REMINDER_INTERVAL_MS, burstReminderCount: 0 })
      .where(eq(stabilitySchedules.id, schedule.id));
  }

  const reminderDue = await db
    .select()
    .from(stabilitySchedules)
    .where(
      and(
        eq(stabilitySchedules.sent, true),
        isNull(stabilitySchedules.acknowledgedAt),
        lte(stabilitySchedules.nextReminderAt, nowMs)
      )
    );

  for (const schedule of reminderDue) {
    await sendAndLog(env, db, schedule);
    const count = schedule.burstReminderCount + 1;
    if (count < BURST_LIMIT) {
      await db
        .update(stabilitySchedules)
        .set({ nextReminderAt: nowMs + REMINDER_INTERVAL_MS, burstReminderCount: count })
        .where(eq(stabilitySchedules.id, schedule.id));
    } else {
      await db
        .update(stabilitySchedules)
        .set({ nextReminderAt: nowMs + BURST_GAP_MS, burstReminderCount: 0 })
        .where(eq(stabilitySchedules.id, schedule.id));
    }
  }
}

async function sendAndLog(env: Env, db: DrizzleD1Database, schedule: Schedule) {
  const title = `[안정도 알람] ${schedule.productName}`;
  let message = `Lab No. ${schedule.labNo}\n\n안정도를 확인하세요 (${schedule.label} 경과)`;

  const caution = await buildCautionText(db, schedule);
  if (caution) {
    message += `\n\n⚠️ ${caution}`;
  }

  const results = await Promise.allSettled([
    sendTeamsAlarm(env.TEAMS_WEBHOOK_URL, title, message, schedule.id),
    sendTeamsAlarm(env.TEAMS_WEBHOOK_URL_DM, title, message, schedule.id),
  ]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

  await db.insert(batchLogs).values({
    scheduleId: schedule.id,
    status: failures.length === 0 ? "success" : "error",
    detail: failures.length === 0 ? null : failures.map((f) => String(f.reason)).join("; "),
  });
}
