import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { it } from "@/lib/i18n/it";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: it.app.name, template: `%s · ${it.app.name}` },
  description: it.app.description,
  applicationName: it.app.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: it.app.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
