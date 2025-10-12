// app/layout.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'phdigits',
  description: 'App creada con Next.js',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Obtenemos el nonce del middleware (aunque por ahora no lo usamos)
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
