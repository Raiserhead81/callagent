"use client";
import { useEffect } from "react";
/** gemivo-PWA-Standard: /VERSION pollen, bei Aenderung Caches leeren + SW-Update + Reload. */
export function UpdateWatcher() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    let aktuell = "";
    const pruefe = async () => {
      try {
        const v = (await (await fetch("/VERSION", { cache: "no-store" })).text()).trim();
        if (!aktuell) { aktuell = v; return; }
        if (v && v !== aktuell) {
          if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
          const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update();
          location.reload();
        }
      } catch {}
    };
    pruefe();
    const i = setInterval(pruefe, 60000);
    const sicht = () => { if (document.visibilityState === "visible") pruefe(); };
    document.addEventListener("visibilitychange", sicht);
    return () => { clearInterval(i); document.removeEventListener("visibilitychange", sicht); };
  }, []);
  return null;
}
