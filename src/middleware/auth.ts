import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { getUserBySession } from "../lib/session";
import type { Env, Variables } from "../types";

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const db = drizzle(c.env.DB);
    const token = getCookie(c, "session");
    const user = await getUserBySession(db, token);
    if (!user) {
      const redirect = encodeURIComponent(c.req.path);
      return c.redirect(`/login?redirect=${redirect}`);
    }
    c.set("user", user);
    await next();
  }
);
