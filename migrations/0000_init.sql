-- 초기 스키마. src/db/schema.ts 와 항상 일치시킬 것.
-- Node.js 설치 후에는 `npm run db:generate` 로 drizzle-kit이 이후 변경분을 자동 생성합니다.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE alarm_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  schedule_hour INTEGER NOT NULL,
  schedule_minute INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE batch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alarm_config_id INTEGER NOT NULL REFERENCES alarm_configs(id),
  status TEXT NOT NULL,
  detail TEXT,
  run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
