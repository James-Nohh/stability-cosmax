import type { FC, PropsWithChildren } from "hono/jsx";

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
      <style>{`
        * { box-sizing: border-box; }
        body { font-family: -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f5f6f8; color: #1a1a1a; }
        header { background: #1f2937; color: #fff; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
        header a { color: #fff; text-decoration: none; font-weight: 600; }
        header nav a { margin-left: 16px; color: #cbd5e1; font-size: 14px; }
        main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
        .card { background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        input, button { font-size: 14px; padding: 8px; border-radius: 4px; border: 1px solid #d1d5db; }
        button { background: #2563eb; color: #fff; border: none; cursor: pointer; }
        button.danger { background: #dc2626; }
        button.secondary { background: #6b7280; }
        a.btn-excel { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 8px 12px; border-radius: 4px; border: none; background: #217346; color: #fff; font-size: 14px; line-height: normal; text-decoration: none; }
        form.inline { display: inline; }
        .row { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .row label { font-size: 13px; color: #4b5563; display: block; margin-bottom: 4px; }
        .error { color: #dc2626; font-size: 14px; margin-bottom: 12px; }
        .badge { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
        .badge.on { background: #dcfce7; color: #166534; }
        .badge.off { background: #f3f4f6; color: #6b7280; }
        .scroll-x { overflow-x: auto; }
      `}</style>
    </head>
    <body>
      {showNav && (
        <header>
          <a href="/admin">안정도관리 알람</a>
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
