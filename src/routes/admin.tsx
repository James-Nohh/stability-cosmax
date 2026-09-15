import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { alarmConfigs, batchLogs } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { Layout } from "../views/layout";
import type { Env, Variables } from "../types";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminRoutes.use("*", requireAuth);

adminRoutes.get("/admin", async (c) => {
  const db = drizzle(c.env.DB);
  const alarms = await db.select().from(alarmConfigs).orderBy(alarmConfigs.id);

  return c.html(
    <Layout title="알람 설정">
      <div class="card">
        <h2>새 알람 추가</h2>
        <form method="post" action="/admin/alarms">
          <div class="row">
            <div style="flex:1">
              <label>제목</label>
              <input type="text" name="title" required style="width:100%" />
            </div>
          </div>
          <div class="row">
            <div style="flex:1">
              <label>메시지</label>
              <input type="text" name="message" required style="width:100%" />
            </div>
          </div>
          <div class="row">
            <div>
              <label>시(0-23, KST)</label>
              <input type="number" name="hour" min="0" max="23" required />
            </div>
            <div>
              <label>분(0-59, KST)</label>
              <input type="number" name="minute" min="0" max="59" required />
            </div>
          </div>
          <button type="submit">추가</button>
        </form>
      </div>

      <div class="card">
        <h2>등록된 알람</h2>
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>시각(KST)</th>
              <th>상태</th>
              <th>마지막 실행일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alarms.length === 0 && (
              <tr>
                <td colspan={5}>등록된 알람이 없습니다.</td>
              </tr>
            )}
            {alarms.map((a) => (
              <tr>
                <td>{a.title}</td>
                <td>
                  {String(a.scheduleHour).padStart(2, "0")}:
                  {String(a.scheduleMinute).padStart(2, "0")}
                </td>
                <td>
                  <span class={`badge ${a.enabled ? "on" : "off"}`}>
                    {a.enabled ? "사용" : "중지"}
                  </span>
                </td>
                <td>{a.lastRunDate ?? "-"}</td>
                <td>
                  <form class="inline" method="post" action={`/admin/alarms/${a.id}/toggle`}>
                    <button type="submit" class="secondary">
                      {a.enabled ? "중지" : "재개"}
                    </button>
                  </form>{" "}
                  <form class="inline" method="post" action={`/admin/alarms/${a.id}/delete`}>
                    <button type="submit" class="danger">삭제</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
});

adminRoutes.post("/admin/alarms", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.parseBody();

  await db.insert(alarmConfigs).values({
    title: String(body.title ?? ""),
    message: String(body.message ?? ""),
    scheduleHour: Number(body.hour ?? 0),
    scheduleMinute: Number(body.minute ?? 0),
    enabled: true,
  });

  return c.redirect("/admin");
});

adminRoutes.post("/admin/alarms/:id/toggle", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const [current] = await db.select().from(alarmConfigs).where(eq(alarmConfigs.id, id)).limit(1);
  if (current) {
    await db.update(alarmConfigs).set({ enabled: !current.enabled }).where(eq(alarmConfigs.id, id));
  }
  return c.redirect("/admin");
});

adminRoutes.post("/admin/alarms/:id/delete", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  await db.delete(alarmConfigs).where(eq(alarmConfigs.id, id));
  return c.redirect("/admin");
});

adminRoutes.get("/admin/logs", async (c) => {
  const db = drizzle(c.env.DB);
  const logs = await db
    .select({
      id: batchLogs.id,
      status: batchLogs.status,
      detail: batchLogs.detail,
      runAt: batchLogs.runAt,
      title: alarmConfigs.title,
    })
    .from(batchLogs)
    .leftJoin(alarmConfigs, eq(batchLogs.alarmConfigId, alarmConfigs.id))
    .orderBy(desc(batchLogs.id))
    .limit(100);

  return c.html(
    <Layout title="실행 로그">
      <div class="card">
        <h2>최근 실행 로그</h2>
        <table>
          <thead>
            <tr>
              <th>시각</th>
              <th>알람</th>
              <th>상태</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colspan={4}>실행 이력이 없습니다.</td>
              </tr>
            )}
            {logs.map((l) => (
              <tr>
                <td>{l.runAt}</td>
                <td>{l.title ?? "(삭제됨)"}</td>
                <td>
                  <span class={`badge ${l.status === "success" ? "on" : "off"}`}>{l.status}</span>
                </td>
                <td>{l.detail ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
});
