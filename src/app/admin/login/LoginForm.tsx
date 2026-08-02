"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(login, null);
  return (
    <form action={formAction} className="login-form">
      <label htmlFor="admin-pw">Admin password</label>
      <input
        id="admin-pw"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
      />
      {error && <p className="login-error">{error}</p>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
