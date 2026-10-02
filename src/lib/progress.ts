import type { stabilitySchedules } from "../db/schema";
import { FT_TOTAL_CYCLES, ftCycleOf, segmentLabel } from "./schedule";

type Schedule = typeof stabilitySchedules.$inferSelect;

// 진행도는 "등급을 실제로 입력했는지"로만 판단합니다. (등급이 좋은지 나쁜지는 보상과 무관 —
// 0이 많을수록 보상을 주면 문제가 있어도 0으로 적고 싶어지므로, 제때·빠짐없이 기록한 것만 칩니다.)
const MAIN_GRADE_FIELDS = [
  "gradeAppearanceC4",
  "gradeOdorC4",
  "gradeAppearanceC25",
  "gradeOdorC25",
  "gradeAppearanceC37",
  "gradeOdorC37",
  "gradeAppearanceC45",
  "gradeOdorC45",
  "gradeAppearanceSunlight",
  "gradeOdorSunlight",
] as const;

const isMainGraded = (row: Schedule) => MAIN_GRADE_FIELDS.every((f) => row[f] != null);
const isFtGraded = (row: Schedule) => row.gradeAppearanceFt != null && row.gradeOdorFt != null;
const isCycGraded = (row: Schedule) => row.gradeAppearanceCyc != null && row.gradeOdorCyc != null;

export type StepState = "done" | "due" | "future";

export type BatchProgress = {
  steps: { label: string; state: StepState }[];
  doneCount: number;
  total: number;
  ftDone: boolean;
  cycDone: boolean;
  complete: boolean;
  emoji: string;
};

export function computeProgress(items: Schedule[], todayStr: string): BatchProgress {
  const mainRows = items.filter((r) => r.mainCheck).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const steps = mainRows.map((row) => ({
    label: segmentLabel(row.label),
    state: (isMainGraded(row) ? "done" : row.targetDate <= todayStr ? "due" : "future") as StepState,
  }));
  const doneCount = steps.filter((s) => s.state === "done").length;
  const total = steps.length;

  const ftRows = items.filter((r) => ftCycleOf(r.ftStep) != null);
  const cycRows = items.filter((r) => r.cycCycle != null);
  const ftDone = ftRows.length >= FT_TOTAL_CYCLES && ftRows.every(isFtGraded);
  const cycDone = cycRows.length >= FT_TOTAL_CYCLES && cycRows.every(isCycGraded);
  const complete = total > 0 && doneCount === total && ftDone && cycDone;

  const ratio = total > 0 ? doneCount / total : 0;
  const emoji = complete ? "🏆" : ratio >= 0.7 ? "🌳" : ratio >= 0.4 ? "🌿" : "🌱";

  return { steps, doneCount, total, ftDone, cycDone, complete, emoji };
}
