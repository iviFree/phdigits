// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // 1) Generar un nonce por respuesta
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // 2) Definir la CSP (ajusta orígenes si usas externos)
  //    - 'strict-dynamic' permite que los scripts con nonce deleguen a otros scripts añadidos por el framework.
  //    - Añade dominios a script-src / connect-src / img-src si usas analytics, cdn, etc.
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
  const value = csp.replace(/\s{2,}/g, ' ').trim()

  // 3) Propagar el nonce en los headers de la request (lo leemos en app/layout.tsx)
  const reqHeaders = new Headers(request.headers)
  reqHeaders.set('x-nonce', nonce)

  // 4) Continuar la request con los headers modificados y devolver la CSP
  const res = NextResponse.next({ request: { headers: reqHeaders } })
  res.headers.set('Content-Security-Policy', value)
  return res
}

// ⚠️ No apliques la CSP a assets estáticos / prefetch (evita bloqueos innecesarios)
export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
}
