import type { ProvenanceEntry } from "@/lib/types";

export function ProvenancePanel({ entries }: { entries: ProvenanceEntry[] }) {
  if (!entries.length) return null;

  return (
    <details className="rounded-3xl border border-line bg-card p-5">
      <summary className="cursor-pointer font-[family-name:var(--font-fraunces)] text-lg font-medium">
        Data sources
      </summary>
      <ul className="mt-4 flex flex-col gap-3 text-sm">
        {entries.map((entry) => (
          <li key={entry.label} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-none last:pb-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{entry.label}</p>
              <p className="mt-0.5">{entry.source}</p>
            </div>
            <div className="max-w-[55%] shrink-0 text-right">
              {entry.status === "connected" ? (
                <p className="text-basil">
                  {entry.detail}
                  {entry.confidence != null ? ` · ${Math.round(entry.confidence * 100)}% confidence` : ""}
                </p>
              ) : (
                <p className="text-muted">{entry.detail ?? "Not connected"}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
