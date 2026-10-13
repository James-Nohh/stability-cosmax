# 안정도 관리 시스템 — 작업 지침

COSMAX 제형 연구원용 안정도 시험 알람·기록 웹입니다 (Cloudflare Workers + Hono + D1, Teams 알람).
기능·데이터 구조·남은 문제·작업 이력은 [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)에 정리돼 있으니 작업 전에 먼저 읽으세요.
`README.md`는 초기 버전이라 현재 기능과 다릅니다.

## 사용자와 소통

- 한국어로 답하고, 개발 용어는 풀어서 설명합니다. 사용자는 제형 연구 쪽 담당자이며 결과 위주로 확인합니다.
- "어떻게 하면 좋을까?" 같은 질문에는 바로 구현하지 말고 추천안과 장단점을 먼저 제시합니다.
- 화면 디자인을 바꿀 때는 적용 전에 시안을 먼저 보여주는 것을 선호합니다.
- 검증하지 못한 부분(실제 화면, Teams 실제 수신 등)은 못 했다고 분명히 알립니다.

## 작업 순서

변경을 요청받으면 아래까지 한 번에 진행합니다 (사용자가 정한 방식).

1. 코드 수정
2. `npm run typecheck`
3. 필요하면 로컬 검증 (아래 "테스트 방법")
4. `npx wrangler deploy`
5. 커밋 후 `git push origin main` — 커밋 메시지는 영어 요약 한 줄 + 왜 바꿨는지 본문

DB 구조를 바꿀 때는 `migrations/`에 다음 번호 SQL 파일을 추가하고
`npx wrangler d1 migrations apply stability-admin-db --local` → `--remote` 순서로 반영한 뒤 배포합니다.
운영 데이터를 지우거나 바꾸는 작업, 유료 요금제 전환 같은 결정은 먼저 물어봅니다.

## 테스트 방법

- **로컬**: `npx wrangler dev --local --port <포트>`로 띄우고 `curl`로 확인합니다.
  로그인이 필요한 화면은 **로컬 DB에만** 테스트 계정과 세션 행을 넣고 `Cookie: session=<토큰>` 헤더로 접근합니다.
  운영 DB에 세션을 직접 넣어 로그인을 우회하지 않습니다. 운영 로그인 비밀번호는 모르는 것이 정상이며, 로그인 후 화면 확인은 사용자가 합니다.
- **알람(운영)**: 실제 배치를 건드리지 말고 `batch_id`가 다른 임시 행을 만들어 `target_date`를 오늘, 시각을 0시로 넣으면 다음 cron(매분)에 발송됩니다.
  `batch_logs`에서 `success`를 확인하고, 반복 알람이 계속 가지 않도록 `next_reminder_at = NULL`로 바꾼 뒤 끝나면 임시 행을 지웁니다.
- 로컬 개발 환경은 Teams 웹훅 시크릿이 없고 CPU 제한도 재현하지 않습니다. 로컬 통과가 운영 통과를 보장하지 않습니다.

## 이 PC(Windows, Git Bash)에서의 주의점

- `curl`은 `--ssl-no-revoke`를 붙여야 운영 주소에 접속됩니다.
- `curl`에 한글을 직접 넣으면 깨질 수 있으니 `encodeURIComponent`로 미리 변환해서 `--data-raw`로 보냅니다.
- `wrangler d1 execute --command`는 SQL을 한 줄로 씁니다. 가끔 `7403` 오류가 나면 그대로 다시 실행하면 됩니다.
- 로컬 dev 서버는 PowerShell로 `workerd`와 `wrangler dev` 프로세스를 종료해야 완전히 내려갑니다.

## 코드 주의점

- ExcelJS: 테두리·배경을 바꾸기 전에 `cell.style = { ...cell.style }`로 스타일을 분리합니다. 병합은 테두리보다 먼저 합니다. `spliceColumns`는 쓰지 않습니다.
- Hono JSX의 `<script>` 내용은 `raw()`(`hono/utils/html`)로 감쌉니다.
- 등급 파싱은 빈 문자열을 먼저 걸러냅니다 (`Number('')`는 0).
- 수정 저장은 폼에 실제로 들어온 칸만 갱신합니다.
- D1은 쿼리당 바인딩 값 100개 제한이 있어 여러 행 삽입은 `db.batch`로 나눕니다.
- 배치 삭제는 `batch_logs` → `stability_schedules` 순서로 지웁니다.
- 한 구간(행)에 무엇을 확인하는지는 `mainCheck` / `cycCycle` / `ftStep`으로 정해지며, 규칙은 `src/lib/schedule.ts`에 있습니다.

## 설계 원칙

- 재미 요소의 보상은 "제때·빠짐없이 기록"에만 줍니다. 등급이 좋다고 보상하지 않습니다.
- 브랜드 레드(#EA1D22)는 삭제·이상 등급 경고와 같은 계열이므로 장식으로는 헤더 라인 정도에만 씁니다.
- 시크릿 값(`SESSION_SECRET`, `TEAMS_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL_DM`)은 코드나 문서에 적지 않습니다.

## 알려진 제약

- 운영에서 엑셀 다운로드가 "Worker exceeded resource limits"로 실패합니다. Cloudflare 무료 요금제의 CPU 10ms 제한 때문이며 사용자가 보류한 상태입니다.
- 계정이 `admin` 하나라 누가 확인했는지 구분할 수 없습니다.
