// middleware.ts
import { NextRequest, NextResponse } from "next/server";

function arr(...xs: (string | undefined | null | false)[]) {
  return xs.filter(Boolean) as string[];
}

export function middleware(request: NextRequest) {
  // Nonce por request (Edge runtime)
  const nonce = crypto.randomUUID();

  // Dominios de Supabase desde ENV
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

  let supabaseHttpOrigin: string | undefined;
  let supabaseWsOrigin: string | undefined;

  try {
    if (SUPABASE_URL) {
      const u = new URL(SUPABASE_URL);
      supabaseHttpOrigin = `${u.protocol}//${u.host}`;
      supabaseWsOrigin =
        u.protocol === "https:" ? `wss://${u.host}` :
        u.protocol === "http:"  ? `ws://${u.host}`  : undefined;
    }
  } catch {
    // ignora errores de parseo
  }

  // Fuentes de conexión permitidas (REST + Realtime + Vercel)
  const connectSrc = arr(
    `'self'`,
    supabaseHttpOrigin,
    supabaseWsOrigin,
    "https://*.vercel.app"
  ).join(" ");

  // Imágenes (self + data/blob + Supabase)
  const imgSrc = arr(`'self'`, "data:", "blob:", supabaseHttpOrigin, "https:").join(" ");

  // CSP estricta con strict-dynamic + nonce
  // Incluimos Google Fonts explícitamente.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    `img-src ${imgSrc}`,
    "font-src 'self' https://fonts.gstatic.com https: data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",            // ← anti-clickjacking estricto
    "upgrade-insecure-requests"
  ].join("; ");

  // Propaga el nonce en la REQUEST por si lo lees en Server Components
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: reqHeaders } });

  // Aplica/override de headers de seguridad
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY"); // ← fuerza DENY (no SAMEORIGIN)
  res.headers.set(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "document-domain=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
    ].join(", ")
  );

  return res;
}

// Evitar aplicar CSP a assets estáticos / prefetch
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
