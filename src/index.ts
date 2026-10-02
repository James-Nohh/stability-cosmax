import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { runDueAlarms } from "./batch";
import cosmaxLogo from "../assets/cosmax-logo.png";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/", (c) => c.redirect("/admin"));

// 로그인 화면에서도 보여야 하므로 인증 미들웨어보다 먼저 등록합니다.
app.get("/static/cosmax-logo.png", () =>
  new Response(cosmaxLogo, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  })
);
app.route("/", authRoutes);
app.route("/", adminRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDueAlarms(env));
  },
};
