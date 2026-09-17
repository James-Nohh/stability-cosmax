-- R1 엑셀 양식(회사 표준 서식) 다운로드 지원: 작성자 표시 이름, 배치별 결론 한 줄 평.
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE stability_schedules ADD COLUMN conclusion TEXT;
