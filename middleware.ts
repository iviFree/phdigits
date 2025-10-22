import { NextRequest, NextResponse } from "next/server";

function arr(...xs: (string | undefined | null | false)[]) {
  return xs.filter(Boolean) as string[];
}

export function middleware(request: NextRequest) {
  // Nonce por request (alineado con Next 15)
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

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
        u.protocol === "https:"
          ? `wss://${u.host}`
          : u.protocol === "http:"
          ? `ws://${u.host}`
          : undefined;
    }
  } catch {
    // ignore parse errors
  }

  const connectSrc = arr(
    `'self'`,
    supabaseHttpOrigin, // REST
    supabaseWsOrigin,   // Realtime/WebSocket si aplica
    "https://*.vercel.app" // en caso de llamadas internas a Vercel (SWR, edge, etc.)
  ).join(" ");

  const imgSrc = arr(`'self'`, "data:", "blob:", supabaseHttpOrigin).join(" ");

  // CSP estricta con strict-dynamic + nonce
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src ${imgSrc};
    font-src 'self' https: data:;
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self';
    upgrade-insecure-requests;
  `;
  const value = csp.replace(/\s{2,}/g, " ").trim();

  // Propaga el nonce en la REQUEST para poder leerlo con next/headers en Server Components
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: reqHeaders } });

  // Aplica CSP en la RESPUESTA
  res.headers.set("Content-Security-Policy", value);

  // Expón también el nonce en la RESPUESTA (Next 15 lo detecta mejor para auto-inyectar en sus <script>)
  res.headers.set("x-nonce", nonce);

  // Endurecimiento adicional recomendado
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
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
