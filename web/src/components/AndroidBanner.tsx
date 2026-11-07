"use client";
import { useEffect, useState } from "react";
/** Android: statt Web-App-Installation Hinweis auf die echte Android-App (eine App, nicht zwei). */
export function AndroidBanner() {
  const [zeigen, setZeigen] = useState(false);
  useEffect(() => {
    if (!/Android/i.test(navigator.userAgent)) return;
    if (location.pathname.startsWith("/koppeln")) return;
    let weg = false; try { weg = localStorage.getItem("anruf-apk-banner-weg") === "1"; } catch {}
    setZeigen(!weg);
  }, []);
  if (!zeigen) return null;
  return (
    <div role="region" aria-label="Android-App" data-testid="android-banner" className="border-b border-rand bg-ak-weich">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="flex-1 min-w-[12rem]">Auf Android gehört Gemma in die <b>Android-App</b> (nur sie kann Anrufe filtern).</span>
        <a className="knopf !min-h-10 text-sm" href="/download/gemivo-anruf.apk">Hol dir die Android-App</a>
        <button className="knopf knopf-2 !min-h-10 text-sm" aria-label="Hinweis schließen" onClick={() => { setZeigen(false); try { localStorage.setItem("anruf-apk-banner-weg", "1"); } catch {} }}>✕</button>
      </div>
    </div>
  );
}
