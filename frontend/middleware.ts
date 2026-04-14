import { NextResponse, type NextRequest } from "next/server";
import { DEMO_AUTH_COOKIE, DEMO_AUTH_COOKIE_VALUE } from "./lib/demoAuth";

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get(DEMO_AUTH_COOKIE)?.value;

  if (authCookie !== DEMO_AUTH_COOKIE_VALUE) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/brand/:path*"],
};
