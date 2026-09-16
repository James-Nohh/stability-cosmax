import { drizzle } from "drizzle-orm/d1";
import { and, eq, ne, or, isNull } from "drizzle-orm";
import { alarmConfigs, batchLogs } from "./db/schema";
import { sendTeamsAlarm } from "./lib/teams";
import { nowKst } from "./lib/time";
import type { Env } from "./types";

// Cron Trigger(5분 간격)가 호출합니다. 등록된 시각(KST)이 이미 지났고
// 오늘 아직 실행되지 않은 알람을 발송합니다.
// 예약 분(minute)이 5의 배수가 아니어도(cron은 :00/:05/:10...에만 돎)
// "지났으면 발송"이므로 다음 cron 틱에서 반드시 잡힙니다.
export async function runDueAlarms(env: Env) {
  const db = drizzle(env.DB);
  const { hour, minute, dateStr } = nowKst();
  const nowMinutes = hour * 60 + minute;

  const candidates = await db
    .select()
    .from(alarmConfigs)
    .where(
      and(
        eq(alarmConfigs.enabled, true),
        or(isNull(alarmConfigs.lastRunDate), ne(alarmConfigs.lastRunDate, dateStr))
      )
    );

  const due = candidates.filter(
    (alarm) => alarm.scheduleHour * 60 + alarm.scheduleMinute <= nowMinutes
  );

  for (const alarm of due) {
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
