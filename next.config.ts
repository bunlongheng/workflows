import type { NextConfig } from "next";

// Content Security Policy
// - 'unsafe-inline' on style-src is needed for Tailwind injected styles
// - 'unsafe-inline' on script-src is needed for Next.js inline bootstrap
// - img-src allows YouTube thumbnails and Anthropic assets
// - connect-src allows Supabase, Google APIs, and Anthropic API calls
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.ytimg.com https://*.googleusercontent.com https://*.youtube.com https://*.anthropic.com https://*.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.anthropic.com",
  "frame-src 'self' https://accounts.google.com https://www.youtube.com",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
