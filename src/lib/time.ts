const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nowKst(): { hour: number; minute: number; dateStr: string } {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return {
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    dateStr: kst.toISOString().slice(0, 10), // YYYY-MM-DD
  };
}

// 오늘(KST) 날짜만 담은 Date. UTC 필드에 KST 달력 날짜를 그대로 담아
// 월/일 연산 중 시간대 문제가 끼어들지 않게 합니다.
export function kstTodayDateOnly(): Date {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function formatDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}
