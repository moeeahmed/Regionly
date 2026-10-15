"use client";

import { useState } from "react";

export function BuyButton({ plan, label, primary }: { plan: string; label: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button
        className={`btn ${primary ? "primary" : ""}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j.url) window.location.href = j.url;
          else {
            setErr(j.error ?? "Checkout couldn't open. Try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening checkout" : label}
      </button>
      {err && <span className="error" role="alert">{err}</span>}
    </div>
  );
}

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          const res = await fetch("/api/billing/portal", { method: "POST" });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j.url) window.location.href = j.url;
          else {
            setErr(j.error ?? "Billing settings couldn't open.");
            setBusy(false);
          }
        }}
      >
        Manage plan and invoices
      </button>
      {err && <span className="error" role="alert">{err}</span>}
    </div>
  );
}
