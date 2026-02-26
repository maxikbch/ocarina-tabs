import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ocarina Tabs (Prototype)",
  description: "Mini app para armar secuencias de digitación de ocarina y exportarlas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" style={{ height: "100%" }}>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          background: "#121212",
          color: "#eaeaea",
        }}
      >
        {children}
      </body>
    </html>
  );
}
