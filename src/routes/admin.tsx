import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc, inArray } from "drizzle-orm";
import { raw } from "hono/utils/html";
import { stabilitySchedules, batchLogs } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { Layout } from "../views/layout";
import { kstTodayDateOnly, addDays, addMonths, formatDateStr, nowKst } from "../lib/time";
import { buildR1Workbook } from "../lib/r1export";
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

const GRADE_LABELS = [
  "0 - 적합",
  "1 - 적합. 특이사항 있음",
  "2 - 조건부 적합. 고객사 안내 및 안정도 확인 필요",
  "3 - 부적합",
];

// Appearance(외관: 분리/변색)와 Odor(변취)를 조건별로 각각 독립 입력받습니다.
// Odor는 사유 없이 숫자 등급만 기록합니다.
const CONDITIONS = [
  {
    label: "4℃",
    appearanceField: "gradeAppearanceC4",
    appearanceInputName: "gradeAppearanceC4",
    odorField: "gradeOdorC4",
    odorInputName: "gradeOdorC4",
    noteField: "noteAppearanceC4",
    noteInputName: "noteAppearanceC4",
    isC25: false,
  },
  {
    label: "25℃",
    appearanceField: "gradeAppearanceC25",
    appearanceInputName: "gradeAppearanceC25",
    odorField: "gradeOdorC25",
    odorInputName: "gradeOdorC25",
    noteField: "noteAppearanceC25",
    noteInputName: "noteAppearanceC25",
    isC25: true,
  },
  {
    label: "37℃",
    appearanceField: "gradeAppearanceC37",
    appearanceInputName: "gradeAppearanceC37",
    odorField: "gradeOdorC37",
    odorInputName: "gradeOdorC37",
    noteField: "noteAppearanceC37",
    noteInputName: "noteAppearanceC37",
    isC25: false,
  },
  {
    label: "45℃",
    appearanceField: "gradeAppearanceC45",
    appearanceInputName: "gradeAppearanceC45",
    odorField: "gradeOdorC45",
    odorInputName: "gradeOdorC45",
    noteField: "noteAppearanceC45",
    noteInputName: "noteAppearanceC45",
    isC25: false,
  },
  {
    label: "일광",
    appearanceField: "gradeAppearanceSunlight",
    appearanceInputName: "gradeAppearanceSunlight",
    odorField: "gradeOdorSunlight",
    odorInputName: "gradeOdorSunlight",
    noteField: "noteAppearanceSunlight",
    noteInputName: "noteAppearanceSunlight",
    isC25: false,
  },
] as const satisfies {
  label: string;
  appearanceField: keyof typeof stabilitySchedules.$inferSelect;
  appearanceInputName: string;
  odorField: keyof typeof stabilitySchedules.$inferSelect;
  odorInputName: string;
  noteField: keyof typeof stabilitySchedules.$inferSelect;
  noteInputName: string;
  isC25: boolean;
}[];

const REASON_OPTIONS = ["분리", "변색"];

const SEGMENT_LABELS: Record<string, string> = {
  "0일": "0D",
  "1일": "1D",
  "1주": "1W",
  "2주": "2W",
  "1개월": "1M",
  "2개월": "2M",
  "3개월": "3M",
};

function segmentLabel(label: string): string {
  return SEGMENT_LABELS[label] ?? label;
}

// "2026-09-18" -> "09/18" (표는 항상 같은 배치를 보여주므로 연도는 생략)
function shortDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
}

const ALERT_GRADES = new Set([2, 3]);

function renderGrade(grade: number | null, note: string | null) {
  if (grade == null) return "-";
  const alert = ALERT_GRADES.has(grade);
  if (!note) return alert ? <span style="color:#dc2626;">{grade}</span> : String(grade);
  return (
    <span style={alert ? "color:#dc2626;" : undefined}>
      {grade}{" "}
      <span style={`font-size:11px;${alert ? "color:#dc2626;" : "color:#9ca3af;"}`}>({note})</span>
    </span>
  );
}

function renderOdor(grade: number | null) {
  if (grade == null) return "-";
  return ALERT_GRADES.has(grade) ? <span style="color:#dc2626;">{grade}</span> : String(grade);
}

function renderExtra25(ph: string | null, viscosity: string | null, specificGravity: string | null) {
  const parts = [
    ph && `pH ${ph}`,
    viscosity && `점(경)도 ${viscosity}`,
    specificGravity && `비중 ${specificGravity}`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return (
    <div style="font-size:11px;color:#6b7280;margin-top:2px;">
      {parts.map((part) => (
        <div>{part}</div>
      ))}
    </div>
  );
}

const SNOOZE_OPTIONS = [
  { minutes: 30, label: "30분 뒤" },
  { minutes: 60, label: "1시간 뒤" },
  { minutes: 120, label: "2시간 뒤" },
  { minutes: 180, label: "3시간 뒤" },
  { minutes: 240, label: "4시간 뒤" },
];

adminRoutes.get("/admin", async (c) => {
  const db = drizzle(c.env.DB);
  const labNoQuery = (c.req.query("labNo") ?? "").trim();
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
  let batchList = [...batches.entries()].reverse();
  if (labNoQuery) {
    batchList = batchList.filter(([, batch]) =>
      batch.labNo.toLowerCase().includes(labNoQuery.toLowerCase())
    );
  }

  return c.html(
    <Layout title="안정도 관리">
      <div class="card">
        <h2>안정도 알람/관리 헬퍼</h2>
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
          <div class="row">
            <div>
              <label>pH</label>
              <input type="text" name="ph0" style="width:80px" />
            </div>
            <div>
              <label>점(경)도</label>
              <input type="text" name="viscosity0" style="width:80px" />
            </div>
            <div>
              <label>Specific gravity</label>
              <input type="text" name="specificGravity0" style="width:80px" />
            </div>
          </div>
          <button type="submit">안정도 시작</button>
        </form>
        <p style="font-size:13px;color:#6b7280;margin-top:10px;">
          클릭한 시각(KST) 기준으로 1일 / 1주 / 2주 / 1개월 / 2개월 / 3개월 후 같은 시각에
          Teams로 알람이 예약됩니다. pH/점(경)도/Specific gravity는 0일(시작 시점) 측정값으로,
          입력하지 않으면 빈 칸으로 남습니다.
        </p>
      </div>

      <div class="card">
        <h2>등록된 안정도</h2>
        <form method="get" action="/admin" class="row">
          <div style="flex:1">
            <label>Lab No. 검색</label>
            <input type="text" name="labNo" value={labNoQuery} placeholder="Lab No. 입력" style="width:100%" />
          </div>
          <div style="display:flex;align-items:flex-end;">
            <button type="submit">검색</button>
          </div>
        </form>
        {batchList.length === 0 && <p>{labNoQuery ? "검색 결과가 없습니다." : "등록된 안정도가 없습니다."}</p>}
        {batchList.map(([batchId, batch]) => (
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div>
                <strong>{batch.productName}</strong>{" "}
                <span style="color:#6b7280;">· Lab No. {batch.labNo}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <a href={`/admin/stability/${batchId}/export`} class="btn-excel">
                  엑셀 다운로드
                </a>
                <form method="post" action={`/admin/stability/${batchId}/delete`}>
                  <button type="submit" class="danger">삭제</button>
                </form>
              </div>
            </div>
            <div class="scroll-x">
              <table class="stability-table">
                <colgroup>
                  <col style="width:44px" />
                  <col style="width:64px" />
                  {CONDITIONS.map(() => (
                    <col />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th>구간</th>
                    <th>예정(KST)</th>
                    {CONDITIONS.map((cond) => (
                      <th>{cond.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((item) => (
                    <tr>
                      <td>{segmentLabel(item.label)}</td>
                      <td>
                        <div>{shortDate(item.targetDate)}</div>
                        <div style="font-size:11px;color:#6b7280;">
                          {String(item.targetHour).padStart(2, "0")}:{String(item.targetMinute).padStart(2, "0")}
                        </div>
                      </td>
                      {CONDITIONS.map((cond) => (
                        <td>
                          <div style="margin-bottom:2px;">
                            <div style="font-size:10px;color:#9ca3af;line-height:1.3;">외관</div>
                            <div>{renderGrade(item[cond.appearanceField], item[cond.noteField])}</div>
                          </div>
                          <div>
                            <div style="font-size:10px;color:#9ca3af;line-height:1.3;">냄새</div>
                            <div>{renderOdor(item[cond.odorField])}</div>
                          </div>
                          {cond.isC25 && renderExtra25(item.ph25c, item.viscosity25c, item.specificGravity25c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form method="post" action={`/admin/stability/${batchId}/conclusion`} class="row" style="margin-top:12px;">
              <div style="flex:1">
                <label>결론 한 줄 평 (엑셀 Conclusion에 반영)</label>
                <input
                  type="text"
                  name="conclusion"
                  value={batch.items[0]?.conclusion ?? ""}
                  style="width:100%"
                />
              </div>
              <div style="display:flex;align-items:flex-end;">
                <button type="submit" class="secondary">저장</button>
              </div>
            </form>
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
  const ph0 = String(body.ph0 ?? "").trim();
  const viscosity0 = String(body.viscosity0 ?? "").trim();
  const specificGravity0 = String(body.specificGravity0 ?? "").trim();

  if (!productName || !labNo) {
    return c.redirect("/admin");
  }

  const batchId = crypto.randomUUID();
  const today = kstTodayDateOnly();
  const { hour, minute } = nowKst();
  const now = Date.now();

  // 0일(시작 시점) — 모든 조건 등급을 0(적합)으로 자동 기록, 알람 대상 아님(sent/acknowledged 처리 완료).
  const dayZero = {
    batchId,
    productName,
    labNo,
    targetDate: formatDateStr(today),
    targetHour: hour,
    targetMinute: minute,
    label: "0일",
    sent: true,
    acknowledgedAt: now,
    gradeAppearanceC4: 0,
    gradeOdorC4: 0,
    gradeAppearanceC25: 0,
    gradeOdorC25: 0,
    gradeAppearanceC37: 0,
    gradeOdorC37: 0,
    gradeAppearanceC45: 0,
    gradeOdorC45: 0,
    gradeAppearanceSunlight: 0,
    gradeOdorSunlight: 0,
    ph25c: ph0 || null,
    viscosity25c: viscosity0 || null,
    specificGravity25c: specificGravity0 || null,
  };

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

  await db.insert(stabilitySchedules).values([dayZero, ...values]);

  return c.redirect("/admin");
});

adminRoutes.post("/admin/stability/:batchId/delete", async (c) => {
  const db = drizzle(c.env.DB);
  const batchId = c.req.param("batchId");

  const rows = await db
    .select({ id: stabilitySchedules.id })
    .from(stabilitySchedules)
    .where(eq(stabilitySchedules.batchId, batchId));
  const scheduleIds = rows.map((r) => r.id);

  // batch_logs가 stability_schedules.id를 참조하므로(FK), 먼저 로그부터 지워야
  // 실제 알람이 한 번이라도 발송된 배치의 삭제가 FK 제약 위반으로 실패하지 않습니다.
  if (scheduleIds.length > 0) {
    await db.delete(batchLogs).where(inArray(batchLogs.scheduleId, scheduleIds));
  }
  await db.delete(stabilitySchedules).where(eq(stabilitySchedules.batchId, batchId));

  return c.redirect("/admin");
});

adminRoutes.post("/admin/stability/:batchId/conclusion", async (c) => {
  const db = drizzle(c.env.DB);
  const batchId = c.req.param("batchId");
  const body = await c.req.parseBody();
  const conclusion = String(body.conclusion ?? "").trim();
  await db
    .update(stabilitySchedules)
    .set({ conclusion: conclusion || null })
    .where(eq(stabilitySchedules.batchId, batchId));
  return c.redirect("/admin");
});

adminRoutes.get("/admin/stability/:batchId/export", async (c) => {
  const db = drizzle(c.env.DB);
  const batchId = c.req.param("batchId");
  const rows = await db
    .select()
    .from(stabilitySchedules)
    .where(eq(stabilitySchedules.batchId, batchId));

  if (rows.length === 0) {
    return c.text("존재하지 않는 안정도입니다.", 404);
  }

  const buffer = await buildR1Workbook(rows, c.get("user"));

  const { productName, labNo } = rows[0];
  const filename = `안정도_${productName}_${labNo}.xlsx`.replace(/[\\/:*?"<>|]/g, "_");

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stability.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
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

adminRoutes.get("/ack/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const [schedule] = await db
    .select()
    .from(stabilitySchedules)
    .where(eq(stabilitySchedules.id, id))
    .limit(1);

  if (!schedule) {
    return c.html(
      <Layout title="안정도 확인">
        <div class="card">존재하지 않는 알람입니다.</div>
      </Layout>
    );
  }

  if (!schedule.acknowledgedAt) {
    await db
      .update(stabilitySchedules)
      .set({ acknowledgedAt: Date.now() })
      .where(eq(stabilitySchedules.id, id));
  }

  return c.html(
    <Layout title="안정도 확인">
      <div class="card">
        <h2>안정도 확인</h2>
        <p>
          <strong>{schedule.productName}</strong> · Lab No. {schedule.labNo} · {schedule.label} 경과
        </p>
        <p style="font-size:13px;color:#16a34a;">반복 알람이 해제되었습니다.</p>
        <form method="post" action={`/ack/${id}`}>
          {CONDITIONS.map((cond) => {
            const existingNotes = (schedule[cond.noteField] ?? "").split(",").filter(Boolean);
            const noteBoxId = `note-${cond.appearanceInputName}`;
            const currentAppearance = schedule[cond.appearanceField];
            const currentOdor = schedule[cond.odorField];
            const showNotes = currentAppearance != null && currentAppearance > 0;
            return (
              <div class="row" style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:12px;">
                <div style="flex:1">
                  <label>{cond.label}</label>
                  <div style="display:flex;gap:28px;margin-top:6px;flex-wrap:wrap;">
                    <div>
                      <span style="font-size:12px;color:#6b7280;">Appearance (외관)</span>
                      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                        {GRADE_LABELS.map((glabel, gvalue) => (
                          <label style="font-weight:normal;font-size:14px;color:#1a1a1a;display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input
                              type="radio"
                              name={cond.appearanceInputName}
                              value={gvalue}
                              class="grade-radio"
                              data-note-target={noteBoxId}
                              required
                              checked={currentAppearance === gvalue}
                            />
                            {glabel}
                          </label>
                        ))}
                      </div>
                      <div
                        id={noteBoxId}
                        style={`margin-top:8px;padding:8px 12px;background:#f9fafb;border-radius:6px;${showNotes ? "" : "display:none;"}`}
                      >
                        <span style="font-size:12px;color:#6b7280;">특이사항 (해당 항목 선택)</span>
                        <div style="display:flex;gap:14px;margin-top:4px;">
                          {REASON_OPTIONS.map((reason) => (
                            <label style="font-weight:normal;font-size:13px;display:flex;align-items:center;gap:4px;cursor:pointer;">
                              <input
                                type="checkbox"
                                name={cond.noteInputName}
                                value={reason}
                                checked={existingNotes.includes(reason)}
                              />
                              {reason}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <span style="font-size:12px;color:#6b7280;">Odor (냄새)</span>
                      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                        {GRADE_LABELS.map((glabel, gvalue) => (
                          <label style="font-weight:normal;font-size:14px;color:#1a1a1a;display:flex;align-items:center;gap:8px;cursor:pointer;">
                            <input
                              type="radio"
                              name={cond.odorInputName}
                              value={gvalue}
                              required
                              checked={currentOdor === gvalue}
                            />
                            {glabel}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  {cond.isC25 && (
                    <div style="display:flex;gap:8px;margin-top:8px;">
                      <div>
                        <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:2px;">pH</label>
                        <input type="text" name="ph25c" value={schedule.ph25c ?? ""} style="width:80px" />
                      </div>
                      <div>
                        <label style="font-size:12px;color:#6b7280;display:block;margin-bottom:2px;">
                          점(경)도
                        </label>
                        <input
                          type="text"
                          name="viscosity25c"
                          value={schedule.viscosity25c ?? ""}
                          style="width:80px"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <button type="submit">저장</button>
        </form>
        <script>
          {raw(`
          document.querySelectorAll('.grade-radio').forEach(function (radio) {
            radio.addEventListener('change', function () {
              var box = document.getElementById(this.getAttribute('data-note-target'));
              if (!box) return;
              box.style.display = this.value === '0' ? 'none' : 'block';
            });
          });
        `)}
        </script>
      </div>
    </Layout>
  );
});

adminRoutes.post("/ack/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody({ all: true });

  function parseGrade(raw: unknown): number | null {
    const parsed = typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3 ? parsed : null;
  }

  const values: Record<string, number | string | null> = {};
  for (const cond of CONDITIONS) {
    const appearanceGrade = parseGrade(body[cond.appearanceInputName]);
    values[cond.appearanceField] = appearanceGrade;
    values[cond.odorField] = parseGrade(body[cond.odorInputName]);

    const noteRaw = body[cond.noteInputName];
    const notes = (Array.isArray(noteRaw) ? noteRaw : noteRaw ? [noteRaw] : [])
      .map(String)
      .filter((n) => REASON_OPTIONS.includes(n));
    values[cond.noteField] =
      appearanceGrade && appearanceGrade > 0 && notes.length > 0 ? notes.join(",") : null;
  }

  const ph25c = typeof body.ph25c === "string" ? body.ph25c.trim() : "";
  const viscosity25c = typeof body.viscosity25c === "string" ? body.viscosity25c.trim() : "";

  await db
    .update(stabilitySchedules)
    .set({
      ...values,
      ph25c: ph25c || null,
      viscosity25c: viscosity25c || null,
      acknowledgedAt: Date.now(),
    })
    .where(eq(stabilitySchedules.id, id));

  return c.html(
    <Layout title="저장 완료">
      <div class="card">
        <h2>저장되었습니다</h2>
        <p>
          <a href="/admin">안정도 관리로 돌아가기</a>
        </p>
      </div>
    </Layout>
  );
});

adminRoutes.get("/snooze/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const [schedule] = await db
    .select()
    .from(stabilitySchedules)
    .where(eq(stabilitySchedules.id, id))
    .limit(1);

  if (!schedule) {
    return c.html(
      <Layout title="나중에">
        <div class="card">존재하지 않는 알람입니다.</div>
      </Layout>
    );
  }

  return c.html(
    <Layout title="나중에">
      <div class="card">
        <h2>나중에 다시 알림</h2>
        <p>
          <strong>{schedule.productName}</strong> · Lab No. {schedule.labNo} · {schedule.label} 경과
        </p>
        <p>언제 다시 알려드릴까요?</p>
        <div class="row">
          {SNOOZE_OPTIONS.map((opt) => (
            <form method="post" action={`/snooze/${id}`} class="inline">
              <input type="hidden" name="minutes" value={opt.minutes} />
              <button type="submit" class="secondary">
                {opt.label}
              </button>
            </form>
          ))}
        </div>
      </div>
    </Layout>
  );
});

adminRoutes.post("/snooze/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number(c.req.param("id"));
  const body = await c.req.parseBody();
  const allowed = new Set(SNOOZE_OPTIONS.map((o) => o.minutes));
  const minutes = Number(body.minutes);

  if (allowed.has(minutes)) {
    await db
      .update(stabilitySchedules)
      .set({ nextReminderAt: Date.now() + minutes * 60 * 1000, burstReminderCount: 0 })
      .where(eq(stabilitySchedules.id, id));
  }

  return c.html(
    <Layout title="나중에">
      <div class="card">
        <h2>알겠습니다</h2>
        <p>{minutes}분 후 다시 알려드리겠습니다.</p>
        <p>
          <a href="/admin">안정도 관리로 돌아가기</a>
        </p>
      </div>
    </Layout>
  );
});
