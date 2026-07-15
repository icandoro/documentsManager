import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocManager",
  description: "Platforma securizata pentru documente, pachete si semnare digitala."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body>
        {children}
        <Toaster position="top-right" closeButton richColors duration={4500} />
      </body>
    </html>
  );
}
