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
  { appearance: number; odor: number; ph?: number; hardness?: number }
> = {
  gradeC4: { appearance: 12, odor: 13 },
  gradeC25: { appearance: 14, odor: 15, ph: 16, hardness: 18 },
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
  const relevant =
    kind === "appearance"
      ? reasons.includes("분리") || reasons.includes("변색")
      : reasons.includes("변취");
  if (relevant || reasons.length === 0) return grade;
  return 0;
}

function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatSlash(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

// 셀이 템플릿의 공유 스타일 인덱스를 그대로 쓰고 있으면, style을 먼저
// 얕은 복제해서 분리해야 이 셀에만 새 스타일(테두리 등)이 적용됩니다.
// (안 그러면 같은 스타일을 공유하는 다른 셀까지 같이 바뀌어버립니다.)
function detachStyle(cell: ExcelJS.Cell) {
  cell.style = { ...cell.style };
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

  ws.getCell("A4").value = "Name";
  ws.getCell("E4").value = user.displayName || user.username;
  ws.getCell("E5").value = first.productName;
  ws.getCell("O4").value = first.labNo;

  const oneDay = byLabel.get("1일");
  if (oneDay) {
    const manufacturingDate = addDaysUTC(parseDateOnly(oneDay.targetDate), -1);
    ws.getCell("Y4").value = formatSlash(manufacturingDate);
    ws.getCell(11, INITIAL_COLUMN).value = manufacturingDate;
  }

  for (const [label, col] of Object.entries(PERIOD_COLUMNS)) {
    const row = byLabel.get(label);
    if (!row) continue;

    ws.getCell(11, col).value = parseDateOnly(row.targetDate);

    for (const [field, rows] of Object.entries(CONDITION_ROWS)) {
      const grade = row[field as keyof Schedule] as number | null;
      const note = row[NOTE_FIELD[field]] as string | null;

      const appearanceCell = ws.getCell(rows.appearance, col);
      appearanceCell.value = apOdorValue(grade, note, "appearance");

      const odorCell = ws.getCell(rows.odor, col);
      odorCell.value = apOdorValue(grade, note, "odor");

      if (field === "gradeC25") {
        if (rows.ph) ws.getCell(rows.ph, col).value = row.ph25c || null;
        if (rows.hardness) ws.getCell(rows.hardness, col).value = row.viscosity25c || null;
      }
    }
  }

  // Conclusion: 사용자가 입력한 한 줄 평 (없으면 템플릿 예시 문구를 지워 빈 칸으로)
  ws.getCell("A43").value = first.conclusion ? `   1) ${first.conclusion}` : "";
  ws.getCell("A44").value = "   2) ";
  ws.getCell("A45").value = "   3) ";

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

  return workbook.xlsx.writeBuffer();
}
