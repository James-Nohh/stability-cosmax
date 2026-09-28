-- 배치(제품)별 엑셀 다운로드 이력
CREATE TABLE export_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  user_id INTEGER,
  downloaded_at INTEGER NOT NULL
);
CREATE INDEX idx_export_logs_batch ON export_logs(batch_id);
