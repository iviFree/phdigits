// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";


const cspProd = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const cspDev = [
  "default-src 'self'",
  // dev server de Next/Turbopack necesita inline/eval/blob
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // HMR, RSC y dev overlay usan websockets y http local
  "connect-src 'self' https://*.supabase.co ws: http://localhost:* http://127.0.0.1:* http://0.0.0.0:*",
  "font-src 'self' data:",
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
};

export default nextConfig;
