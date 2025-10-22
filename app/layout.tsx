// app/layout.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import 'bootstrap/dist/css/bootstrap.min.css';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'], // puedes agregar 'latin-ext' si lo necesitas
  weight: ['400', '600', '700'], // los pesos que usarás
});


export const metadata: Metadata = {
  title: 'phdigits',
  description: 'App creada con Next.js',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
