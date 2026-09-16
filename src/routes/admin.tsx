import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { raw } from "hono/utils/html";
import * as XLSX from "xlsx";
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

const GRADE_LABELS = [
  "0 - 적합",
  "1 - 적합. 특이사항 있음",
  "2 - 조건부 적합. 고객사 안내 및 안정도 확인 필요",
  "3 - 부적합",
];

const CONDITIONS = [
  { field: "gradeC4", inputName: "grade4c", noteField: "noteC4", noteInputName: "note4c", label: "4℃" },
  { field: "gradeC25", inputName: "grade25c", noteField: "noteC25", noteInputName: "note25c", label: "25℃" },
  { field: "gradeC37", inputName: "grade37c", noteField: "noteC37", noteInputName: "note37c", label: "37℃" },
  { field: "gradeC45", inputName: "grade45c", noteField: "noteC45", noteInputName: "note45c", label: "45℃" },
  {
    field: "gradeSunlight",
    inputName: "gradeSunlight",
    noteField: "noteSunlight",
    noteInputName: "noteSunlight",
    label: "일광",
  },
] as const satisfies {
  field: keyof typeof stabilitySchedules.$inferSelect;
  inputName: string;
  noteField: keyof typeof stabilitySchedules.$inferSelect;
  noteInputName: string;
  label: string;
}[];

const REASON_OPTIONS = ["분리", "변색", "변취"];

function formatGrade(grade: number | null, note: string | null): string {
  if (grade == null) return "-";
  return note ? `${grade} (${note})` : String(grade);
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
              <div style="display:flex;gap:8px;">
                <a
                  href={`/admin/stability/${batchId}/export`}
                  style="background:#6b7280;color:#fff;border:none;border-radius:4px;padding:8px 12px;font-size:14px;text-decoration:none;"
                >
                  엑셀 다운로드
                </a>
                <form method="post" action={`/admin/stability/${batchId}/delete`}>
                  <button type="submit" class="danger">삭제</button>
                </form>
              </div>
            </div>
            <div class="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>구간</th>
                    <th>예정 시각(KST)</th>
                    <th>상태</th>
                    {CONDITIONS.map((cond) => (
                      <th>{cond.label}</th>
                    ))}
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
                      {CONDITIONS.map((cond) => (
                        <td>{formatGrade(item[cond.field], item[cond.noteField])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

  const order = CHECKPOINTS.map((cp) => cp.label);
  const sorted = [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

  const header = ["구간", ...CONDITIONS.map((cond) => cond.label)];
  const data = [
    header,
    ...sorted.map((row) => [
      row.label,
      ...CONDITIONS.map((cond) => {
        const grade = row[cond.field];
        if (grade == null) return "";
        const note = row[cond.noteField];
        return note ? `${grade} (${note})` : String(grade);
      }),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "안정도");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

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
            const noteBoxId = `note-${cond.inputName}`;
            const currentGrade = schedule[cond.field];
            const showNotes = currentGrade != null && currentGrade > 0;
            return (
              <div class="row">
                <div style="flex:1">
                  <label>{cond.label}</label>
                  <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
                    {GRADE_LABELS.map((glabel, gvalue) => (
                      <label style="font-weight:normal;font-size:14px;color:#1a1a1a;display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input
                          type="radio"
                          name={cond.inputName}
                          value={gvalue}
                          class="grade-radio"
                          data-note-target={noteBoxId}
                          required
                          checked={currentGrade === gvalue}
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

  const values: Record<string, number | string | null> = {};
  for (const cond of CONDITIONS) {
    const raw = body[cond.inputName];
    const parsed = typeof raw === "string" ? Number(raw) : NaN;
    const grade = Number.isInteger(parsed) && parsed >= 0 && parsed <= 3 ? parsed : null;
    values[cond.field] = grade;

    const noteRaw = body[cond.noteInputName];
    const notes = (Array.isArray(noteRaw) ? noteRaw : noteRaw ? [noteRaw] : [])
      .map(String)
      .filter((n) => REASON_OPTIONS.includes(n));
    values[cond.noteField] = grade && grade > 0 && notes.length > 0 ? notes.join(",") : null;
  }

  await db
    .update(stabilitySchedules)
    .set({ ...values, acknowledgedAt: Date.now() })
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
