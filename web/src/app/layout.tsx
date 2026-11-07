import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { UpdateWatcher } from "@/components/UpdateWatcher";
import { AndroidBanner } from "@/components/AndroidBanner";
import { THEME_SKRIPT, INSTALL_SPERRE } from "@/lib/frueh";

export const metadata: Metadata = {
  title: "Gemma Anrufassistent – gemivo",
  description: "Gemma nimmt Anrufe unbekannter Nummern für dich an, fragt nach dem Anliegen und schickt dir eine Zusammenfassung. Android + FritzBox oder SIP-Anbieter.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Anruf", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        {/* frueh: Farbschema setzen + auf Android Chromes Web-App-Installation abfangen (head-<script> rendert Next 16 nicht) */}
        <Script id="frueh" strategy="beforeInteractive">{THEME_SKRIPT + INSTALL_SPERRE}</Script>
        <AndroidBanner />
        {children}
        <UpdateWatcher />
      </body>
    </html>
  );
}
