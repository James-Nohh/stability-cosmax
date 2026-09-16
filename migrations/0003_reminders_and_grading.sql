-- 미확인 시 반복 알람(20분x3 -> 6시간마다 반복)과
-- "안정도 확인" 클릭 시 조건별 등급 입력 기능을 위한 컬럼 추가.
ALTER TABLE stability_schedules ADD COLUMN next_reminder_at INTEGER;
ALTER TABLE stability_schedules ADD COLUMN burst_reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stability_schedules ADD COLUMN acknowledged_at INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_4c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_25c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_37c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_45c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_sunlight INTEGER;
