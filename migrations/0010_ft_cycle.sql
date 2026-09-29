-- F/T(냉동 24h + 해동 24h = 1싸이클, 3싸이클)와 Cyc(24h = 1싸이클, 3싸이클) 조건 추가.
-- 시작 시점부터 24시간 단위 구간(1일~6일)에 알람을 합쳐서 보냅니다.
--   main_check: 4℃/25℃/37℃/45℃/일광 확인 구간 여부 (0일/1일/1주/2주/1개월/2개월/3개월)
--   cyc_cycle : 이 구간에 끝나는 Cyc 싸이클 번호 (1일=1, 2일=2, 3일=3)
--   ft_step   : 시작 후 몇 번째 24시간인지 (1~6). 홀수=냉동 종료, 짝수=해동 종료(싸이클 ft_step/2 완료, 안정도 확인)
ALTER TABLE stability_schedules ADD COLUMN main_check INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stability_schedules ADD COLUMN cyc_cycle INTEGER;
ALTER TABLE stability_schedules ADD COLUMN ft_step INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_appearance_ft INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_ft INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_ft TEXT;
ALTER TABLE stability_schedules ADD COLUMN grade_appearance_cyc INTEGER;
ALTER TABLE stability_schedules ADD COLUMN grade_odor_cyc INTEGER;
ALTER TABLE stability_schedules ADD COLUMN note_appearance_cyc TEXT;

-- 기존 배치: 1일 구간은 Cyc 1싸이클 종료 + F/T 첫 냉동 종료와 겹치므로 알람을 합칩니다.
UPDATE stability_schedules SET cyc_cycle = 1, ft_step = 1 WHERE label = '1일';

-- 기존 배치에 2일~6일 구간을 추가합니다. 이미 지난 시각의 구간은 알람 폭탄을 막기 위해
-- 발송 완료(sent=1)로 넣어 알람 없이 화면에만 나타나게 합니다.
-- (1) 0일 행이 있는 배치: 0일 시각 기준
INSERT INTO stability_schedules
  (batch_id, product_name, lab_no, target_date, target_hour, target_minute, label, sent,
   main_check, cyc_cycle, ft_step, conclusion)
SELECT z.batch_id, z.product_name, z.lab_no,
  date(z.target_date, '+' || d.n || ' days'), z.target_hour, z.target_minute, d.n || '일',
  CASE WHEN date(z.target_date, '+' || d.n || ' days') || ' ' || printf('%02d:%02d', z.target_hour, z.target_minute)
            <= strftime('%Y-%m-%d %H:%M', 'now', '+9 hours') THEN 1 ELSE 0 END,
  0, CASE WHEN d.n <= 3 THEN d.n END, d.n, z.conclusion
FROM stability_schedules z
JOIN (SELECT 2 AS n UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
WHERE z.label = '0일';

-- (2) 0일 행이 없는 옛 배치: 1주 예정일 - 7일을 시작일로 봅니다.
INSERT INTO stability_schedules
  (batch_id, product_name, lab_no, target_date, target_hour, target_minute, label, sent,
   main_check, cyc_cycle, ft_step, conclusion)
SELECT w.batch_id, w.product_name, w.lab_no,
  date(w.target_date, '-7 days', '+' || d.n || ' days'), w.target_hour, w.target_minute, d.n || '일',
  CASE WHEN date(w.target_date, '-7 days', '+' || d.n || ' days') || ' ' || printf('%02d:%02d', w.target_hour, w.target_minute)
            <= strftime('%Y-%m-%d %H:%M', 'now', '+9 hours') THEN 1 ELSE 0 END,
  0, CASE WHEN d.n <= 3 THEN d.n END, d.n, w.conclusion
FROM stability_schedules w
JOIN (SELECT 2 AS n UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) d
WHERE w.label = '1주'
  AND NOT EXISTS (SELECT 1 FROM stability_schedules x WHERE x.batch_id = w.batch_id AND x.label = '0일');
