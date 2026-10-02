import type { FC, PropsWithChildren } from "hono/jsx";

// COSMAX 브랜드 톤: 검정 워드마크 · 레드 심볼(#EA1D22) · 오프화이트 배경(#F3F0ED)
// 레드는 삭제·이상 등급(경고)과 같은 계열이라, 브랜드 장식으로는 헤더 라인 정도에만 씁니다.
export const Layout: FC<PropsWithChildren<{ title: string; showNav?: boolean }>> = ({
  title,
  showNav = true,
  children,
}) => (
  <html lang="ko">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <style>{`
        * { box-sizing: border-box; }
        form { margin: 0; }
        body { font-family: Pretendard, -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f3f0ed; color: #212529; }
        h2 { font-size: 18px; font-weight: 600; margin: 0 0 14px; }
        header { background: #fff; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea1d22; }
        header .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        header .brand img { height: 30px; display: block; }
        header .brand .divider { width: 1px; height: 18px; background: #ddd6cd; }
        header .brand .service { font-size: 14px; font-weight: 600; color: #212529; }
        header nav { display: flex; align-items: center; }
        header nav a { margin-left: 16px; color: #6b665f; font-size: 14px; text-decoration: none; }
        header nav a:hover { color: #212529; }
        header nav form { margin-left: 16px; }
        main { max-width: 720px; margin: 28px auto; padding: 0 16px; }
        .card { background: #fff; border: 1px solid #e6e0d8; border-radius: 10px; padding: 24px; margin-bottom: 20px; }
        .login-logo { display: block; height: 34px; margin: 0 auto 18px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #efeae4; font-size: 14px; vertical-align: top; }
        th { background: #f7f4f1; color: #5c5750; font-weight: 600; }
        table.stability-table { table-layout: fixed; }
        table.stability-table th, table.stability-table td { padding: 6px 4px; word-break: keep-all; }
        input, button { font-family: inherit; font-size: 14px; padding: 8px; border-radius: 6px; border: 1px solid #d8d1c7; }
        input:focus { outline: none; border-color: #212529; }
        button { height: 36px; background: #111111; color: #fff; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        button:hover { opacity: 0.88; }
        button.danger { background: #fff; color: #c8161c; border: 1px solid #f0b8b9; }
        button.secondary { background: #fff; color: #3d3a36; border: 1px solid #d8d1c7; }
        a.btn-excel, .btn-edit, .btn-docs { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: 36px; padding: 0 10px; border-radius: 6px; border: none; font-size: 14px; text-decoration: none; white-space: nowrap; flex-shrink: 0; cursor: pointer; }
        a.btn-excel { background: #217346; color: #fff; }
        .btn-docs { background: #1f3a5f; color: #fff; }
        .btn-edit { background: #111111; color: #fff; }
        button.btn-photo { height: auto; padding: 2px 6px; margin-top: 4px; font-size: 11px; background: #efeae4; color: #3d3a36; border: none; }
        a.btn-two-line, button.btn-two-line { flex-direction: column; font-size: 11px; line-height: 1.25; }
        fieldset { border: 1px solid #e6e0d8; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        fieldset legend { font-weight: 600; padding: 0 6px; }
        form.inline { display: inline; }
        .row { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .row label { font-size: 13px; color: #5c5750; display: block; margin-bottom: 4px; }
        .error { color: #c8161c; font-size: 14px; margin-bottom: 12px; }
        .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
        .badge.on { background: #e3efe6; color: #1f5137; }
        .badge.off { background: #f3f0ed; color: #7a746c; }
        .scroll-x { overflow-x: auto; }
        .stability-batch-card { background: #fff; }
        .progress-strip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; padding: 6px 10px; background: #f7f4f1; border-radius: 6px; }
        .progress-emoji { font-size: 20px; line-height: 1; }
        .progress-steps { display: flex; gap: 3px; }
        .progress-step { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: #fff; color: #a39d95; border: 1px solid #e6e0d8; }
        .progress-step.done { background: #212529; color: #f3f0ed; border-color: #212529; }
        .progress-step.due { background: #fde8e8; color: #b4161b; border-color: #f6c8c9; font-weight: 600; }
        .progress-count { font-size: 12px; color: #5c5750; }
        .progress-badge { font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #fff; color: #3d3a36; border: 1px solid #e6e0d8; }
        .progress-badge.complete { background: #fff6e0; color: #8a5a00; border-color: #f2dca8; font-weight: 600; }
      `}</style>
    </head>
    <body>
      {showNav && (
        <header>
          <a href="/admin" class="brand">
            <img src="/static/cosmax-logo.png" alt="COSMAX" />
            <span class="divider"></span>
            <span class="service">안정도 관리</span>
          </a>
          <nav>
            <a href="/admin">안정도 관리</a>
            <a href="/admin/logs">실행 로그</a>
            <form class="inline" method="post" action="/logout">
              <button type="submit" class="secondary">로그아웃</button>
            </form>
          </nav>
        </header>
      )}
      <main>{children}</main>
    </body>
  </html>
);
