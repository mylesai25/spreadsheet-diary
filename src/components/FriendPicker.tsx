"use client";

import { useRouter } from "next/navigation";

/** Dropdown that switches the profile below the leaderboard. */
export function FriendPicker({ names, value, range }: { names: string[]; value: string; range: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-2">Show</span>
      <select className="control !w-auto min-w-40 pr-8" value={value} onChange={(e) => router.push(`/friends?range=${range}&who=${encodeURIComponent(e.target.value)}#profile`)}>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}
