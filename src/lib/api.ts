import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, expectedToken } from "./auth";

/** Helpers for the JSON API used by the Flutter client. */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(data: unknown, init: number | ResponseInit = 200) {
  const res = NextResponse.json(data, typeof init === "number" ? { status: init } : init);
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export function error(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

export function options() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** API auth: `Authorization: Bearer <APP_PASSWORD>` or the browser session cookie. Open when APP_PASSWORD is unset. */
export async function authorized(req: NextRequest): Promise<boolean> {
  if (!authEnabled()) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && bearer === process.env.APP_PASSWORD) return true;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  return Boolean(cookie && cookie === (await expectedToken()));
}

/** Wrap a handler with auth + error handling. */
export function handler<T extends { params?: Promise<Record<string, string>> }>(
  fn: (req: NextRequest, ctx: T) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: T) => {
    if (!(await authorized(req))) return error("Unauthorized", 401);
    try {
      return await fn(req, ctx);
    } catch (e) {
      return error(e instanceof Error ? e.message : String(e), 500);
    }
  };
}
