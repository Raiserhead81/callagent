"use client";
import { useEffect, useState } from "react";
import { api, fehlerText } from "@/lib/client";
/** Kopplungscode fuer die Android-App. Mit ?app=1 springt die Seite direkt per Deep-Link zurueck in die App. */
export function Koppeln() {
  const [c, setC] = useState<{ code: string; deeplink: string } | null>(null); const [f, setF] = useState("");
  useEffect(() => {
    api("/api/koppeln", { method: "POST" }).then(r => {
      if (!r.ok) return setF(fehlerText(r.fehler));
      setC(r as any);
      if (new URLSearchParams(location.search).get("app") === "1") location.href = (r as any).deeplink;
    });
  }, []);
  return (
    <main className="mx-auto max-w-md px-4 py-8 text-center">
      <h1 className="text-xl font-bold">Android-App koppeln</h1>
      {f && <p className="mt-3 text-fehl">{f}</p>}
      {c && <>
        <p className="mt-3 text-tx2">In der App „Code eingeben“ wählen:</p>
        <p className="mono mt-3 text-4xl font-bold tracking-widest" data-testid="code">{c.code}</p>
        <p className="mt-2 text-sm text-tx2">10 Minuten gültig, nur einmal verwendbar.</p>
        <a className="knopf mt-5" href={c.deeplink}>In der App öffnen</a>
      </>}
    </main>
  );
}
