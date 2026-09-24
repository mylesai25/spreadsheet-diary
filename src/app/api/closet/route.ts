import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadCloset } from "@/lib/daily";
import { CORS, handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** GET /api/closet → the Virtual Closet pickers, separate from /api/daily so clients can hold it for a while.
 *  Browsers/phones keep it 10 minutes and revalidate with the ETag (304 when unchanged). */
export const GET = handler(async (req: NextRequest) => {
  const closet = await loadCloset();
  const etag = `"${createHash("sha1").update(JSON.stringify(closet)).digest("hex").slice(0, 16)}"`;
  const headers = { "Cache-Control": "private, max-age=600, stale-while-revalidate=3600", ETag: etag };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ...headers, ...CORS } });
  return json({ ok: true, closet }, { headers });
});
