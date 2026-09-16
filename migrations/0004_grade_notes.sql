-- 등급 1~3 선택 시 추가로 고를 수 있는 특이사항(분리/변색/변취) 저장 컬럼.
ALTER TABLE stability_schedules ADD COLUMN note_4c TEXT;
ALTER TABLE stability_schedules ADD COLUMN note_25c TEXT;
ALTER TABLE stability_schedules ADD COLUMN note_37c TEXT;
ALTER TABLE stability_schedules ADD COLUMN note_45c TEXT;
ALTER TABLE stability_schedules ADD COLUMN note_sunlight TEXT;
