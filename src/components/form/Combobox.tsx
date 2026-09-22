"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

interface Suggest<T> {
  items: T[];
  label: (t: T) => string;
  sub?: (t: T) => string | undefined;
  keyOf: (t: T) => string;
  onPick: (t: T) => void;
  query: string;
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
}

const MAX = 12;

function useFiltered<T>(items: T[], query: string, label: (t: T) => string, sub?: (t: T) => string | undefined) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, MAX);
    const starts: T[] = [], contains: T[] = [];
    for (const it of items) {
      const l = label(it).toLowerCase();
      const s = (sub?.(it) ?? "").toLowerCase();
      if (l.startsWith(q)) starts.push(it);
      else if (l.includes(q) || s.includes(q)) contains.push(it);
      if (starts.length >= MAX) break;
    }
    return [...starts, ...contains].slice(0, MAX);
  }, [items, query, label, sub]);
}

/** Dropdown list shared by the select / multi / closet inputs. */
function SuggestList<T>({ items, label, sub, keyOf, onPick, query, open, onClose, active, setActive }: Suggest<T> & { active: number; setActive: (n: number) => void }) {
  const filtered = useFiltered(items, query, label, sub);
  useEffect(() => { setActive(0); }, [query, setActive]);
  if (!open || filtered.length === 0) return null;
  return (
    <ul role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
      {filtered.map((it, i) => (
        <li key={keyOf(it)} role="option" aria-selected={i === active}
          onMouseDown={(e) => { e.preventDefault(); onPick(it); onClose(); }}
          onMouseEnter={() => setActive(i)}
          className={`cursor-pointer rounded-md px-2 py-1.5 text-sm ${i === active ? "bg-accent-soft text-ink" : "text-ink-2"}`}>
          <span className="text-ink">{label(it)}</span>
          {sub?.(it) && <span className="ml-2 text-xs text-muted">{sub(it)}</span>}
        </li>
      ))}
    </ul>
  );
}

function useListKeys<T>(filtered: T[], active: number, setActive: (n: number) => void, pick: (t: T) => void, close: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(active + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === "Escape") close();
    else if (e.key === "Enter" && filtered[active] !== undefined && filtered.length) { e.preventDefault(); pick(filtered[active]); close(); }
  };
}

/** Free-text input with suggestions from history. */
export function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const label = (s: string) => s;
  const filtered = useFiltered(options, value, label);
  const onKey = useListKeys(filtered, active, setActive, onChange, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <input id={id} type="text" className="control" value={value} placeholder={placeholder ?? "Type or pick…"} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
      <SuggestList items={options} label={label} keyOf={label} onPick={onChange} query={value} open={open}
        onClose={() => setOpen(false)} anchor={ref} active={active} setActive={setActive} />
    </div>
  );
}

/** Comma-separated list stored as "A, B, C" — edited as chips. */
export function MultiInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const tokens = useMemo(() => value.split(",").map((s) => s.trim()).filter(Boolean), [value]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = (s: string) => s;
  const avail = useMemo(() => options.filter((o) => !tokens.includes(o)), [options, tokens]);
  const filtered = useFiltered(avail, draft, label);

  const commit = (list: string[]) => onChange(list.join(", "));
  const add = (t: string) => { const v = t.trim(); if (!v) return; if (!tokens.includes(v)) commit([...tokens, v]); setDraft(""); };
  const removeAt = (i: number) => commit(tokens.filter((_, k) => k !== i));
  const listKeys = useListKeys(filtered, active, setActive, add, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <div className="control flex flex-wrap items-center gap-1.5 py-1.5" onClick={() => inputRef.current?.focus()}>
        {tokens.map((t, i) => (
          <span key={t + i} className="chip">
            {t}
            <button type="button" aria-label={`Remove ${t}`} className="text-muted hover:text-danger" onClick={(e) => { e.stopPropagation(); removeAt(i); }}>×</button>
          </span>
        ))}
        <input ref={inputRef} type="text" className="min-w-[8ch] flex-1 bg-transparent py-0.5 outline-none" value={draft}
          placeholder={tokens.length ? "" : placeholder ?? "Add…"} autoComplete="off"
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { setOpen(false); if (draft.trim()) add(draft); }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && !(e.key === "Enter" && filtered.length && open)) { e.preventDefault(); add(draft); return; }
            if (e.key === "Backspace" && !draft && tokens.length) { removeAt(tokens.length - 1); return; }
            listKeys(e);
          }} />
      </div>
      <SuggestList items={avail} label={label} keyOf={label} onPick={add} query={draft} open={open}
        onClose={() => setOpen(false)} anchor={ref} active={active} setActive={setActive} />
    </div>
  );
}

export interface PickItem { id: string; label: string }

/** Search-by-id-or-description picker for closet items. */
export function ItemPicker({ value, items, onPick, onClear, placeholder }: {
  value: string; items: PickItem[]; onPick: (item: PickItem) => void; onClear: () => void; placeholder?: string;
}) {
  const current = items.find((i) => i.id === value);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const label = (i: PickItem) => `#${i.id}`;
  const sub = (i: PickItem) => i.label;
  const filtered = useFiltered(items, draft, label, sub);
  const listKeys = useListKeys(filtered, active, setActive, onPick, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <div className="control flex items-center gap-2 py-0">
        {current && !open ? (
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left" onClick={() => setOpen(true)}>
            <span className="font-mono text-sm text-accent">#{current.id}</span>
            <span className="truncate text-sm">{current.label}</span>
          </button>
        ) : (
          <input type="text" className="min-w-0 flex-1 bg-transparent py-2 outline-none" value={draft} autoFocus={open && !!current}
            placeholder={placeholder ?? "Search by # or description…"} autoComplete="off" inputMode="search"
            onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setDraft(""); }} onKeyDown={listKeys} />
        )}
        {(current || value) && <button type="button" className="px-1 text-muted hover:text-danger" aria-label="Clear" onMouseDown={(e) => { e.preventDefault(); onClear(); }}>×</button>}
      </div>
      {value && !current && !open && <div className="mt-1 text-xs text-warn">#{value} isn’t in the closet sheet</div>}
      <SuggestList items={items} label={label} sub={sub} keyOf={(i) => i.id} onPick={onPick} query={draft} open={open}
        onClose={() => { setOpen(false); setDraft(""); }} anchor={ref} active={active} setActive={setActive} />
    </div>
  );
}
