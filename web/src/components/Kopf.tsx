import Link from "next/link";
import { ThemeKnopf } from "./Theme";
export function Kopf({ angemeldet = false }: { angemeldet?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rand bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-bold text-tx no-underline">
          <img src="/icons/icon-192.png" alt="" width={30} height={30} className="rounded-lg" />
          <span>Gemma Anrufassistent</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <Link href="/anleitung" className="hidden sm:inline px-2">Anleitung</Link>
          <Link href="/app" className="knopf !min-h-9 !py-1 text-sm">{angemeldet ? "Dashboard" : "Anmelden"}</Link>
          <ThemeKnopf />
        </nav>
      </div>
    </header>
  );
}
export function Fuss() {
  return (
    <footer className="mx-auto max-w-3xl px-4 py-8 text-sm text-tx2">
      <p>Gemma Anrufassistent ist eine Beta-App von <a href="https://gemivo.de">gemivo.de</a>. Kostenlos (Beta).</p>
      <p className="mt-1"><a href="/anleitung">Anleitung</a> · <a href="https://gemivo.de/impressum.html">Impressum</a> · <a href="https://gemivo.de/datenschutz.html">Datenschutz</a></p>
    </footer>
  );
}
