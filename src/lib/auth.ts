/** Optional single-password gate, enabled by setting APP_PASSWORD (recommended when hosted). */
export const AUTH_COOKIE = "diary_auth";

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/** Cookie token derived from the password, so rotating the password logs everyone out. */
export async function expectedToken(): Promise<string> {
  const data = new TextEncoder().encode(`diary:${process.env.APP_PASSWORD ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
