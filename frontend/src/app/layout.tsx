import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocManager",
  description: "Platforma securizata pentru documente, pachete si semnare digitala."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
