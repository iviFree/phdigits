// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Producción: incluye Google Fonts (CSS y fuentes), cierra HIGH sin romper estilos.
const cspProd = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in",
  "font-src 'self' https://fonts.gstatic.com data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

// Desarrollo: permisos extra para HMR/overlays + Google Fonts.
const cspDev = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in ws: http://localhost:* http://127.0.0.1:* http://0.0.0.0:*",
  "font-src 'self' https://fonts.gstatic.com data:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    reactRemoveProperties: true,
    removeConsole: process.env.NODE_ENV === "production",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: isProd ? cspProd : cspDev },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
