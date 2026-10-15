"use client";

import { useState } from "react";

export function InviteForm() {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="panel pad stack"
      style={{ gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setLink("");
        setCopied(false);
        const form = new FormData(e.currentTarget);
        const res = await fetch("/api/team/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return setError(j.error ?? "The invite couldn't be created.");
        setLink(j.link);
      }}
    >
      <h2 className="section-title" style={{ marginBottom: 0 }}>Invite someone</h2>
      <div className="row wrap" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ flex: "1 1 240px" }}>
          Email
          <input type="email" name="email" required placeholder="name@company.com" />
        </label>
        <label className="field" style={{ width: 150 }}>
          Role
          <select name="role">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="btn primary" disabled={busy}>{busy ? "Creating link" : "Create invite link"}</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {link && (
        <div className="notice warn stack" style={{ gap: 10 }} role="status">
          <span>Send this link to them. They join after signing in with the email you entered.</span>
          <div className="row">
            <label className="grow"><span className="visually-hidden">Invite link</span><input type="text" readOnly value={link} onFocus={(e) => e.target.select()} /></label>
            <button type="button" className="btn" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </div>
      )}
    </form>
  );
}
