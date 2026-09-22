"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input name="password" type="password" className="control" placeholder="Password" autoFocus autoComplete="current-password" required />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
    </form>
  );
}
