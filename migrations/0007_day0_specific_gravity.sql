-- "안정도 시작" 시점(0일)에 입력하는 Specific Gravity 값을 저장하기 위한 컬럼.
ALTER TABLE stability_schedules ADD COLUMN specific_gravity_25c TEXT;
