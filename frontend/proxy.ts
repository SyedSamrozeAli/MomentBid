import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ROLE_COOKIE, DEMO_AUTH_COOKIE, DEMO_AUTH_COOKIE_VALUE } from "./lib/authConstants";

type UserRole = "brand_owner" | "broadcaster_owner" | "admin";

function getRequiredRole(pathname: string): UserRole | null {
  if (pathname.startsWith("/brand")) {
    return "brand_owner";
  }

  if (pathname.startsWith("/broadcaster")) {
    return "broadcaster_owner";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  return null;
}

function getHomePathByRole(role: string | undefined): string {
  if (role === "brand_owner") {
    return "/brand";
  }

  if (role === "broadcaster_owner") {
    return "/broadcaster";
  }

  if (role === "admin") {
    return "/admin";
  }

  return "/";
}

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get(DEMO_AUTH_COOKIE)?.value;
  if (authCookie !== DEMO_AUTH_COOKIE_VALUE) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const requiredRole = getRequiredRole(request.nextUrl.pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  const roleCookie = request.cookies.get(AUTH_ROLE_COOKIE)?.value;
  if (roleCookie !== requiredRole) {
    return NextResponse.redirect(new URL(getHomePathByRole(roleCookie), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/brand/:path*", "/broadcaster/:path*", "/admin/:path*"],
};