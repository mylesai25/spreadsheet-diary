"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return { error: "Wrong password" };
  }
  (await cookies()).set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next.startsWith("/") ? next : "/");
}
