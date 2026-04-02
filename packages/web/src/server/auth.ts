import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { timingSafeEqual, createHmac } from "node:crypto";
import type { Config } from "./config.js";

const COOKIE_NAME = "plainfare_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${signature}`;
}

function verify(signed: string, secret: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.slice(0, lastDot);
  const expected = sign(value, secret);
  if (expected.length !== signed.length) return null;
  const a = Buffer.from(expected);
  const b = Buffer.from(signed);
  if (!timingSafeEqual(a, b)) return null;
  return value;
}

function isAuthenticated(cookie: string | undefined, config: Config): boolean {
  if (!cookie) return false;
  const value = verify(cookie, config.PLAINFARE_PASSWORD!);
  return value === config.PLAINFARE_USERNAME;
}

export function authRequired(config: Config): boolean {
  return !!(config.PLAINFARE_USERNAME && config.PLAINFARE_PASSWORD);
}

export function createAuthMiddleware(config: Config) {
  return createMiddleware(async (c, next) => {
    if (!authRequired(config)) return next();

    const cookie = getCookie(c.req.raw, COOKIE_NAME);
    if (!isAuthenticated(cookie, config)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return next();
  });
}

export function createAuthRoutes(config: Config) {
  const auth = new Hono();

  auth.get("/api/auth/status", (c) => {
    const required = authRequired(config);
    if (!required) return c.json({ authRequired: false, authenticated: true });
    const cookie = getCookie(c.req.raw, COOKIE_NAME);
    return c.json({ authRequired: true, authenticated: isAuthenticated(cookie, config) });
  });

  auth.post("/api/auth/login", async (c) => {
    if (!authRequired(config)) return c.json({ ok: true });

    const body = await c.req.json<{ username: string; password: string }>();
    const usernameMatch =
      body.username.length === config.PLAINFARE_USERNAME!.length &&
      timingSafeEqual(Buffer.from(body.username), Buffer.from(config.PLAINFARE_USERNAME!));
    const passwordMatch =
      body.password.length === config.PLAINFARE_PASSWORD!.length &&
      timingSafeEqual(Buffer.from(body.password), Buffer.from(config.PLAINFARE_PASSWORD!));

    if (!usernameMatch || !passwordMatch) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const signed = sign(config.PLAINFARE_USERNAME!, config.PLAINFARE_PASSWORD!);
    setCookie(c, COOKIE_NAME, signed, {
      httpOnly: true,
      secure: c.req.url.startsWith("https"),
      sameSite: "Lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return c.json({ ok: true });
  });

  auth.post("/api/auth/logout", (c) => {
    setCookie(c, COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
    return c.json({ ok: true });
  });

  return auth;
}

// Minimal cookie helpers to avoid extra dependencies
function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(
  c: { header: (name: string, value: string) => void },
  name: string,
  value: string,
  opts: { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string; maxAge?: number },
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  c.header("Set-Cookie", parts.join("; "));
}
