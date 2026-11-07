"use client";
import { useEffect, useState } from "react";
/** Hell/Dunkel-Schalter: System als Standard, Wahl je Geraet in localStorage. */
export function ThemeKnopf() {
  const [t, setT] = useState<string>("system");
  useEffect(() => { try { setT(localStorage.getItem("anruf-theme") || "system"); } catch {} }, []);
  const weiter = () => {
    const n = t === "system" ? "dark" : t === "dark" ? "light" : "system";
    setT(n);
    try { n === "system" ? localStorage.removeItem("anruf-theme") : localStorage.setItem("anruf-theme", n); } catch {}
    if (n === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", n);
  };
  return <button onClick={weiter} aria-label="Farbschema wechseln" className="knopf knopf-2 !px-3 text-sm">{t === "dark" ? "Dunkel" : t === "light" ? "Hell" : "Auto"}</button>;
}
