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
const ALL_DATA_COLUMNS = [INITIAL_COLUMN, ...Object.values(PERIOD_COLUMNS)];

// 조건(4℃/25℃/37℃/45℃/일광) -> R1 시트의 행 번호 및 해당 등급이 저장된 컬럼
const CONDITION_ROWS: Record<
  string,
  {
    appearance: number;
    odor: number;
    appearanceField: keyof Schedule;
    odorField: keyof Schedule;
    noteField: keyof Schedule;
    ph?: number;
    specificGravity?: number;
    hardness?: number;
  }
> = {
  c4: { appearance: 12, odor: 13, appearanceField: "gradeAppearanceC4", odorField: "gradeOdorC4", noteField: "noteAppearanceC4" },
  c25: {
    appearance: 14,
    odor: 15,
    ph: 16,
    specificGravity: 17,
    hardness: 18,
    appearanceField: "gradeAppearanceC25",
    odorField: "gradeOdorC25",
    noteField: "noteAppearanceC25",
  },
  c37: { appearance: 19, odor: 20, appearanceField: "gradeAppearanceC37", odorField: "gradeOdorC37", noteField: "noteAppearanceC37" },
  c45: { appearance: 24, odor: 25, appearanceField: "gradeAppearanceC45", odorField: "gradeOdorC45", noteField: "noteAppearanceC45" },
  sunlight: {
    appearance: 29,
    odor: 30,
    appearanceField: "gradeAppearanceSunlight",
    odorField: "gradeOdorSunlight",
    noteField: "noteAppearanceSunlight",
  },
};

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

const NO_FILL: ExcelJS.Fill = { type: "pattern", pattern: "none" };
const GRAY_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { theme: 0, tint: -0.1499984740745262 } as unknown as ExcelJS.Color,
};
const FILL_GRADE_2: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
const FILL_GRADE_3: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC00000" } };

// note가 있으면(Appearance) 사유를 괄호로 덧붙이고, 없으면(Odor) 숫자만 표시합니다.
function setGradeCell(cell: ExcelJS.Cell, grade: number | null, note: string | null) {
  if (grade == null) {
    cell.value = null;
    return;
  }
  if (grade === 0) {
    cell.value = 0;
    return;
  }
  const reasons = (note ?? "").split(",").filter(Boolean);
  cell.value = reasons.length > 0 ? `${grade} (${reasons.join(",")})` : grade;

  if (grade === 2 || grade === 3) {
    detachStyle(cell);
    cell.fill = grade === 2 ? FILL_GRADE_2 : FILL_GRADE_3;
    if (grade === 3) cell.font = { ...cell.font, color: { argb: "FFFFFFFF" } };
  }
}

export async function buildR1Workbook(batchRows: Schedule[], user: User): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  // assets/r1-template.xlsx는 원본(여러 카테고리 시트 + 이미지가 있던, 200KB대) 파일에서
  // R1 시트만 남기고 이미지도 미리 제거해 둔 버전입니다(빌드 타임에 1회 처리).
  // Cloudflare Workers 요청마다 원본 전체를 파싱하면 CPU 한도를 넘기기 쉬워서,
  // 매 요청마다 하던 시트 정리/이미지 제거 작업을 미리 끝내 둔 파일을 사용합니다.
  await workbook.xlsx.load(r1Template as ArrayBuffer);

  const ws = workbook.getWorksheet("R1");
  if (!ws) throw new Error("R1 시트를 찾을 수 없습니다.");

  // --- 배경색 정리 (값을 쓰기 전에 먼저 처리 — 등급 2/3 빨간색이 나중에 덮어씁니다) ---

  // 4℃~Window의 Appearance/Odor 숫자 셀과 25℃ pH/Specific Gravity/Hardness는
  // 기본적으로 색 없음. (등급 2/3만 setApOdorCell에서 별도로 빨간색 적용)
  const APPEARANCE_ODOR_ROWS = [12, 13, 14, 15, 19, 20, 24, 25, 29, 30];
  for (const r of [...APPEARANCE_ODOR_ROWS, 16, 17, 18]) {
    for (const c of ALL_DATA_COLUMNS) {
      const cell = ws.getCell(r, c);
      detachStyle(cell);
      cell.fill = NO_FILL;
    }
  }
  // 25℃ Specific Gravity(17행)는 Initial 열에만 실제 값이 들어가므로,
  // 기간(1일~3개월) 열은 다시 회색으로 되돌립니다.
  for (const c of Object.values(PERIOD_COLUMNS)) {
    const cell = ws.getCell(17, c);
    detachStyle(cell);
    cell.fill = GRAY_FILL;
  }

  // 우측 끝 Remarks 열(AA:AB) 10~30행 전체 회색 음영
  for (let r = 10; r <= 30; r++) {
    for (const c of [27, 28]) {
      const cell = ws.getCell(r, c);
      detachStyle(cell);
      cell.fill = GRAY_FILL;
    }
  }

  // Z열(26) 10~30행: 굵은(medium) 검은 실선을 얇게(thin) 조정
  for (let r = 10; r <= 30; r++) {
    const cell = ws.getCell(r, 26);
    const existing = cell.border ?? {};
    detachStyle(cell);
    cell.border = {
      top: existing.top,
      bottom: existing.bottom,
      left: existing.left,
      right: { style: "thin", color: { indexed: 64 } as unknown as ExcelJS.Color },
    };
  }

  // --- 값 채우기 ---

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
      if (rows.ph) ws.getCell(rows.ph, INITIAL_COLUMN).value = dayZero.ph25c || null;
      if (rows.specificGravity) {
        ws.getCell(rows.specificGravity, INITIAL_COLUMN).value = dayZero.specificGravity25c || null;
      }
      if (rows.hardness) ws.getCell(rows.hardness, INITIAL_COLUMN).value = dayZero.viscosity25c || null;
    }
  }

  for (const [label, col] of Object.entries(PERIOD_COLUMNS)) {
    const row = byLabel.get(label);
    if (!row) continue;

    ws.getCell(11, col).value = parseDateOnly(row.targetDate);

    for (const rows of Object.values(CONDITION_ROWS)) {
      const appearanceGrade = row[rows.appearanceField] as number | null;
      const odorGrade = row[rows.odorField] as number | null;
      const note = row[rows.noteField] as string | null;

      setGradeCell(ws.getCell(rows.appearance, col), appearanceGrade, note);
      setGradeCell(ws.getCell(rows.odor, col), odorGrade, null);

      if (rows.ph) ws.getCell(rows.ph, col).value = row.ph25c || null;
      if (rows.hardness) ws.getCell(rows.hardness, col).value = row.viscosity25c || null;
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

  // 박스 가운데에 "이미지 첨부" 안내 문구
  const labelStartRow = Math.floor((TOP + BOTTOM) / 2) - 1;
  ws.mergeCells(labelStartRow, LEFT + 1, labelStartRow + 1, RIGHT - 1);
  const labelCell = ws.getCell(labelStartRow, LEFT + 1);
  detachStyle(labelCell);
  labelCell.value = "이미지 첨부";
  labelCell.alignment = { horizontal: "center", vertical: "middle" };
  labelCell.font = { ...labelCell.font, size: 14, color: { argb: "FF0000FF" } };

  // 우측 끝 Remarks 열(AA:AB) — 라벨/내용만 지우고 열 자체는 그대로 둡니다.
  for (let r = 9; r <= 34; r++) {
    ws.getCell(r, 27).value = null;
    ws.getCell(r, 28).value = null;
  }

  // 템플릿 원본 오타: 4℃ Odor 행(13)만 Initial 열 C:E 병합이 빠져 있어 숫자가
  // 가운데 정렬되지 않았습니다. Appearance 행(12)과 동일하게 병합해 맞춥니다.
  if (!ws.getCell("C13").isMerged) {
    ws.mergeCells("C13:E13");
  }

  return workbook.xlsx.writeBuffer();
}
