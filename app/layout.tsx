import type { Metadata } from "next";
import "./globals.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { Open_Sans } from "next/font/google";
import { headers } from "next/headers";
import React from "react";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Palacio · Verificación",
  description: "Panel de verificación de códigos",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next 15: headers() puede ser async
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="es" className={openSans.variable}>
      <head>
        {/* 
          Si luego necesitas CSS inline crítico:
          <style nonce={nonce}>{`:root{--brand:#000}`}</style>

          Si usas <Script> (next/script) en componentes:
          <Script id="algo" nonce={nonce}>{`console.log("ok")`}</Script>

          Next añadirá automáticamente el nonce a sus <script> internos
          cuando detecta el header x-nonce.
        */}
        {/* Evita warning de ESLint por 'nonce' sin uso visible */}
        <style nonce={nonce}>{""}</style>
      </head>
      <body className={openSans.className}>{children}</body>
    </html>
  );
}
