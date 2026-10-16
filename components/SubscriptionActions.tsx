"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Interval = "month" | "year";

async function call(body: Record<string, unknown>) {
  const res = await fetch("/api/billing/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? "That didn't work. Try again.");
  return j;
}

const money = (pence: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(pence / 100);
const day = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-GB", { dateStyle: "long" });
const per = (i: Interval) => (i === "year" ? "year" : "month");

type Preview = {
  from: { plan: string; interval: Interval };
  to: { plan: string; interval: Interval };
  amountDue: number;
  currency: string;
  creditsNow: number;
  newCredits: number;
  renewalPence: number;
  renewalDate: number;
  intervalChange: boolean;
};

/** A change that starts now: shows what Stripe will charge today and what credits it adds, then takes payment. */
export function ChangeNowButton({ plan, interval, label }: { plan: string; interval: Interval; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  async function open() {
    setBusy(true);
    setErr("");
    try {
      setPreview(await call({ action: "preview_change", plan, interval }));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  async function confirm() {
    setBusy(true);
    setErr("");
    try {
      const r = await call({ action: "change_now", plan, interval });
      if (r.status === "requires_action" && r.url) {
        window.location.href = r.url;
        return;
      }
      if (r.status === "requires_action") setErr("Your bank needs to confirm this payment. Check your email from Stripe.");
      else {
        setPreview(null);
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {!preview && <button className="btn primary" disabled={busy} onClick={open}>{busy ? "Checking the price" : label}</button>}
      {preview && (
        <div className="stack" style={{ gap: 6, fontSize: 14 }}>
          <div><b>{money(preview.amountDue, preview.currency)}</b> payable today, worked out by Stripe{preview.intervalChange ? ", after crediting the unused time on your current plan" : " for the time left in this period"}.</div>
          <div>
            <b>+{preview.creditsNow} credits</b> added as soon as the payment goes through.{" "}
            {preview.intervalChange ? "That's your first month on the new plan, less what's left of this month's credits. " : ""}
            Your existing credits stay.
          </div>
          <div>Then {preview.newCredits} credits a month{preview.to.interval === "year" ? ", added month by month" : ""}. Next payment {money(preview.renewalPence, preview.currency)} on {day(preview.renewalDate)} (every {per(preview.to.interval)}).</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" disabled={busy} onClick={confirm}>{busy ? "Taking payment" : `Pay ${money(preview.amountDue, preview.currency)} and switch`}</button>
            <button className="btn" disabled={busy} onClick={() => setPreview(null)}>Not now</button>
          </div>
        </div>
      )}
      {err && <span className="error" role="alert">{err}</span>}
    </div>
  );
}

/** A change at the end of the paid period. Nothing is refunded and no credits are removed. */
export function ChangeAtRenewalButton({ plan, interval, label, summary, date }: { plan: string; interval: Interval; label: string; summary: string; date: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [asking, setAsking] = useState(false);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!asking && <button className="btn" onClick={() => setAsking(true)}>{label}</button>}
      {asking && (
        <div className="stack" style={{ gap: 6, fontSize: 14 }}>
          <div>Moves to {summary} on <b>{date}</b>, when your current period ends.</div>
          <div>You keep your current plan and all your credits until then. No refund is issued and nothing is removed now.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr("");
                try {
                  await call({ action: "change_at_renewal", plan, interval });
                  setAsking(false);
                  router.refresh();
                } catch (e) {
                  setErr((e as Error).message);
                }
                setBusy(false);
              }}
            >
              {busy ? "Scheduling" : "Schedule it"}
            </button>
            <button className="btn" disabled={busy} onClick={() => setAsking(false)}>Keep my plan</button>
          </div>
        </div>
      )}
      {err && <span className="error" role="alert">{err}</span>}
    </div>
  );
}

export function SubAction({ action, label, confirmText, primary }: { action: "cancel" | "reactivate" | "cancel_pending_change" | "cancel_pending_upgrade"; label: string; confirmText?: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [asking, setAsking] = useState(false);

  async function run() {
    setBusy(true);
    setErr("");
    try {
      await call({ action });
      setAsking(false);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      {asking && confirmText && <div style={{ fontSize: 14 }}>{confirmText}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className={`btn ${primary ? "primary" : ""}`} disabled={busy} onClick={() => (confirmText && !asking ? setAsking(true) : run())}>
          {busy ? "Working" : asking ? "Yes, continue" : label}
        </button>
        {asking && <button className="btn" disabled={busy} onClick={() => setAsking(false)}>Go back</button>}
      </div>
      {err && <span className="error" role="alert">{err}</span>}
    </div>
  );
}
