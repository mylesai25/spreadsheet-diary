import { getStore } from "@/lib/store";
import { authEnabled } from "@/lib/auth";
import { handler, json, options } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = options;

/** Connection check for the mobile app. */
export const GET = handler(async () => json({ ok: true, store: getStore().kind, authRequired: authEnabled(), version: 1 }));
