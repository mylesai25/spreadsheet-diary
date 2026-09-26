"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActivityPageData, ActivityField } from "@/lib/activities";
import { saveActivityAction } from "@/app/activities/[slug]/actions";
import { FieldRow, Toggle, Rating, NumberField, TimeField, TextField, TextArea, DateField } from "./form/Fields";
import { SelectInput, MultiInput } from "./form/Combobox";

type Values = Record<string, string>;

function blank(fields: ActivityField[], today: string, dateKey?: string): Values {
  const v: Values = {};
  for (const f of fields) v[f.key] = f.type === "bool" ? "FALSE" : "";
  if (dateKey && v[dateKey] !== undefined) v[dateKey] = today;
  return v;
}

export function ActivityForm({ data }: { data: ActivityPageData }) {
  const router = useRouter();
  const [groupIndex, setGroupIndex] = useState(0);
  const group = data.groups[groupIndex];
  const [values, setValues] = useState<Values>(() => blank(group.fields, data.today, data.config.dateKey));
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const filled = Object.entries(values).filter(([k, v]) => v !== "" && !(v === "FALSE" && group.fields.find((f) => f.key === k)?.type === "bool")).length;

  const switchGroup = (i: number) => { setGroupIndex(i); setValues(blank(data.groups[i].fields, data.today, data.config.dateKey)); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveActivityAction(data.config.slug, values, groupIndex);
      if (res.ok) {
        setToast({ kind: "ok", text: "Saved" });
        setValues(blank(group.fields, data.today, data.config.dateKey));
        router.refresh();
      } else setToast({ kind: "err", text: res.error ?? "Save failed" });
      setTimeout(() => setToast(null), 3000);
    });
  };

  const render = (f: ActivityField) => {
    const v = values[f.key] ?? "";
    const on = (x: string) => set(f.key, x);
    switch (f.type) {
      case "date": return <FieldRow key={f.key} label={f.key}><DateField value={v} onChange={on} /></FieldRow>;
      case "time": return <FieldRow key={f.key} label={f.key}><TimeField value={v} onChange={on} /></FieldRow>;
      case "bool": return <FieldRow key={f.key} label={f.key}><Toggle value={v} onChange={on} /></FieldRow>;
      case "rating": return <FieldRow key={f.key} label={f.key} wide><Rating value={v} min={f.min} max={f.max} onChange={on} /></FieldRow>;
      case "number": return <FieldRow key={f.key} label={f.key}><NumberField value={v} min={f.min} onChange={on} /></FieldRow>;
      case "textarea": return <FieldRow key={f.key} label={f.key} wide><TextArea value={v} onChange={on} /></FieldRow>;
      case "multi": return <FieldRow key={f.key} label={f.key} wide><MultiInput value={v} options={f.options ?? []} onChange={on} /></FieldRow>;
      case "select": return <FieldRow key={f.key} label={f.key}><SelectInput value={v} options={f.options ?? []} onChange={on} /></FieldRow>;
      default: return <FieldRow key={f.key} label={f.key}><TextField value={v} onChange={on} /></FieldRow>;
    }
  };

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">Add {data.groups.length > 1 ? "" : "entry"}</h2>
        {data.groups.length > 1 && (
          <div className="seg">
            {data.groups.map((g, i) => (
              <button key={g.title} type="button" aria-pressed={i === groupIndex} onClick={() => switchGroup(i)}>{g.title}</button>
            ))}
          </div>
        )}
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{group.fields.map(render)}</div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`text-sm ${toast ? (toast.kind === "ok" ? "text-accent" : "text-danger") : "text-muted"}`}>
          {toast ? toast.text : `${filled} field${filled === 1 ? "" : "s"} filled`}
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setValues(blank(group.fields, data.today, data.config.dateKey))}>Clear</button>
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save entry"}</button>
        </div>
      </div>
    </form>
  );
}
