"use client";

import type { ReactNode } from "react";

export function FieldRow({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Toggle({ value, onChange, labels = ["No", "Yes"] }: { value: string; onChange: (v: string) => void; labels?: [string, string] }) {
  const on = value === "TRUE";
  return (
    <div className="seg self-start" role="group">
      <button type="button" aria-pressed={value === "FALSE"} onClick={() => onChange("FALSE")}>{labels[0]}</button>
      <button type="button" aria-pressed={on} onClick={() => onChange("TRUE")}>{labels[1]}</button>
    </div>
  );
}

export function Rating({ value, onChange, max = 10, min = 1 }: { value: string; onChange: (v: string) => void; max?: number; min?: number }) {
  const n = Number(value);
  return (
    <div className="seg flex-wrap self-start" role="radiogroup">
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={n === k}
          onClick={() => onChange(n === k ? "" : String(k))}>
          {k}
        </button>
      ))}
    </div>
  );
}

export function NumberField({ value, onChange, min, max, step, unit, placeholder }: {
  value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number; unit?: string; placeholder?: string;
}) {
  return (
    <div className="control flex items-center gap-2 py-0">
      <input type="number" inputMode="decimal" className="min-w-0 flex-1 bg-transparent py-2 outline-none" value={value}
        min={min} max={max} step={step ?? "any"} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      {unit && <span className="text-xs text-muted">{unit}</span>}
    </div>
  );
}

export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="time" className="control" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="date" className="control" value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function TextField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" className="control" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea rows={2} className="control resize-y" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
