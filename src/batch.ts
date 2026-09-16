import { drizzle } from "drizzle-orm/d1";
import { and, eq, lte } from "drizzle-orm";
import { stabilitySchedules, batchLogs } from "./db/schema";
import { sendTeamsAlarm } from "./lib/teams";
import { nowKst } from "./lib/time";
import type { Env } from "./types";

const ALARM_HOUR = 9; // 매 체크포인트 오전 9시(KST) 발송

// Cron Trigger(5분 간격)가 호출합니다. target_date가 지났거나,
// 오늘이면서 오전 9시가 지난, 아직 안 보낸 스케줄을 발송합니다.
export async function runDueAlarms(env: Env) {
  const db = drizzle(env.DB);
  const { hour, minute, dateStr } = nowKst();
  const nowMinutes = hour * 60 + minute;

  const candidates = await db
    .select()
    .from(stabilitySchedules)
    .where(and(eq(stabilitySchedules.sent, false), lte(stabilitySchedules.targetDate, dateStr)));

  const due = candidates.filter(
    (s) => s.targetDate < dateStr || nowMinutes >= ALARM_HOUR * 60
  );

  for (const schedule of due) {
    const title = `[안정도 알람] ${schedule.productName}`;
    const message = `Lab No. ${schedule.labNo}\n\n안정도를 확인하세요 (${schedule.label} 경과)`;

    // 채널 + 개인 채팅 둘 다 발송. 하나라도 성공하면 재발송을 막기 위해
    // sent = true로 표시하고, 실패한 웹훅이 있으면 로그에 남깁니다.
    const results = await Promise.allSettled([
      sendTeamsAlarm(env.TEAMS_WEBHOOK_URL, title, message),
      sendTeamsAlarm(env.TEAMS_WEBHOOK_URL_DM, title, message),
    ]);
    const failures = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );

    await db
      .update(stabilitySchedules)
      .set({ sent: true })
      .where(eq(stabilitySchedules.id, schedule.id));
    await db.insert(batchLogs).values({
      scheduleId: schedule.id,
      status: failures.length === 0 ? "success" : "error",
      detail:
        failures.length === 0
          ? null
          : failures.map((f) => String(f.reason)).join("; "),
    });
  }
}
