import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { stabilitySchedules, batchLogs } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { Layout } from "../views/layout";
import { kstTodayDateOnly, addDays, addMonths, formatDateStr, nowKst } from "../lib/time";
import type { Env, Variables } from "../types";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminRoutes.use("*", requireAuth);

const CHECKPOINTS: { label: string; addDays?: number; addMonths?: number }[] = [
  { label: "1일", addDays: 1 },
  { label: "1주", addDays: 7 },
  { label: "2주", addDays: 14 },
  { label: "1개월", addMonths: 1 },
  { label: "2개월", addMonths: 2 },
  { label: "3개월", addMonths: 3 },
];

adminRoutes.get("/admin", async (c) => {
  const db = drizzle(c.env.DB);
  const rows = await db.select().from(stabilitySchedules).orderBy(stabilitySchedules.id);

  const batches = new Map<
    string,
    { productName: string; labNo: string; createdAt: string; items: typeof rows }
  >();
  for (const row of rows) {
    if (!batches.has(row.batchId)) {
      batches.set(row.batchId, {
        productName: row.productName,
        labNo: row.labNo,
        createdAt: row.createdAt,
        items: [],
      });
    }
    batches.get(row.batchId)!.items.push(row);
  }
  const batchList = [...batches.entries()].reverse();

  return c.html(
    <Layout title="안정도 관리">
      <div class="card">
        <h2>안정도 시작</h2>
        <form method="post" action="/admin/stability">
          <div class="row">
            <div style="flex:1">
              <label>제품명</label>
              <input type="text" name="productName" required style="width:100%" />
            </div>
          </div>
          <div class="row">
            <div style="flex:1">
              <label>Lab No.</label>
              <input type="text" name="labNo" required style="width:100%" />
            </div>
          </div>
          <button type="submit">안정도 시작</button>
        </form>
        <p style="font-size:13px;color:#6b7280;margin-top:10px;">
          클릭한 시각(KST) 기준으로 1일 / 1주 / 2주 / 1개월 / 2개월 / 3개월 후 같은 시각에
          Teams로 알람이 예약됩니다.
        </p>
      </div>

      <div class="card">
        <h2>등록된 안정도</h2>
        {batchList.length === 0 && <p>등록된 안정도가 없습니다.</p>}
        {batchList.map(([batchId, batch]) => (
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <strong>{batch.productName}</strong>{" "}
                <span style="color:#6b7280;">· Lab No. {batch.labNo}</span>
              </div>
              <form method="post" action={`/admin/stability/${batchId}/delete`}>
                <button type="submit" class="danger">삭제</button>
              </form>
            </div>
            <table>
              <thead>
                <tr>
                  <th>구간</th>
                  <th>예정 시각(KST)</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((item) => (
                  <tr>
                    <td>{item.label}</td>
                    <td>
                      {item.targetDate} {String(item.targetHour).padStart(2, "0")}:
                      {String(item.targetMinute).padStart(2, "0")}
                    </td>
                    <td>
                      <span class={`badge ${item.sent ? "on" : "off"}`}>
                        {item.sent ? "발송완료" : "대기"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Layout>
  );
});

adminRoutes.post("/admin/stability", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.parseBody();
  const productName = String(body.productName ?? "").trim();
  const labNo = String(body.labNo ?? "").trim();

  if (!productName || !labNo) {
    return c.redirect("/admin");
  }

  const batchId = crypto.randomUUID();
  const today = kstTodayDateOnly();
  const { hour, minute } = nowKst();

  const values = CHECKPOINTS.map((cp) => {
    const target = cp.addDays !== undefined ? addDays(today, cp.addDays) : addMonths(today, cp.addMonths!);
    return {
      batchId,
      productName,
      labNo,
      targetDate: formatDateStr(target),
      targetHour: hour,
      targetMinute: minute,
      label: cp.label,
      sent: false,
    };
  });

  await db.insert(stabilitySchedules).values(values);

  return c.redirect("/admin");
});

adminRoutes.post("/admin/stability/:batchId/delete", async (c) => {
  const db = drizzle(c.env.DB);
  const batchId = c.req.param("batchId");
  await db.delete(stabilitySchedules).where(eq(stabilitySchedules.batchId, batchId));
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
      productName: stabilitySchedules.productName,
      labNo: stabilitySchedules.labNo,
      label: stabilitySchedules.label,
    })
    .from(batchLogs)
    .leftJoin(stabilitySchedules, eq(batchLogs.scheduleId, stabilitySchedules.id))
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
              <th>제품명 / Lab No.</th>
              <th>구간</th>
              <th>상태</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colspan={5}>실행 이력이 없습니다.</td>
              </tr>
            )}
            {logs.map((l) => (
              <tr>
                <td>{l.runAt}</td>
                <td>
                  {l.productName ?? "(삭제됨)"} / {l.labNo ?? "-"}
                </td>
                <td>{l.label ?? "-"}</td>
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
