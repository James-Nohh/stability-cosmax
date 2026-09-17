-- Appearance(외관: 분리/변색)와 Odor(변취)를 각각 별도로 등급 입력받도록 분리.
-- Odor는 사유 없이 숫자 등급만 기록합니다.
ALTER TABLE stability_schedules ADD COLUMN grade_appearance_4c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_4c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_4c TEXT;

ALTER TABLE stability_schedules ADD COLUMN grade_appearance_25c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_25c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_25c TEXT;

ALTER TABLE stability_schedules ADD COLUMN grade_appearance_37c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_37c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_37c TEXT;

ALTER TABLE stability_schedules ADD COLUMN grade_appearance_45c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_45c INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_45c TEXT;

ALTER TABLE stability_schedules ADD COLUMN grade_appearance_sunlight INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_sunlight INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_sunlight TEXT;

ALTER TABLE stability_schedules DROP COLUMN grade_4c;
ALTER TABLE stability_schedules DROP COLUMN grade_25c;
ALTER TABLE stability_schedules DROP COLUMN grade_37c;
ALTER TABLE stability_schedules DROP COLUMN grade_45c;
ALTER TABLE stability_schedules DROP COLUMN grade_sunlight;
ALTER TABLE stability_schedules DROP COLUMN note_4c;
ALTER TABLE stability_schedules DROP COLUMN note_25c;
ALTER TABLE stability_schedules DROP COLUMN note_37c;
ALTER TABLE stability_schedules DROP COLUMN note_45c;
ALTER TABLE stability_schedules DROP COLUMN note_sunlight;
