import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { runDueAlarms } from "./batch";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/", (c) => c.redirect("/admin"));
app.route("/", authRoutes);
app.route("/", adminRoutes);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDueAlarms(env));
  },
};
