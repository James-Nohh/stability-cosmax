-- 배치별 축하 알림 발송 기록 (같은 축하를 두 번 보내지 않기 위함)
--   kind: 'ft' = F/T 3싸이클 완료, 'complete' = 전체 안정도 완주
CREATE TABLE batch_celebrations (
  batch_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (batch_id, kind)
);
