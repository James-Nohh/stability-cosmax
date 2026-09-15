import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { alarmConfigs, batchLogs } from "./db/schema";
import { sendTeamsAlarm } from "./lib/teams";
import { nowKst } from "./lib/time";
import type { Env } from "./types";

// Cron Trigger(5분 간격)가 호출합니다. 현재 시각(KST)의 hour/minute과 일치하고
// 오늘 아직 실행되지 않은 알람만 발송합니다.
export async function runDueAlarms(env: Env) {
  const db = drizzle(env.DB);
  const { hour, minute, dateStr } = nowKst();

  const due = await db
    .select()
    .from(alarmConfigs)
    .where(
      and(
        eq(alarmConfigs.enabled, true),
        eq(alarmConfigs.scheduleHour, hour),
        eq(alarmConfigs.scheduleMinute, minute)
      )
    );

  for (const alarm of due) {
    if (alarm.lastRunDate === dateStr) continue; // 오늘 이미 실행됨

    try {
      await sendTeamsAlarm(env.TEAMS_WEBHOOK_URL, alarm.title, alarm.message);
      await db
        .update(alarmConfigs)
        .set({ lastRunDate: dateStr })
        .where(eq(alarmConfigs.id, alarm.id));
      await db.insert(batchLogs).values({
        alarmConfigId: alarm.id,
        status: "success",
      });
    } catch (err) {
      await db.insert(batchLogs).values({
        alarmConfigId: alarm.id,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
