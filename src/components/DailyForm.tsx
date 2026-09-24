"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { DailyPageData } from "@/lib/daily";
import { DAILY_SECTIONS } from "@/lib/schema/daily";
import { isGroup, type Field } from "@/lib/schema/types";
import { outfitsAction, saveDailyAction, weatherAction } from "@/app/log/actions";
import { OutfitSuggestionsPanel } from "./OutfitSuggestions";
import type { OutfitSuggestions } from "@/lib/outfits";
import type { ClosetItems } from "@/lib/schema/closet";
import { FieldRow, Toggle, Rating, NumberField, TimeField, TextField, TextArea } from "./form/Fields";
import { SelectInput, MultiInput, ItemPicker } from "./form/Combobox";

type Values = Record<string, string>;

function initialValues(data: DailyPageData): Values {
  const v: Values = { ...data.values };
  if (!data.isLogged) for (const [k, d] of Object.entries(data.defaults)) if (!v[k]) v[k] = d;
  return v;
}

function hoursBetween(bed: string, wake: string): string {
  const [bh, bm] = bed.split(":").map(Number), [wh, wm] = wake.split(":").map(Number);
  if ([bh, bm, wh, wm].some((n) => Number.isNaN(n))) return "";
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 1440;
  return String(Math.round(mins / 30) / 2);
}

export function DailyForm({ data }: { data: DailyPageData }) {
  const [values, setValues] = useState<Values>(() => initialValues(data));
  const [saved, setSaved] = useState<Values>(data.values);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState(DAILY_SECTIONS[0].id);
  const [weatherNote, setWeatherNote] = useState<string | null>(data.weatherNote);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [outfits, setOutfits] = useState<OutfitSuggestions>(data.outfits);
  const [outfitsBusy, setOutfitsBusy] = useState(false);
  const [closet, setCloset] = useState<ClosetItems | null>(data.closet);

  // The page ships without the ~100 KB closet; fetch it here (the browser caches /api/closet for 10 minutes).
  useEffect(() => {
    if (closet) return;
    let cancelled = false;
    fetch("/api/closet").then((r) => (r.ok ? r.json() : null)).then((j) => { if (!cancelled && j?.closet) setCloset(j.closet as ClosetItems); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seenRef = useRef<string[]>(data.outfits.shownKeys ?? []);
  const roundRef = useRef(0);

  /** New ideas: same weather, but pieces already shown are pushed down and the ranking is reshuffled. */
  const refreshOutfits = async (v: Values = values, { fresh = true }: { fresh?: boolean } = {}) => {
    setOutfitsBusy(true);
    const n = (x: string) => (x === "" || Number.isNaN(Number(x)) ? null : Number(x));
    if (!fresh) { seenRef.current = []; roundRef.current = 0; } else roundRef.current += 1;
    const res = await outfitsAction(data.date, { feelsLike: n(v["Feels Like (F)"] ?? ""), high: n(v["High Temperature (F)"] ?? ""), sky: v["Sky"] ?? "" }, { seen: seenRef.current, seed: roundRef.current });
    setOutfitsBusy(false);
    if (res.ok && res.data) {
      setOutfits(res.data);
      seenRef.current = [...new Set([...seenRef.current, ...res.data.shownKeys])].slice(-60);
    }
  };

  const getWeather = async () => {
    setWeatherBusy(true);
    const res = await weatherAction(data.date, values["Wake Up City"] ?? "", values["Wake Up State"] ?? "", values["Wake Up Country"] ?? "", values["Wake Up Time"] ?? "");
    setWeatherBusy(false);
    if (res.ok && res.values) { setMany(res.values); setWeatherNote(`Weather for ${res.place} from Open-Meteo`); refreshOutfits({ ...values, ...res.values }, { fresh: false }); }
    else setWeatherNote(res.error ?? "Weather unavailable");
  };

  const changes = useMemo(() => {
    const out: Values = {};
    for (const [k, v] of Object.entries(values)) if ((saved[k] ?? "") !== (v ?? "")) out[k] = v ?? "";
    return out;
  }, [values, saved]);
  const dirty = Object.keys(changes).length;

  const set = useCallback((key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      // Derived fields — only nudge when the driver changes.
      if (key === "Bedtime" || key === "Wake Up Time") {
        const h = hoursBetween(next["Bedtime"] ?? "", next["Wake Up Time"] ?? "");
        if (h) next["Hours slept"] = h;
      }
      if (key === "Jacket?") next["Clothes Layers"] = val === "TRUE" ? "2" : "1";
      if (key === "Cardio?" && val === "FALSE") next["Cardio Duration (minutes)"] = "0";
      if (key === "Lifting?" && val === "FALSE") next["Lifting Duration (minutes)"] = "0";
      if (key === "Alcohol?" && val === "FALSE") next["# of Drinks"] = "0";
      if (key === "Naps taken" && val === "0") next["Nap Duration (hours)"] = "0";
      return next;
    });
  }, []);

  const setMany = useCallback((patch: Values) => setValues((prev) => ({ ...prev, ...patch })), []);

  const copyPrev = (keys: string[]) => {
    const patch: Values = {};
    for (const k of keys) patch[k] = data.prev[k] ?? "";
    setMany(patch);
  };

  const save = () => {
    if (!dirty) return;
    start(async () => {
      const res = await saveDailyAction(data.date, changes);
      if (res.ok) {
        setSaved((s) => ({ ...s, ...changes }));
        setToast({ kind: "ok", text: `Saved ${res.saved} field${res.saved === 1 ? "" : "s"}` });
      } else setToast({ kind: "err", text: res.error ?? "Save failed" });
      setTimeout(() => setToast(null), 3500);
    });
  };

  // The server renders instant history-based picks; when Claude is configured, ask it for its ideas right away.
  useEffect(() => {
    if (!data.outfits.claudeAvailable || data.outfits.engine === "claude" || !data.outfits.outfits.length) return;
    const t = setTimeout(() => refreshOutfits(values, { fresh: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.date]);

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Highlight the section in view.
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActiveSection((vis[0].target as HTMLElement).dataset.section!);
    }, { rootMargin: "-120px 0px -60% 0px", threshold: 0 });
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const visible = (f: Field) => !f.showIf || (values[f.showIf.key] ?? "") === f.showIf.equals;

  const renderField = (f: Field) => {
    if (!visible(f)) return null;
    const v = values[f.key] ?? "";
    const label = f.label ?? f.key;
    const changed = (saved[f.key] ?? "") !== v;
    const labelEl = changed ? `${label} •` : label;
    switch (f.type) {
      case "bool": return <FieldRow key={f.key} label={labelEl}><Toggle value={v} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "rating": return <FieldRow key={f.key} label={labelEl} wide><Rating value={v} min={f.min} max={f.max} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "number": return <FieldRow key={f.key} label={labelEl} hint={f.hint}><NumberField value={v} min={f.min} max={f.max} step={f.step} unit={f.unit} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "time": return <FieldRow key={f.key} label={labelEl}><TimeField value={v} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "textarea": return <FieldRow key={f.key} label={labelEl} wide><TextArea value={v} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "text": return <FieldRow key={f.key} label={labelEl}><TextField value={v} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "select": return <FieldRow key={f.key} label={labelEl}><SelectInput value={v} options={data.options[f.key] ?? []} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "multi": return <FieldRow key={f.key} label={labelEl} wide><MultiInput value={v} options={data.options[f.key] ?? []} onChange={(x) => set(f.key, x)} /></FieldRow>;
      case "closet": {
        const items = closet?.[f.closet!] ?? [];
        return (
          <FieldRow key={f.key} label={labelEl} wide>
            <ItemPicker value={v} items={items} loading={!closet}
              onPick={(it) => { const full = items.find((i) => i.id === it.id); setMany({ [f.key]: it.id, ...(full?.values ?? {}) }); }}
              onClear={() => { const full = items.find((i) => i.id === v); const blank: Values = { [f.key]: "" }; for (const k of Object.keys(full?.values ?? {})) blank[k] = ""; setMany(blank); }} />
          </FieldRow>
        );
      }
      default: return null;
    }
  };

  return (
    <div>
      {/* Section tabs */}
      <div className="sticky top-[49px] z-20 -mx-4 mb-4 overflow-x-auto border-b border-border bg-page/90 px-4 py-2 backdrop-blur [scrollbar-width:none] sm:-mx-6 sm:px-6">
        <div className="flex gap-1">
          {DAILY_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${activeSection === s.id ? "bg-ink text-page" : "bg-surface-2 text-ink-2 hover:text-ink"}`}>
              <span aria-hidden>{s.icon}</span> {s.title}
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {DAILY_SECTIONS.map((s) => {
          const keys = s.items.flatMap((i) => (isGroup(i) ? i.fields : [i])).map((f) => f.key);
          return (
            <section key={s.id} id={s.id} data-section={s.id} ref={(el) => { sectionRefs.current[s.id] = el; }} className="card p-4 sm:p-5">
              <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold"><span aria-hidden className="mr-1.5">{s.icon}</span>{s.title}</h2>
                {s.id === "day" && (
                  <button type="button" className="btn-ghost !py-1 text-xs" onClick={getWeather} disabled={weatherBusy}
                    title="Fill Sky / High / Low / Feels like for this date at the Wake Up City">
                    {weatherBusy ? "Fetching…" : "↻ Get weather"}
                  </button>
                )}
                {data.prevDate && (
                  <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => copyPrev(keys)} title={`Copy this section from ${data.prevDate}`}>
                    Copy from {data.prevDate.slice(5).replace("-", "/")}
                  </button>
                )}
              </header>
              {s.id === "day" && weatherNote && <p className="-mt-1 mb-3 text-xs text-muted">{weatherNote} · Feels like = apparent temp at wake-up time</p>}
              {s.id === "outfit" && <OutfitSuggestionsPanel data={outfits} busy={outfitsBusy} onRefresh={() => refreshOutfits()} onWear={setMany} />}
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {s.items.map((item, idx) =>
                  isGroup(item) ? (
                    <fieldset key={item.group} className="col-span-full rounded-xl border border-border bg-page/50 p-3">
                      <legend className="px-1 text-sm font-medium text-ink-2">{item.group}</legend>
                      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{item.fields.map(renderField)}</div>
                    </fieldset>
                  ) : (
                    <div key={item.key + idx} className="contents">{renderField(item)}</div>
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="text-sm text-ink-2">
            {toast ? (
              <span className={toast.kind === "ok" ? "text-accent" : "text-danger"}>{toast.text}</span>
            ) : dirty ? (
              <span>{dirty} unsaved change{dirty === 1 ? "" : "s"}</span>
            ) : (
              <span className="text-muted">All saved{data.storeKind === "csv" ? " · local CSV mode" : ""}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dirty > 0 && <button type="button" className="btn-ghost" onClick={() => setValues({ ...saved })}>Discard</button>}
            <button type="button" className="btn-primary" disabled={!dirty || pending} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
