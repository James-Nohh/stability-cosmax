// "안정도 시작" 시 만들어지는 구간 목록 (0일 제외, 시간 순서).
//   main: 4℃/25℃/37℃/45℃/일광 확인 구간
//   cyc : 이 구간에 끝나는 Cyc 싸이클 번호 (24h = 1싸이클)
//   ft  : 시작 후 몇 번째 24시간인지 (F/T는 냉동 24h + 해동 24h = 1싸이클)
export const CHECKPOINTS: {
  label: string;
  addDays?: number;
  addMonths?: number;
  main: boolean;
  cyc?: number;
  ft?: number;
}[] = [
  { label: "1일", addDays: 1, main: true, cyc: 1, ft: 1 },
  { label: "2일", addDays: 2, main: false, cyc: 2, ft: 2 },
  { label: "3일", addDays: 3, main: false, cyc: 3, ft: 3 },
  { label: "4일", addDays: 4, main: false, ft: 4 },
  { label: "5일", addDays: 5, main: false, ft: 5 },
  { label: "6일", addDays: 6, main: false, ft: 6 },
  { label: "1주", addDays: 7, main: true },
  { label: "2주", addDays: 14, main: true },
  { label: "1개월", addMonths: 1, main: true },
  { label: "2개월", addMonths: 2, main: true },
  { label: "3개월", addMonths: 3, main: true },
];

export const FT_TOTAL_CYCLES = 3;

export const SEGMENT_ORDER = ["0일", ...CHECKPOINTS.map((cp) => cp.label)];

const SEGMENT_LABELS: Record<string, string> = {
  "0일": "0D",
  "1일": "1D",
  "2일": "2D",
  "3일": "3D",
  "4일": "4D",
  "5일": "5D",
  "6일": "6D",
  "1주": "1W",
  "2주": "2W",
  "1개월": "1M",
  "2개월": "2M",
  "3개월": "3M",
};

export function segmentLabel(label: string): string {
  return SEGMENT_LABELS[label] ?? label;
}

// 해동이 끝나는 구간(짝수 ftStep)에서만 F/T 안정도를 확인합니다.
export function ftCycleOf(ftStep: number | null): number | null {
  return ftStep != null && ftStep % 2 === 0 ? ftStep / 2 : null;
}

export function ftNoticeText(ftStep: number | null): string | null {
  if (ftStep == null) return null;
  const cycle = Math.ceil(ftStep / 2);
  if (ftStep % 2 === 1) {
    return `[F/T ${cycle}싸이클] 24시간 냉동이 끝났습니다. 해동을 시작해주세요.`;
  }
  if (cycle >= FT_TOTAL_CYCLES) {
    return `[F/T ${cycle}싸이클] 24시간 해동이 끝났습니다. F/T ${FT_TOTAL_CYCLES}싸이클이 모두 완료되었습니다.`;
  }
  return `[F/T ${cycle}싸이클] 24시간 해동이 끝났습니다. 냉동을 시작해주세요.`;
}
