// Appearance(외관) 특이사항 선택지. "기타"는 체크박스 옆에 자유 텍스트를 함께 받습니다.
export const APPEARANCE_REASON_OPTIONS = ["분리", "변색", "탁도"];
export const ETC_REASON = "기타";

// note_appearance_* 컬럼은 "분리,탁도,기타:내용물에 이물질" 처럼 콤마로 구분해 저장합니다.
export function parseReasonNote(note: string | null): {
  checked: string[];
  etcChecked: boolean;
  etcText: string;
} {
  const parts = (note ?? "").split(",").filter(Boolean);
  const checked: string[] = [];
  let etcChecked = false;
  let etcText = "";
  for (const part of parts) {
    if (part === ETC_REASON) {
      etcChecked = true;
    } else if (part.startsWith(`${ETC_REASON}:`)) {
      etcChecked = true;
      etcText = part.slice(ETC_REASON.length + 1);
    } else {
      checked.push(part);
    }
  }
  return { checked, etcChecked, etcText };
}

export function buildReasonNote(checked: string[], etcChecked: boolean, etcText: string): string | null {
  const parts = checked.filter((r) => APPEARANCE_REASON_OPTIONS.includes(r));
  if (etcChecked) {
    const trimmed = etcText.trim();
    parts.push(trimmed ? `${ETC_REASON}:${trimmed}` : ETC_REASON);
  }
  return parts.length > 0 ? parts.join(",") : null;
}

// 화면/엑셀에 보여줄 때는 "기타:내용"을 "기타(내용)"으로 풀어서 보여줍니다.
export function formatReasonNote(note: string | null): string | null {
  if (!note) return null;
  return note
    .split(",")
    .filter(Boolean)
    .map((part) => (part.startsWith(`${ETC_REASON}:`) ? `${ETC_REASON}(${part.slice(ETC_REASON.length + 1)})` : part))
    .join(", ");
}
