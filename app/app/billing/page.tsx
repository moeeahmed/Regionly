import { requireCtx } from "@/lib/auth";
import { PLANS } from "@/lib/config";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { fulfilCheckout, type CheckoutSession } from "@/lib/billing";
import { PaymentNotice } from "@/components/PaymentNotice";
import { BuyButton, PortalButton } from "@/components/BillingButtons";

type Ledger = { id: string; delta: number; reason: string; created_at: string };

export default async function Billing({ searchParams }: { searchParams: Promise<{ success?: string; canceled?: string; session_id?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const q = await db();
  // Don't rely on the webhook alone: confirm the paid session with Stripe when the customer returns.
  let paid = false;
  if (sp.success && sp.session_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await stripe<CheckoutSession>(`checkout/sessions/${encodeURIComponent(sp.session_id)}`, undefined, "GET");
      if (session.metadata?.workspace_id === ctx.workspace.id) {
        paid = session.payment_status === "paid";
        ctx.workspace.credits += await fulfilCheckout(session);
      }
    } catch (e) {
      console.error("billing return fulfilment", e);
    }
  }
  const ledger = (await q`SELECT id, delta, reason, created_at FROM credit_ledger WHERE workspace_id = ${ctx.workspace.id} ORDER BY created_at DESC LIMIT 50`) as Ledger[];
  const stripeReady = !!process.env.STRIPE_SECRET_KEY;
  const plan = PLANS[ctx.workspace.plan as keyof typeof PLANS];

  return (
    <>
      <div className="page-head">
        <div>
          <h1><span className="num">{ctx.workspace.credits}</span> credits left</h1>
          <p className="sub">You&apos;re on the {plan?.name ?? "Free"} plan. Dubbing uses 10 credits per minute of ad, per market. Regenerating uses 20 to 80 credits per market. Failed versions are refunded.</p>
        </div>
        {ctx.workspace.stripe_customer_id && stripeReady && <PortalButton />}
      </div>

      {sp.success && <PaymentNotice message={paid ? "Payment received. Your credits have been added." : "Payment received. Your credits appear here as soon as Stripe confirms it, usually within a few seconds."} />}
      {!stripeReady && <div className="notice" style={{ marginBottom: 24 }}>Payments aren&apos;t switched on for this workspace yet. Ask the site owner to connect Stripe on the <a href="/setup" style={{ textDecoration: "underline" }}>setup page</a>.</div>}

      <div className="prices" style={{ marginTop: 0, marginBottom: 48 }}>
        {Object.entries(PLANS).map(([k, p]) => {
          const [amt, per] = p.price.split(/(?=\/| one-off)/);
          const current = ctx.workspace.plan === k;
          return (
            <div key={k} className={`price ${current ? "featured" : ""}`}>
              <h3>{p.name}{current ? ", your plan" : ""}</h3>
              <div className="amt">{amt}<small>{per}</small></div>
              <p className="what">{p.credits} credits{p.mode === "subscription" ? " every month" : ", never expire"}</p>
              {!current && p.mode === "subscription" && ctx.workspace.stripe_subscription_id && stripeReady ? (
                <PortalButton label={`Change to ${p.name}`} />
              ) : current ? (
                <span className="faint">Manage it with the button above.</span>
              ) : (
                <BuyButton plan={k} label={p.mode === "subscription" ? `Switch to ${p.name}` : `Buy ${p.credits} credits`} primary={k === "growth"} />
              )}
            </div>
          );
        })}
      </div>

      <h2 className="section-title">Credit history</h2>
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="list">
          <thead><tr><th scope="col">Date</th><th scope="col">What for</th><th scope="col" style={{ textAlign: "right" }}>Credits</th></tr></thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td className="muted num">{new Date(l.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>{l.reason}</td>
                <td className="num" style={{ textAlign: "right", fontWeight: 600, color: l.delta > 0 ? "var(--good)" : "var(--ink)" }}>{l.delta > 0 ? `+${l.delta}` : `−${Math.abs(l.delta)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
