import type { Metadata, Viewport } from "next";
import "./globals.css";
import { productName, productTagline } from "@/lib/product";

export const metadata: Metadata = {
  title: { default: `${productName} — AI 3D filmmaking`, template: `%s · ${productName}` },
  description: productTagline,
  applicationName: productName,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-studio-950 font-sans">{children}</body>
    </html>
  );
}
