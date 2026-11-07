import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_SKRIPT } from "@/components/Theme";
import { UpdateWatcher } from "@/components/UpdateWatcher";

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
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SKRIPT }} /></head>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <UpdateWatcher />
      </body>
    </html>
  );
}
