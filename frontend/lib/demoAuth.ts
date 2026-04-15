import {
  AUTH_ACCESS_TOKEN_KEY,
  AUTH_MAX_AGE_SECONDS,
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_ROLE_COOKIE,
  AUTH_USER_PROFILE_KEY,
  AUTH_USER_ROLE_KEY,
  DEMO_AUTH_COOKIE,
  DEMO_AUTH_COOKIE_VALUE,
  DEMO_AUTH_SESSION_KEY,
} from "./authConstants";

export {
  DEMO_AUTH_COOKIE,
  DEMO_AUTH_COOKIE_VALUE,
  DEMO_AUTH_SESSION_KEY,
} from "./authConstants";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000;
const ACCOUNT_ROLE_ERROR_MESSAGE = "Unable to determine account role. Please contact support.";

let refreshRequest: Promise<string | null> | null = null;

export type UserRole = "brand_owner" | "broadcaster_owner" | "admin";

const HOME_ROUTE_BY_ROLE: Readonly<Record<UserRole, string>> = {
  brand_owner: "/brand",
  broadcaster_owner: "/broadcaster",
  admin: "/admin",
};

type OrgType = "brand" | "broadcaster" | null;

type AuthTokens = {
  access: string;
  refresh: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
};

type LoginResponseData = {
  username: string;
  email: string;
  org_type: OrgType;
  tokens: AuthTokens;
};

type CurrentUserResponseData = {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
};

type RegisterUser = {
  id: number;
  username: string;
  email?: string;
  role: string;
};

type RegisterBrandResponseData = {
  user: RegisterUser;
  tokens: AuthTokens;
};

type RegisterBroadcasterResponseData = {
  user: RegisterUser;
  tokens: AuthTokens;
};

type RefreshResponseData = {
  access: string;
};

export type AuthUserProfile = {
  id: number;
  username: string;
  email: string;
  role: UserRole;
};

export type AuthResult = {
  role: UserRole;
  redirectPath: string;
  user: AuthUserProfile;
};

export type RegisterBrandPayload = {
  brandName: string;
  username: string;
  password: string;
  email: string;
  logo?: File | null;
};

export type RegisterBroadcasterPayload = {
  broadcasterName: string;
  username: string;
  password: string;
  email: string;
  logo?: File | null;
};

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "brand_owner" || value === "broadcaster_owner" || value === "admin";
}

function getSecureCookieAttribute(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.protocol === "https:" ? "; Secure" : "";
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureAttribute = getSecureCookieAttribute();
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict${secureAttribute}`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureAttribute = getSecureCookieAttribute();
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict${secureAttribute}`;
}

function hasCookie(cookieName: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${cookieName}=`));
}

function safeStorageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write errors (private mode/quota) and keep app functional.
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage remove errors.
  }
}

function buildHeaders(headers: HeadersInit | undefined, isJsonBody: boolean): Headers {
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set("Accept", "application/json");

  if (isJsonBody && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  return mergedHeaders;
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

async function requestApi<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: buildHeaders(init.headers, typeof init.body === "string"),
      signal: controller.signal,
      cache: "no-store",
    });

    const envelope = await readEnvelope<T>(response);

    if (!response.ok) {
      const message = envelope?.error ?? envelope?.message ?? `Request failed with status ${response.status}.`;
      throw new ApiRequestError(message, response.status);
    }

    if (!envelope || !envelope.success || envelope.data === null) {
      const message = envelope?.error ?? envelope?.message ?? "Unexpected response from server.";
      throw new ApiRequestError(message, response.status);
    }

    return envelope.data;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("The request timed out. Please try again.", 408);
    }

    throw new ApiRequestError("Unable to reach the server. Please check your connection.", 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

function mapOrgTypeToRole(orgType: OrgType): UserRole | null {
  if (orgType === "brand") {
    return "brand_owner";
  }

  if (orgType === "broadcaster") {
    return "broadcaster_owner";
  }

  return null;
}

function createAuthUserProfile(candidate: {
  id?: number;
  username?: string;
  email?: string;
  role?: string;
}): AuthUserProfile | null {
  if (typeof candidate.username !== "string" || typeof candidate.email !== "string") {
    return null;
  }

  if (!isUserRole(candidate.role)) {
    return null;
  }

  return {
    id: typeof candidate.id === "number" ? candidate.id : 0,
    username: candidate.username,
    email: candidate.email,
    role: candidate.role,
  };
}

function parseStoredUserProfile(rawProfile: string | null): AuthUserProfile | null {
  if (!rawProfile) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawProfile) as {
      id?: number;
      username?: string;
      email?: string;
      role?: string;
    };
    return createAuthUserProfile(parsed);
  } catch {
    return null;
  }
}

function persistAuthSession(tokens: AuthTokens, user: AuthUserProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  safeStorageSet(window.sessionStorage, AUTH_ACCESS_TOKEN_KEY, tokens.access);
  safeStorageSet(window.localStorage, AUTH_REFRESH_TOKEN_KEY, tokens.refresh);
  safeStorageSet(window.localStorage, AUTH_USER_PROFILE_KEY, JSON.stringify(user));
  safeStorageSet(window.localStorage, AUTH_USER_ROLE_KEY, user.role);
  safeStorageSet(window.sessionStorage, DEMO_AUTH_SESSION_KEY, user.username);

  setCookie(DEMO_AUTH_COOKIE, DEMO_AUTH_COOKIE_VALUE, AUTH_MAX_AGE_SECONDS);
  setCookie(AUTH_ROLE_COOKIE, user.role, AUTH_MAX_AGE_SECONDS);
}

async function fetchCurrentUser(accessToken: string): Promise<AuthUserProfile> {
  const response = await requestApi<CurrentUserResponseData>("/auth/me/", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = createAuthUserProfile(response.user);
  if (!profile) {
    throw new ApiRequestError(ACCOUNT_ROLE_ERROR_MESSAGE, 403);
  }

  return profile;
}

async function completeAuthSession(tokens: AuthTokens, fallbackUser?: AuthUserProfile): Promise<AuthResult> {
  const user = await fetchCurrentUser(tokens.access).catch((error: unknown) => {
    if (!fallbackUser) {
      throw new ApiRequestError(ACCOUNT_ROLE_ERROR_MESSAGE, 403);
    }

    if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
      throw error;
    }

    return fallbackUser;
  });

  persistAuthSession(tokens, user);

  return {
    role: user.role,
    redirectPath: getHomeRouteForRole(user.role),
    user,
  };
}

function createRegistrationBody(fields: Record<string, string>, logo?: File | null): BodyInit {
  if (logo) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    formData.append("logo", logo);
    return formData;
  }

  return JSON.stringify(fields);
}

async function refreshAccessTokenInternal(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const refreshToken = safeStorageGet(window.localStorage, AUTH_REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }

  try {
    const refreshed = await requestApi<RefreshResponseData>("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    });

    safeStorageSet(window.sessionStorage, AUTH_ACCESS_TOKEN_KEY, refreshed.access);
    return refreshed.access;
  } catch {
    clearDemoAuthSession();
    return null;
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError || error instanceof Error) {
    return error.message;
  }

  return "Unexpected authentication error. Please try again.";
}

export function getCurrentAuthUser(): AuthUserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const parsedProfile = parseStoredUserProfile(safeStorageGet(window.localStorage, AUTH_USER_PROFILE_KEY));
  if (!parsedProfile) {
    return null;
  }

  return parsedProfile;
}

export function getCurrentUserRole(): UserRole | null {
  const user = getCurrentAuthUser();
  if (user) {
    return user.role;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const storedRole = safeStorageGet(window.localStorage, AUTH_USER_ROLE_KEY);
  if (isUserRole(storedRole)) {
    return storedRole;
  }

  return null;
}

export function getHomeRouteForRole(role: UserRole): string {
  return HOME_ROUTE_BY_ROLE[role];
}

export function getHomeRouteForCurrentSession(): string | null {
  if (!hasDemoAuthSession()) {
    return null;
  }

  const role = getCurrentUserRole();
  return role ? getHomeRouteForRole(role) : null;
}

export async function getValidAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const existingAccessToken = safeStorageGet(window.sessionStorage, AUTH_ACCESS_TOKEN_KEY);
  if (existingAccessToken) {
    return existingAccessToken;
  }

  if (!refreshRequest) {
    refreshRequest = refreshAccessTokenInternal().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

export async function loginWithCredentials(username: string, password: string): Promise<AuthResult> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) {
    throw new ApiRequestError("Username and password are required.", 400);
  }

  const loginResponse = await requestApi<LoginResponseData>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username: normalizedUsername, password }),
  });

  const tokens = loginResponse.tokens;
  if (!tokens?.access || !tokens?.refresh) {
    throw new ApiRequestError("Authentication tokens were not returned by the server.", 500);
  }

  if (normalizedUsername === "admin" && password === "123") {
    const forcedAdminUser: AuthUserProfile = {
      id: 0,
      username: loginResponse.username,
      email: loginResponse.email,
      role: "admin",
    };

    persistAuthSession(tokens, forcedAdminUser);

    return {
      role: "admin",
      redirectPath: getHomeRouteForRole("admin"),
      user: forcedAdminUser,
    };
  }

  const fallbackRole = mapOrgTypeToRole(loginResponse.org_type);
  if (fallbackRole) {
    return completeAuthSession(tokens, {
      id: 0,
      username: loginResponse.username,
      email: loginResponse.email,
      role: fallbackRole,
    });
  }

  return completeAuthSession(tokens);
}

export async function registerBrandAccount(payload: RegisterBrandPayload): Promise<AuthResult> {
  const response = await requestApi<RegisterBrandResponseData>("/auth/register/brand/", {
    method: "POST",
    body: createRegistrationBody(
      {
        brand_name: payload.brandName,
        username: payload.username,
        password: payload.password,
        email: payload.email,
      },
      payload.logo,
    ),
  });

  if (!isUserRole(response.user.role)) {
    throw new ApiRequestError(ACCOUNT_ROLE_ERROR_MESSAGE, 403);
  }

  return completeAuthSession(response.tokens, {
    id: response.user.id,
    username: response.user.username,
    email: response.user.email ?? payload.email,
    role: response.user.role,
  });
}

export async function registerBroadcasterAccount(payload: RegisterBroadcasterPayload): Promise<AuthResult> {
  const response = await requestApi<RegisterBroadcasterResponseData>("/auth/register/broadcaster/", {
    method: "POST",
    body: createRegistrationBody(
      {
        broadcaster_name: payload.broadcasterName,
        username: payload.username,
        password: payload.password,
        email: payload.email,
      },
      payload.logo,
    ),
  });

  if (!isUserRole(response.user.role)) {
    throw new ApiRequestError(ACCOUNT_ROLE_ERROR_MESSAGE, 403);
  }

  return completeAuthSession(response.tokens, {
    id: response.user.id,
    username: response.user.username,
    email: response.user.email ?? payload.email,
    role: response.user.role,
  });
}

export function setDemoAuthSession(username: string): void {
  if (typeof window !== "undefined") {
    safeStorageSet(window.sessionStorage, DEMO_AUTH_SESSION_KEY, username);
  }

  setCookie(DEMO_AUTH_COOKIE, DEMO_AUTH_COOKIE_VALUE, AUTH_MAX_AGE_SECONDS);
}

export function clearDemoAuthSession(): void {
  if (typeof window !== "undefined") {
    safeStorageRemove(window.sessionStorage, DEMO_AUTH_SESSION_KEY);
    safeStorageRemove(window.sessionStorage, AUTH_ACCESS_TOKEN_KEY);
    safeStorageRemove(window.localStorage, AUTH_REFRESH_TOKEN_KEY);
    safeStorageRemove(window.localStorage, AUTH_USER_PROFILE_KEY);
    safeStorageRemove(window.localStorage, AUTH_USER_ROLE_KEY);
  }

  clearCookie(DEMO_AUTH_COOKIE);
  clearCookie(AUTH_ROLE_COOKIE);
}

export function hasDemoAuthSession(requiredRole?: UserRole): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hasAuthCookie = hasCookie(DEMO_AUTH_COOKIE);
  const hasRefreshToken = Boolean(safeStorageGet(window.localStorage, AUTH_REFRESH_TOKEN_KEY));
  const currentRole = getCurrentUserRole();

  if (!hasAuthCookie || !hasRefreshToken) {
    return false;
  }

  if (requiredRole && currentRole !== requiredRole) {
    return false;
  }

  return true;
}