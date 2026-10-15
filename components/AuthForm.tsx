"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "That didn't work. Try again.");
      setBusy(false);
      return;
    }
    router.push(next.startsWith("/") ? next : "/app");
    router.refresh();
  }

  const q = next !== "/app" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form onSubmit={onSubmit} className="panel auth-card stack" style={{ gap: 16 }}>
      <div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">{mode === "login" ? "Sign in to your workspace." : "30 free credits to start. No card needed."}</p>
      </div>
      {mode === "signup" && (
        <label className="field">Name<input type="text" name="name" autoComplete="name" /></label>
      )}
      <label className="field">Work email<input type="email" name="email" required autoComplete="email" /></label>
      <label className="field">
        Password
        {mode === "signup" && <span className="hint">At least 8 characters.</span>}
        <input type="password" name="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? (mode === "login" ? "Signing in" : "Creating account") : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="faint">
        {mode === "login" ? (
          <>New here? <Link href={`/signup${q}`} style={{ color: "var(--ink)", textDecoration: "underline" }}>Create an account</Link></>
        ) : (
          <>Already have an account? <Link href={`/login${q}`} style={{ color: "var(--ink)", textDecoration: "underline" }}>Sign in</Link></>
        )}
      </p>
    </form>
  );
}
