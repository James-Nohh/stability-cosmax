import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { users } from "../db/schema";
import { verifyPassword } from "../lib/password";
import { createSession, deleteSession } from "../lib/session";
import { Layout } from "../views/layout";
import type { Env, Variables } from "../types";

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

authRoutes.get("/login", (c) => {
  const error = c.req.query("error");
  return c.html(
    <Layout title="로그인" showNav={false}>
      <div class="card" style="max-width: 360px; margin: 60px auto;">
        <h2>로그인</h2>
        {error && <p class="error">아이디 또는 비밀번호가 올바르지 않습니다.</p>}
        <form method="post" action="/login">
          <div class="row">
            <div style="flex:1">
              <label>아이디</label>
              <input type="text" name="username" required style="width:100%" />
            </div>
          </div>
          <div class="row">
            <div style="flex:1">
              <label>비밀번호</label>
              <input type="password" name="password" required style="width:100%" />
            </div>
          </div>
          <button type="submit" style="width:100%">로그인</button>
        </form>
      </div>
    </Layout>
  );
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  const db = drizzle(c.env.DB);
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.redirect("/login?error=1");
  }

  const token = await createSession(db, user.id);
  setCookie(c, "session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return c.redirect("/admin");
});

authRoutes.post("/logout", async (c) => {
  const db = drizzle(c.env.DB);
  const token = getCookie(c, "session");
  await deleteSession(db, token);
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/login");
});
