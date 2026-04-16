import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const backendApiOrigin = (process.env.BACKEND_API_ORIGIN ?? "http://localhost:8000").replace(/\/+$/, "");

function getOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const explicitApiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL
  ? getOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)
  : null;

const developmentConnectSources = isDevelopment
  ? [backendApiOrigin, explicitApiOrigin].filter((value): value is string => Boolean(value)).join(" ")
  : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data: https:",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' https: ws: wss:${developmentConnectSources ? ` ${developmentConnectSources}` : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendApiOrigin}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
