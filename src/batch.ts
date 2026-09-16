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
  const message = `Lab No. ${schedule.labNo}\n\n안정도를 확인하세요 (${schedule.label} 경과)`;

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
