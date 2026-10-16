import { requireCtx } from "@/lib/auth";
import { ANNUAL_PRICES, annualSavings, gbp, PLANS, planPricing, SUBSCRIPTION_PLANS, type Interval, type SubscriptionPlanKey } from "@/lib/config";
import { db } from "@/lib/db";
import { slotOf } from "@/lib/subscription-math";
import { pendingPlanChange, reconcilePlanChanges } from "@/lib/subscriptions";
import { stripe } from "@/lib/stripe";
import { fulfilCheckout, type CheckoutSession } from "@/lib/billing";
import { PaymentNotice } from "@/components/PaymentNotice";
import { PortalButton } from "@/components/BillingButtons";
import { PlanCards } from "@/components/PlanCards";
import { SubAction } from "@/components/SubscriptionActions";

type Ledger = { id: string; delta: number; reason: string; created_at: string };

const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { dateStyle: "long" }) : "");

export default async function Billing({ searchParams }: { searchParams: Promise<{ success?: string; canceled?: string; session_id?: string }> }) {
  const sp = await searchParams;
  let ctx = await requireCtx();
  const q = await db();
  const stripeReady = !!process.env.STRIPE_SECRET_KEY;
  // Don't rely on the webhook alone: confirm the paid session with Stripe when the customer returns.
  let paid = false;
  if (sp.success && sp.session_id && stripeReady) {
    try {
      const session = await stripe<CheckoutSession>(`checkout/sessions/${encodeURIComponent(sp.session_id)}`, undefined, "GET");
      if (session.metadata?.workspace_id === ctx.workspace.id) {
        paid = session.payment_status === "paid";
        await fulfilCheckout(session);
        ctx = await requireCtx();
      }
    } catch (e) {
      console.error("billing return fulfilment", e);
    }
  }
  // Settle any upgrade whose payment result we haven't seen yet.
  if (stripeReady && ctx.workspace.stripe_subscription_id) {
    try {
      await reconcilePlanChanges(ctx.workspace.id);
      ctx = await requireCtx();
    } catch (e) {
      console.error("billing reconcile", e);
    }
  }
  const ledger = (await q`SELECT id, delta, reason, created_at FROM credit_ledger WHERE workspace_id = ${ctx.workspace.id} ORDER BY created_at DESC LIMIT 50`) as Ledger[];
  const w = ctx.workspace;
  const plan = SUBSCRIPTION_PLANS.find((k) => k === w.plan) ? PLANS[w.plan as SubscriptionPlanKey] : null;
  const subscribed = !!w.stripe_subscription_id && !!plan;
  const interval: Interval = w.billing_interval === "year" ? "year" : "month";
  const ending = subscribed && w.cancel_at_period_end;
  const pendingPlanKey = SUBSCRIPTION_PLANS.find((k) => k === w.pending_plan);
  const pendingInterval: Interval = w.pending_interval === "year" ? "year" : "month";
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const pendingUpgrade = subscribed ? await pendingPlanChange(w.id) : null;
  const periodStart = w.current_period_start ? Math.floor(new Date(w.current_period_start).getTime() / 1000) : 0;
  const periodEnd = w.current_period_end ? Math.floor(new Date(w.current_period_end).getTime() / 1000) : 0;
  const nowSec = Math.floor(Date.now() / 1000);
  // Monthly plans get credits when the period renews; annual plans get them at the start of each month of the year.
  const nextCredits = subscribed && periodEnd ? (interval === "year" ? slotOf(periodStart, periodEnd, "year", nowSec).end : periodEnd) : 0;
  const nextPlan = pendingPlanKey ? PLANS[pendingPlanKey] : plan;
  const nextPrice = pendingPlanKey ? planPricing(pendingPlanKey, pendingInterval).pence : plan ? planPricing(w.plan as SubscriptionPlanKey, interval).pence : 0;
  const nextDate = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-GB", { dateStyle: "long" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1><span className="num">{w.credits}</span> credits left</h1>
          <p className="sub">You&apos;re on the {plan?.name ?? "Free"} plan. Dubbing uses 10 credits per minute of ad, per market. Regenerating uses 20 to 80 credits per market. Failed versions are refunded.</p>
        </div>
        {w.stripe_customer_id && stripeReady && <PortalButton label="Invoices and payment method" />}
      </div>

      {sp.success && <PaymentNotice message={paid ? "Payment received. Your credits have been added." : "Payment received. Your credits appear here as soon as Stripe confirms it, usually within a few seconds."} />}
      {!stripeReady && <div className="notice" style={{ marginBottom: 24 }}>Payments aren&apos;t switched on for this workspace yet. Ask the site owner to connect Stripe on the <a href="/setup" style={{ textDecoration: "underline" }}>setup page</a>.</div>}
      {subscribed && w.subscription_status === "past_due" && <div className="notice warn" role="alert" style={{ marginBottom: 24 }}>Your last payment didn&apos;t go through. Update your payment method with the button above. No new credits are added until it&apos;s paid.</div>}

      {pendingUpgrade && (
        <div className="notice warn" role="status" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>
            Your change to <b>{PLANS[pendingUpgrade.to_plan as SubscriptionPlanKey]?.name ?? pendingUpgrade.to_plan}</b> is waiting for payment. Nothing changes and no credits are added until it&apos;s paid.
            {pendingUpgrade.hosted_url && <> <a href={pendingUpgrade.hosted_url} style={{ textDecoration: "underline" }}>Complete the payment</a>.</>}
          </div>
          {canManage && <SubAction action="cancel_pending_upgrade" label="Cancel this change" />}
        </div>
      )}

      {subscribed && plan && (
        <div className="panel" style={{ padding: 24, marginBottom: 32 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Your subscription</h2>
          <dl className="stack" style={{ gap: 6, margin: 0 }}>
            <div><b>{plan.name}</b>, {plan.credits} credits every month, billed {interval === "year" ? "yearly" : "monthly"} ({gbp(planPricing(w.plan as SubscriptionPlanKey, interval).pence)}/{interval === "year" ? "yr" : "mo"})</div>
            <div>Credits available now: <b className="num">{w.credits}</b>. Unused credits never expire and carry over.</div>
            {ending ? (
              <div>Your subscription ends on <b>{nextDate(periodEnd)}</b>. You keep your credits{interval === "year" ? ", and the monthly credits for the rest of the year are still added" : ""}. No more are added after that date.</div>
            ) : (
              <>
                <div>Next {nextPlan?.credits ?? plan.credits} credits added on <b>{nextDate(nextCredits)}</b></div>
                <div>Next payment: <b>{gbp(nextPrice)}</b> on <b>{nextDate(periodEnd)}</b></div>
              </>
            )}
            {pendingPlanKey && !ending && nextPlan && (
              <div>Pending change: moving to <b>{nextPlan.name}</b>, billed {pendingInterval === "year" ? "yearly" : "monthly"} ({nextPlan.credits} credits a month) on <b>{fmt(w.pending_plan_at)}</b>. Nothing is removed before then.</div>
            )}
          </dl>
          {canManage && stripeReady && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {pendingPlanKey && !ending && <SubAction action="cancel_pending_change" label="Keep my current plan" />}
              {ending ? (
                <SubAction action="reactivate" label="Keep my subscription" primary />
              ) : (
                <SubAction action="cancel" label="Cancel subscription" confirmText={`Your plan and credits stay until ${nextDate(periodEnd)}, then it ends. No refund is issued.`} />
              )}
            </div>
          )}
        </div>
      )}

      <PlanCards
        plans={SUBSCRIPTION_PLANS.map((k) => ({
          key: k,
          name: PLANS[k].name,
          credits: PLANS[k].credits,
          monthlyPence: PLANS[k].pence,
          annualPence: ANNUAL_PRICES[k].pence,
          savePence: annualSavings(k).pence,
          savePercent: annualSavings(k).percent,
          monthsFree: annualSavings(k).monthsFree,
          featured: k === "growth",
        }))}
        pack={{ credits: PLANS.pack.credits, pence: PLANS.pack.pence }}
        current={subscribed ? { plan: w.plan, interval } : null}
        pending={pendingPlanKey ? { plan: pendingPlanKey, interval: pendingInterval, atLabel: fmt(w.pending_plan_at) } : null}
        ending={ending}
        canManage={canManage}
        hasPendingUpgrade={!!pendingUpgrade}
        periodEndLabel={nextDate(periodEnd)}
      />

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
