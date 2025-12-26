import type { Metadata } from "next";

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
    <html lang="es">
      <body
        style={{
          margin: 0,
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
