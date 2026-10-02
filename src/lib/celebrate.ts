import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { stabilitySchedules, batchCelebrations } from "../db/schema";
import { computeProgress } from "./progress";
import { sendTeamsAlarm } from "./teams";
import { formatDateStr, kstTodayDateOnly } from "./time";
import type { Env } from "../types";

// 등급 저장 직후 호출합니다. F/T 3싸이클 완료 / 전체 완주를 처음 달성했을 때 Teams로 축하 알림을 1회 보냅니다.
export async function maybeCelebrate(env: Env, db: DrizzleD1Database, batchId: string) {
  const rows = await db.select().from(stabilitySchedules).where(eq(stabilitySchedules.batchId, batchId));
  if (rows.length === 0) return;
  const progress = computeProgress(rows, formatDateStr(kstTodayDateOnly()));
  const { productName, labNo } = rows[0];

  const milestones = [
    {
      kind: "ft",
      reached: progress.ftDone,
      text: `🧊🔥 F/T 3싸이클 기록 완료!\n\n${productName} (Lab No. ${labNo})\n\n냉동·해동 반복을 끝까지 챙기셨네요. 수고 많으셨습니다!`,
    },
    {
      kind: "complete",
      reached: progress.complete,
      text: `🎉🏆 안정도 완주!\n\n${productName} (Lab No. ${labNo})\n\n0일부터 3개월까지 모든 안정도 기록을 빠짐없이 마쳤습니다. 정말 고생 많으셨어요!`,
    },
  ];

  for (const m of milestones) {
    if (!m.reached) continue;
    // 이미 보낸 축하면 PK 충돌로 아무것도 삽입되지 않습니다.
    const inserted = await db
      .insert(batchCelebrations)
      .values({ batchId, kind: m.kind, sentAt: Date.now() })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) continue;

    const title = `[축하] ${productName}`;
    await Promise.allSettled([
      sendTeamsAlarm(env.TEAMS_WEBHOOK_URL, title, m.text, rows[0].id, false),
      sendTeamsAlarm(env.TEAMS_WEBHOOK_URL_DM, title, m.text, rows[0].id, false),
    ]);
  }
}
