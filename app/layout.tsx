// app/layout.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'phdigits',
  description: '…',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en">
      <body>
        {children}
        {/* Si tienes scripts externos, pásales el nonce */}
        {/* <Script src="https://cdn.algo.com/script.js" strategy="afterInteractive" nonce={nonce} /> */}
      </body>
    </html>
  )
}
