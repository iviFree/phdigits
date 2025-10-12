import "bootstrap/dist/css/bootstrap.min.css";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Palacio - Acceso",
  description: "Panel seguro de verificación de códigos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <main style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
