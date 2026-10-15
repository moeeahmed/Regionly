"use client";

import { useState } from "react";

export function DeleteAccount({ email }: { email: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return <div className="del-box del-done" role="status">Your account and its data have been deleted. You&apos;ve been signed out.</div>;
  }

  return (
    <form
      className="del-box"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: value }) });
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setError(j.error ?? "Your account couldn't be deleted. Try again.");
        setDone(true);
      }}
    >
      <h3>Delete your account</h3>
      <p>Signed in as <b>{email}</b>. This can&apos;t be undone.</p>
      <label>
        <span>Type your email address to confirm</span>
        <input type="email" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" required />
      </label>
      {error && <p className="del-err" role="alert">{error}</p>}
      <button className="lp-btn lp-btn-danger" disabled={busy || value.trim().toLowerCase() !== email.toLowerCase()}>
        {busy ? "Deleting" : "Delete my account and data"}
      </button>
    </form>
  );
}
