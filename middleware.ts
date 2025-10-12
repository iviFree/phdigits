
import { NextRequest, NextResponse } from 'next/server'

function arr(...xs: (string | undefined | null | false)[]) {
  return xs.filter(Boolean) as string[]
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''

  let supabaseHttpOrigin: string | undefined
  let supabaseWsOrigin: string | undefined

  try {
    if (SUPABASE_URL) {
      const u = new URL(SUPABASE_URL) 
      supabaseHttpOrigin = `${u.protocol}//${u.host}`
      supabaseWsOrigin = u.protocol === 'https:'
        ? `wss://${u.host}`
        : u.protocol === 'http:'
        ? `ws://${u.host}`
        : undefined
    }
  } catch {
  }

  const connectSrc = arr(
    `'self'`,
    supabaseHttpOrigin,
    supabaseWsOrigin
  ).join(' ')

  const imgSrc = arr(
    `'self'`,
    'data:',
    'blob:',
    supabaseHttpOrigin
  ).join(' ')

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src ${imgSrc};
    font-src 'self';
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
  const value = csp.replace(/\s{2,}/g, ' ').trim()

  // Propaga el nonce en la request para poder leerlo en app/layout.tsx
  const reqHeaders = new Headers(request.headers)
  reqHeaders.set('x-nonce', nonce)

  const res = NextResponse.next({ request: { headers: reqHeaders } })
  res.headers.set('Content-Security-Policy', value)
  return res
}

// Evitar aplicar CSP a assets estáticos / prefetch
export const config = {
  matcher: [{
    source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
}
