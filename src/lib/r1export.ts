import ExcelJS from "exceljs";
import r1Template from "../../assets/r1-template.xlsx";
import type { stabilitySchedules, users } from "../db/schema";

type Schedule = typeof stabilitySchedules.$inferSelect;
type User = typeof users.$inferSelect;

// 체크포인트 라벨 -> R1 시트의 기간별 열(1-indexed: F=6, I=9, L=12, O=15, R=18, U=21)
const PERIOD_COLUMNS: Record<string, number> = {
  "1일": 6,
  "1주": 9,
  "2주": 12,
  "1개월": 15,
  "2개월": 18,
  "3개월": 21,
};
const INITIAL_COLUMN = 3; // C

// 조건(4℃/25℃/37℃/45℃/일광) -> R1 시트의 행 번호
const CONDITION_ROWS: Record<
  string,
  { appearance: number; odor: number; ph?: number; specificGravity?: number; hardness?: number }
> = {
  gradeC4: { appearance: 12, odor: 13 },
  gradeC25: { appearance: 14, odor: 15, ph: 16, specificGravity: 17, hardness: 18 },
  gradeC37: { appearance: 19, odor: 20 },
  gradeC45: { appearance: 24, odor: 25 },
  gradeSunlight: { appearance: 29, odor: 30 },
};

const NOTE_FIELD: Record<string, keyof Schedule> = {
  gradeC4: "noteC4",
  gradeC25: "noteC25",
  gradeC37: "noteC37",
  gradeC45: "noteC45",
  gradeSunlight: "noteSunlight",
};

const REASON_APPEARANCE = ["분리", "변색"];
const REASON_ODOR = ["변취"];

// Appearance는 분리/변색, Odor는 변취와 연관지어 등급을 배분합니다.
// 특이사항을 고르지 않았으면(등급>0인데 사유 미선택) 양쪽 다 등급을 반영합니다.
function apOdorValue(
  grade: number | null,
  note: string | null,
  kind: "appearance" | "odor"
): number | null {
  if (grade == null) return null;
  if (grade === 0) return 0;
  const reasons = (note ?? "").split(",").filter(Boolean);
  const keywords = kind === "appearance" ? REASON_APPEARANCE : REASON_ODOR;
  const relevant = reasons.some((r) => keywords.includes(r));
  if (relevant || reasons.length === 0) return grade;
  return 0;
}

function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function formatSlash(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

// 셀이 템플릿의 공유 스타일 인덱스를 그대로 쓰고 있으면, style을 먼저
// 얕은 복제해서 분리해야 이 셀에만 새 스타일(테두리/배경색 등)이 적용됩니다.
// (안 그러면 같은 스타일을 공유하는 다른 셀까지 같이 바뀌어버립니다.)
function detachStyle(cell: ExcelJS.Cell) {
  cell.style = { ...cell.style };
}

const FILL_GRADE_2: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const FILL_GRADE_3: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00000" } };

function setApOdorCell(
  cell: ExcelJS.Cell,
  grade: number | null,
  note: string | null,
  kind: "appearance" | "odor"
) {
  const value = apOdorValue(grade, note, kind);
  if (value == null) {
    cell.value = null;
    return;
  }
  if (value === 0) {
    cell.value = 0;
    return;
  }
  const reasons = (note ?? "").split(",").filter(Boolean);
  const keywords = kind === "appearance" ? REASON_APPEARANCE : REASON_ODOR;
  const relevant = reasons.filter((r) => keywords.includes(r));
  cell.value = relevant.length > 0 ? `${value} (${relevant.join(",")})` : value;

  if (value === 2 || value === 3) {
    detachStyle(cell);
    cell.fill = value === 2 ? FILL_GRADE_2 : FILL_GRADE_3;
    if (value === 3) cell.font = { ...cell.font, color: { argb: "FFFFFFFF" } };
  }
}

export async function buildR1Workbook(batchRows: Schedule[], user: User): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(r1Template as ArrayBuffer);

  for (const sheet of [...workbook.worksheets]) {
    if (sheet.name !== "R1") workbook.removeWorksheet(sheet.id);
  }
  const ws = workbook.getWorksheet("R1");
  if (!ws) throw new Error("R1 시트를 찾을 수 없습니다.");

  const byLabel = new Map(batchRows.map((r) => [r.label, r]));
  const first = batchRows[0];
  const dayZero = byLabel.get("0일");

  ws.getCell("A4").value = "Name";
  ws.getCell("E4").value = user.displayName || user.username;
  ws.getCell("E5").value = first.productName;
  ws.getCell("O4").value = first.labNo;

  if (dayZero) {
    ws.getCell("Y4").value = formatSlash(parseDateOnly(dayZero.targetDate));
    ws.getCell(11, INITIAL_COLUMN).value = parseDateOnly(dayZero.targetDate);

    for (const [field, rows] of Object.entries(CONDITION_ROWS)) {
      ws.getCell(rows.appearance, INITIAL_COLUMN).value = 0;
      ws.getCell(rows.odor, INITIAL_COLUMN).value = 0;
      if (field === "gradeC25") {
        if (rows.ph) ws.getCell(rows.ph, INITIAL_COLUMN).value = dayZero.ph25c || null;
        if (rows.specificGravity) {
          ws.getCell(rows.specificGravity, INITIAL_COLUMN).value = dayZero.specificGravity25c || null;
        }
        if (rows.hardness) ws.getCell(rows.hardness, INITIAL_COLUMN).value = dayZero.viscosity25c || null;
      }
    }
  }

  for (const [label, col] of Object.entries(PERIOD_COLUMNS)) {
    const row = byLabel.get(label);
    if (!row) continue;

    ws.getCell(11, col).value = parseDateOnly(row.targetDate);

    for (const [field, rows] of Object.entries(CONDITION_ROWS)) {
      const grade = row[field as keyof Schedule] as number | null;
      const note = row[NOTE_FIELD[field]] as string | null;

      setApOdorCell(ws.getCell(rows.appearance, col), grade, note, "appearance");
      setApOdorCell(ws.getCell(rows.odor, col), grade, note, "odor");

      if (field === "gradeC25") {
        if (rows.ph) ws.getCell(rows.ph, col).value = row.ph25c || null;
        if (rows.hardness) ws.getCell(rows.hardness, col).value = row.viscosity25c || null;
      }
    }
  }

  // F/T, Cycle 구간의 예시 숫자 데이터 제거 (양식/라벨은 그대로 유지)
  const FT_CYCLE_ROWS = [33, 34];
  const FT_CYCLE_COLS = [3, 6, 9, 15, 18, 21]; // C, F, I, O, R, U
  for (const r of FT_CYCLE_ROWS) {
    for (const c of FT_CYCLE_COLS) {
      ws.getCell(r, c).value = null;
    }
  }

  // Conclusion: 2)/3) 항목은 삭제하고, 1) 자리에 사용자가 이어 쓸 수 있도록 "-->" 표시
  ws.getCell("A43").value = `--> ${first.conclusion ?? ""}`.trimEnd();
  ws.getCell("A44").value = null;
  ws.getCell("A45").value = null;

  // 우측 하단 이미지 + 캡션 삭제
  ws.getCell("S44").value = null;
  (ws as unknown as { _media: unknown[] })._media = [];

  // 이미지가 있던 자리(R36:Z43)에 점선 파란 테두리 박스만 남기기
  const blue: Partial<ExcelJS.Border> = { style: "dashed", color: { argb: "FF0000FF" } };
  const TOP = 36;
  const BOTTOM = 43;
  const LEFT = 18; // R
  const RIGHT = 26; // Z
  for (let r = TOP; r <= BOTTOM; r++) {
    for (let c = LEFT; c <= RIGHT; c++) {
      const cell = ws.getCell(r, c);
      const border: Partial<Record<keyof ExcelJS.Borders, Partial<ExcelJS.Border>>> = {};
      if (r === TOP) border.top = blue;
      if (r === BOTTOM) border.bottom = blue;
      if (c === LEFT) border.left = blue;
      if (c === RIGHT) border.right = blue;
      if (Object.keys(border).length === 0) continue;
      detachStyle(cell);
      cell.border = border;
    }
  }

  // 우측 끝 Remarks 열(AA:AB) — 라벨/내용만 지우고 열 자체는 그대로 둡니다.
  for (let r = 9; r <= 34; r++) {
    ws.getCell(r, 27).value = null;
    ws.getCell(r, 28).value = null;
  }

  // 25℃ 항목(Appearance/Odor/pH/Specific Gravity/Hardness)의 회색 음영 제거
  const NO_FILL: ExcelJS.Fill = { type: "pattern", pattern: "none" };
  const cond25Cols = [INITIAL_COLUMN, ...Object.values(PERIOD_COLUMNS)];
  for (let r = 14; r <= 18; r++) {
    for (const c of cond25Cols) {
      const cell = ws.getCell(r, c);
      detachStyle(cell);
      cell.fill = NO_FILL;
    }
  }

  // 템플릿 원본 오타: 4℃ Odor 행(13)만 Initial 열 C:E 병합이 빠져 있어 숫자가
  // 가운데 정렬되지 않았습니다. Appearance 행(12)과 동일하게 병합해 맞춥니다.
  if (!ws.getCell("C13").isMerged) {
    ws.mergeCells("C13:E13");
  }

  return workbook.xlsx.writeBuffer();
}
