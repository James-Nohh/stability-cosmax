-- 알람 시각을 고정 오전 9시가 아니라 "안정도 시작" 클릭 시각 기준으로 계산하도록 변경.
-- 기존 행은 기존 동작(오전 9시)과 동일하게 기본값을 채웁니다.
ALTER TABLE stability_schedules ADD COLUMN target_hour INTEGER NOT NULL DEFAULT 9;
ALTER TABLE stability_schedules ADD COLUMN target_minute INTEGER NOT NULL DEFAULT 0;
