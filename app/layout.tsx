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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="es" className={openSans.variable}>
      <head>
      </head>
      <body className={openSans.className}>{children}</body>
    </html>
  );
}
