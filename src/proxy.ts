import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, expectedToken } from "@/lib/auth";

export default async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken())) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/|login|_next/|manifest\\.webmanifest|icon|apple-icon|favicon\\.ico|.*\\.png$).*)"],
};
