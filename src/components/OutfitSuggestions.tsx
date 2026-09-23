"use client";

import { useState } from "react";
import type { OutfitSuggestions as Data, OutfitSuggestion } from "@/lib/outfits";
import { outfitToPatch } from "@/lib/outfits";
import { formatShortDate } from "@/lib/dates";

const SLOT_ICON: Record<string, string> = { shirt: "👕", pants: "👖", shoes: "👟", socks: "🧦", hat: "🧢", jacket: "🧥" };

export function OutfitSuggestionsPanel({ data, busy, onRefresh, onWear }: { data: Data; busy: boolean; onRefresh: () => void; onWear: (patch: Record<string, string>) => void }) {
  const [open, setOpen] = useState(true);
  const w = data.weather;
  const desc = w.feelsLike != null ? `feels like ${Math.round(w.feelsLike)}°${w.sky ? ` · ${w.sky}` : ""}` : "no weather yet";
  return (
    <div className="mb-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
      <div className="flex items-center gap-2">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
          <span aria-hidden>✨</span>
          <span className="text-sm font-semibold">Outfit ideas</span>
          <span className="truncate text-xs text-ink-2">{desc}{data.similarDays ? ` · from ${data.similarDays} similar days` : ""}</span>
          <span className="ml-auto text-xs text-muted">{open ? "hide" : "show"}</span>
        </button>
        <button type="button" className="btn-ghost !py-1 text-xs" onClick={onRefresh} disabled={busy} title="Different outfits for the same weather (uses the weather currently on the form)">{busy ? "…" : "↻ New ideas"}</button>
      </div>
      {open && (
        <div className="mt-3">
          {data.note && <p className="mb-2 text-xs text-warn">{data.note}</p>}
          {data.habits.length > 0 && <p className="mb-2 text-xs text-ink-2"><span aria-hidden>📅</span> {data.weekday} habit: {data.habits.join(" · ")}</p>}
          {data.outfits.length === 0 ? (
            <p className="text-sm text-ink-2">No suggestions yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {data.outfits.map((o) => <OutfitCard key={o.title} o={o} onWear={() => onWear(outfitToPatch(o))} />)}
            </div>
          )}
          {data.examples.length > 0 && (
            <details className="mt-2 text-xs text-ink-2">
              <summary className="cursor-pointer text-muted">What you wore on the most similar days</summary>
              <ul className="mt-1 space-y-0.5">
                {data.examples.map((e) => (
                  <li key={e.date}><span className="text-muted">{formatShortDate(e.date)}{e.feelsLike != null ? ` · ${e.feelsLike}°` : ""}{e.sky ? ` ${e.sky}` : ""}:</span> {e.summary}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-2 text-[11px] text-muted">
            {`Jacket on ${Math.round(data.jacketShare * 100)}% and hat on ${Math.round(data.hatShare * 100)}% of days like this — layers are only suggested when you usually wear them; socks follow the shoes. `}
            Ranked by what you wear in this weather, favoring pieces you haven&apos;t worn lately.{data.round ? ` Round ${data.round + 1} — earlier picks set aside.` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function OutfitCard({ o, onWear }: { o: OutfitSuggestion; onWear: () => void }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-3">
      <div className="text-sm font-semibold">{o.title}</div>
      <div className="mb-2 text-xs text-muted">{o.tagline}</div>
      <ul className="flex-1 space-y-1">
        {o.pieces.map((p) => (
          <li key={p.slot} className="text-sm" title={p.why}>
            <span aria-hidden className="mr-1">{SLOT_ICON[p.slot]}</span>
            <span className="font-mono text-xs text-accent">#{p.id}</span> {p.label}
            <div className="pl-6 text-[11px] text-muted">{p.why}</div>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary mt-3 self-start !py-1 text-xs" onClick={onWear}>Wear this</button>
    </div>
  );
}
