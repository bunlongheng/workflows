import type { NextConfig } from "next";

// Content Security Policy
// - 'unsafe-inline' on style-src is needed for Tailwind injected styles
// - 'unsafe-inline' on script-src is needed for Next.js inline bootstrap
// - img-src allows YouTube thumbnails and Anthropic assets
// - connect-src allows Google APIs and Anthropic API calls
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
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.anthropic.com",
  "frame-src 'self' https://accounts.google.com https://www.youtube.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // No upgrade-insecure-requests / HSTS: this app is served over plain HTTP
  // on the LAN + Tailscale IPs (no TLS on :3008). Those directives would force
  // asset requests to https and break rendering on any non-localhost client.
].join("; ");

const nextConfig: NextConfig = {
    devIndicators: false,
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
        ],
      },
    ];
  },
};

export default nextConfig;
