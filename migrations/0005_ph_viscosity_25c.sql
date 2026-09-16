-- 25℃ 항목 전용 pH / 점(경)도 측정값 저장 컬럼.
ALTER TABLE stability_schedules ADD COLUMN ph_25c TEXT;
ALTER TABLE stability_schedules ADD COLUMN viscosity_25c TEXT;
