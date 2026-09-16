-- "안정도 시작" 버튼 기반 1회성 알람 구조로 전환.
-- 테스트용 데이터만 있던 단계라 기존 alarm_configs/batch_logs를 정리하고 새로 만듭니다.

DROP TABLE IF EXISTS batch_logs;
DROP TABLE IF EXISTS alarm_configs;

CREATE TABLE stability_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  lab_no TEXT NOT NULL,
  target_date TEXT NOT NULL,
  label TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE batch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES stability_schedules(id),
  status TEXT NOT NULL,
  detail TEXT,
  run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
