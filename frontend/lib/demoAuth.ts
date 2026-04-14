export const DEMO_AUTH_COOKIE = "momentbid_demo_auth";
export const DEMO_AUTH_COOKIE_VALUE = "1";
export const DEMO_AUTH_SESSION_KEY = "momentbid_brand_user";

const DEMO_AUTH_MAX_AGE_SECONDS = 60 * 60 * 8;

function getSecureCookieAttribute(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.protocol === "https:" ? "; Secure" : "";
}

function hasCookie(cookieName: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${cookieName}=`));
}

function setDemoAuthCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureAttribute = getSecureCookieAttribute();
  document.cookie = `${DEMO_AUTH_COOKIE}=${DEMO_AUTH_COOKIE_VALUE}; Path=/; Max-Age=${DEMO_AUTH_MAX_AGE_SECONDS}; SameSite=Strict${secureAttribute}`;
}

function clearDemoAuthCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureAttribute = getSecureCookieAttribute();
  document.cookie = `${DEMO_AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secureAttribute}`;
}

export function setDemoAuthSession(username: string): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(DEMO_AUTH_SESSION_KEY, username);
  }

  setDemoAuthCookie();
}

export function clearDemoAuthSession(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(DEMO_AUTH_SESSION_KEY);
  }

  clearDemoAuthCookie();
}

export function hasDemoAuthSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hasSessionUser = Boolean(window.sessionStorage.getItem(DEMO_AUTH_SESSION_KEY));
  const hasAuthCookie = hasCookie(DEMO_AUTH_COOKIE);
  return hasSessionUser || hasAuthCookie;
}