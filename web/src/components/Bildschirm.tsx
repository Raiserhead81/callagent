/** Neutrale "So sieht es aus"-Skizze eines Menues (keine Fremd-Screenshots, nur Beschriftungen). */
export function Bildschirm({ titel, pfad, zeilen }: { titel: string; pfad?: string[]; zeilen: [string, string?][] }) {
  return (
    <figure className="karte my-3 overflow-hidden text-sm" aria-label={"Bildschirm-Skizze: " + titel}>
      <div className="flex items-center gap-2 border-b border-rand bg-fl2 px-3 py-2 text-tx2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-rand" /><span className="inline-block h-2.5 w-2.5 rounded-full bg-rand" />
        <span className="ml-1 font-semibold text-tx">{titel}</span>
      </div>
      {pfad && <div className="border-b border-rand px-3 py-2 text-xs text-tx2">{pfad.join("  ›  ")}</div>}
      <dl className="divide-y divide-rand">
        {zeilen.map(([k, v], i) => (
          <div key={i} className="flex flex-wrap gap-x-3 px-3 py-2">
            <dt className="min-w-0 flex-1 text-tx2">{k}</dt>
            {v !== undefined && <dd className="mono break-all font-medium text-tx">{v}</dd>}
          </div>
        ))}
      </dl>
    </figure>
  );
}
