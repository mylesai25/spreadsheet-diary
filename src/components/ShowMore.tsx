"use client";

import { useState, type ReactNode } from "react";

/** Collapsed table rows: renders a "show more" row until clicked, then the real rows. */
export function ShowMoreRows({ count, colSpan, children }: { count: number; colSpan: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return (
    <tbody>
      <tr><td colSpan={colSpan} className="p-0">
        <button type="button" className="w-full px-3 py-2 text-left text-sm font-semibold text-neon hover:underline" onClick={() => setOpen(true)}>Show {count} more…</button>
      </td></tr>
    </tbody>
  );
}
