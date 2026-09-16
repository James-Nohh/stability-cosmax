# 안정도관리 알람 시스템

Cloudflare Workers + Hono + D1 + 일자별 배치 알람(Teams) 기반 관리 웹사이트.

## 기술 스택

- **런타임**: Cloudflare Workers
- **웹 프레임워크**: Hono (JSX 서버 렌더링)
- **DB**: Cloudflare D1 (SQLite) + Drizzle ORM
- **인증**: 자체 세션(쿠키) + PBKDF2 비밀번호 해싱
- **배치**: Cloudflare Cron Trigger (5분 간격, DB에 저장된 시각과 일치하는 알람만 발송)
- **알람**: Microsoft Teams (Power Automate "웹훅 요청을 받으면 채널에 게시" 워크플로)

## 최초 설정 절차

### 0. 사전 준비

- Node.js LTS 설치 (이 컴퓨터에는 아직 설치되어 있지 않음)
- Cloudflare 계정, `wrangler login`

### 1. 패키지 설치

```bash
npm install
```

### 2. D1 데이터베이스 생성

```bash
npx wrangler d1 create stability-admin-db
```

출력된 `database_id`를 [wrangler.toml](wrangler.toml)의 `REPLACE_WITH_D1_DATABASE_ID`에 채워 넣습니다.

### 3. 스키마 적용

```bash
# 로컬 개발용
npm run db:migrate:local
# 실제 배포용
npm run db:migrate:remote
```

### 4. 시크릿 등록 (절대 코드/git에 값 직접 기록 금지)

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put TEAMS_WEBHOOK_URL
```

- `SESSION_SECRET`: 임의의 긴 랜덤 문자열
- `TEAMS_WEBHOOK_URL`: Teams 채널 → Workflows 앱 → "웹훅 요청을 받으면 채널에 게시" 템플릿으로 생성한 URL

### 5. 관리자 계정 생성

```bash
node scripts/hash-password.mjs admin '원하는비밀번호'
```

출력되는 `wrangler d1 execute` 명령을 그대로 실행하면 로그인 가능한 계정이 생성됩니다.

### 6. 로컬 실행

```bash
npm run dev
```

### 7. 배포

**옵션 A — Cloudflare Workers Builds (권장, git push만으로 무중단 자동배포)**

1. 이 프로젝트를 GitHub 저장소로 push
2. Cloudflare 대시보드 → Workers & Pages → "Import a repository" 로 연결
3. 이후 `main` 브랜치 push마다 자동 빌드/배포

**옵션 B — 수동 배포**

```bash
npm run deploy
```

## 안정도 알람 사용법

1. `/admin`에서 로그인 후 제품명 / Lab No.를 입력하고 "안정도 시작" 클릭
2. 오늘 기준 1일 / 1주 / 2주 / 1개월 / 2개월 / 3개월 후 오전 9시(KST)에 발송될 6건의 알람이 자동 예약됨
3. Cron Trigger가 5분마다 깨어나 예정일이 지난 미발송 건을 찾아 Teams로 전송 (제목: 제품명, 내용: Lab No. + "안정도를 확인하세요")
4. `/admin/logs`에서 발송 성공/실패 이력 확인

## 디렉토리 구조

```
src/
  index.ts          앱 엔트리 (fetch + scheduled 핸들러)
  batch.ts          일자별 배치 알람 실행 로직
  types.ts          Env/Variables 타입
  db/schema.ts       Drizzle 스키마 (users, sessions, stability_schedules, batch_logs)
  lib/
    password.ts       PBKDF2 해싱/검증
    session.ts        세션 생성/조회/삭제
    teams.ts           Teams Adaptive Card 발송
    time.ts             KST 시각 계산
  middleware/auth.ts    로그인 필요 라우트 가드
  routes/
    auth.tsx            로그인/로그아웃
    admin.tsx            안정도 시작/조회, 로그 조회
  views/layout.tsx     공통 레이아웃
scripts/hash-password.mjs   관리자 계정 생성용 로컬 스크립트
migrations/                  D1 스키마 마이그레이션
```
