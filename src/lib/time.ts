const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nowKst(): { hour: number; minute: number; dateStr: string } {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return {
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    dateStr: kst.toISOString().slice(0, 10), // YYYY-MM-DD
  };
}
