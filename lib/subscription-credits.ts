import { db } from "./db";
import { grantCredits, reverseCredits } from "./credits";
import { addMonths, monthlyAllocationsDue, reversalNeeded } from "./subscription-math";
import { PLANS, type PlanKey } from "./config";

/**
 * Database-only credit rules for subscriptions (no Stripe calls), so they can be tested against a database.
 * Every grant carries an idempotency key, so webhook retries and the return page can't double-grant.
 */

/** Full allocation for a subscription period: the initial payment or a renewal. */
export async function allocatePeriodCredits(a: {
  workspaceId: string;
  subscriptionId: string;
  planKey: PlanKey;
  periodStart: number;
  periodEnd: number | null;
  invoiceId: string;
}) {
  const plan = PLANS[a.planKey];
  const q = await db();
  // Invoices fulfilled before the ledger carried idempotency keys were recorded here.
  const legacy = await q`SELECT 1 FROM stripe_events WHERE id = ${`fulfil_inv_${a.invoiceId}`}`;
  if (legacy.length) return 0;
  const granted = await grantCredits(a.workspaceId, plan.credits, `${plan.name} monthly credits`, undefined, {
    kind: "allocation",
    idempotencyKey: `alloc:${a.subscriptionId}:${a.periodStart}`,
    subscriptionId: a.subscriptionId,
    stripeRef: a.invoiceId,
    periodStart: new Date(a.periodStart * 1000),
    periodEnd: a.periodEnd ? new Date(a.periodEnd * 1000) : null,
  });
  return granted ? plan.credits : 0;
}

export type PlanChangeRow = {
  id: string;
  workspace_id: string;
  subscription_id: string;
  from_plan: string;
  to_plan: string;
  credits: number;
  proration_date: number;
  status: string;
  invoice_id: string | null;
};

/** The paid upgrade invoice arrived: grant the prorated difference once and mark the change applied. */
export async function applyPlanChange(planChangeId: string, invoiceId: string) {
  const q = await db();
  const rows = (await q`SELECT * FROM plan_changes WHERE id = ${planChangeId}`) as PlanChangeRow[];
  const pc = rows[0];
  if (!pc) return 0;
  // Grant first (idempotent), then mark applied, so a crash in between is repaired by the next delivery.
  const granted = await grantCredits(pc.workspace_id, pc.credits, `Upgrade to ${PLANS[pc.to_plan as PlanKey]?.name ?? pc.to_plan}, extra credits for this period`, undefined, {
    kind: "upgrade_adjustment",
    idempotencyKey: `upgrade:${pc.id}`,
    subscriptionId: pc.subscription_id,
    stripeRef: invoiceId,
  });
  await q`UPDATE plan_changes SET status = 'applied', invoice_id = ${invoiceId}, applied_at = COALESCE(applied_at, now()) WHERE id = ${pc.id} AND status <> 'applied'`;
  return granted ? pc.credits : 0;
}

export async function failPlanChange(planChangeId: string, error: string) {
  const q = await db();
  await q`UPDATE plan_changes SET status = 'failed', error = ${error} WHERE id = ${planChangeId} AND status = 'pending'`;
}

/** The plan change an upgrade invoice belongs to: matched by invoice id, else the one pending change on that subscription. */
export async function findPlanChangeForInvoice(invoiceId: string, subscriptionId: string) {
  const q = await db();
  const byInvoice = (await q`SELECT * FROM plan_changes WHERE invoice_id = ${invoiceId}`) as PlanChangeRow[];
  if (byInvoice[0]) return byInvoice[0];
  const pending = (await q`SELECT * FROM plan_changes WHERE subscription_id = ${subscriptionId} AND status = 'pending' AND invoice_id IS NULL ORDER BY created_at DESC LIMIT 1`) as PlanChangeRow[];
  return pending[0] ?? null;
}

/**
 * Annual plans grant a month of credits at a time. The invoice grants month one; this grants months two to twelve
 * as each one starts. Run by the daily cron; safe to run any number of times, and it catches up if a run was missed.
 */
export async function allocateMonthlyCredits(nowSec = Math.floor(Date.now() / 1000)) {
  const q = await db();
  const list = (await q`
    SELECT id, plan, stripe_subscription_id AS sub,
           EXTRACT(EPOCH FROM current_period_start)::bigint AS ps, EXTRACT(EPOCH FROM current_period_end)::bigint AS pe
    FROM workspaces
    WHERE billing_interval = 'year' AND subscription_status IN ('active', 'trialing')
      AND stripe_subscription_id IS NOT NULL AND current_period_start IS NOT NULL AND current_period_end IS NOT NULL`) as
    { id: string; plan: string; sub: string; ps: string; pe: string }[];
  let granted = 0;
  for (const w of list) {
    const plan = PLANS[w.plan as PlanKey];
    if (!plan) continue;
    const ps = Number(w.ps);
    const pe = Number(w.pe);
    const first = await q`SELECT stripe_ref FROM credit_ledger WHERE subscription_id = ${w.sub} AND period_start = to_timestamp(${ps}::bigint) AND stripe_ref IS NOT NULL ORDER BY created_at LIMIT 1`;
    const ref = (first[0]?.stripe_ref as string | undefined) ?? undefined;
    for (const k of monthlyAllocationsDue(ps, pe, nowSec)) {
      const ok = await grantCredits(w.id, plan.credits, `${plan.name} monthly credits, month ${k + 1} of 12`, undefined, {
        kind: "allocation",
        idempotencyKey: `alloc:${w.sub}:${ps}:m${k}`,
        subscriptionId: w.sub,
        stripeRef: ref,
        periodStart: new Date(addMonths(ps, k) * 1000),
        periodEnd: new Date(Math.min(addMonths(ps, k + 1), pe) * 1000),
      });
      if (ok) granted += plan.credits;
    }
  }
  return granted;
}

/**
 * A refund or dispute on a payment: take back the matching share of the credits that payment granted, never more
 * than the current balance. `ref` is the invoice id or checkout session id the credits were granted against.
 */
export async function reverseForPayment(a: { ref: string; key: string; refunded: number; charged: number; reason: string }) {
  const q = await db();
  const rows = await q`
    SELECT workspace_id,
           COALESCE(SUM(delta) FILTER (WHERE kind IN ('allocation', 'upgrade_adjustment', 'purchase')), 0)::int AS granted,
           COALESCE(-SUM(delta) FILTER (WHERE kind = 'reversal'), 0)::int AS reversed
    FROM credit_ledger WHERE stripe_ref = ${a.ref} GROUP BY workspace_id`;
  const r = rows[0];
  if (!r) return 0;
  const need = reversalNeeded(r.granted as number, r.reversed as number, a.refunded, a.charged);
  return reverseCredits(r.workspace_id as string, need, a.reason, { idempotencyKey: a.key, stripeRef: a.ref });
}

/** A dispute was decided in our favour: give back what its reversal took. */
export async function restoreAfterDispute(disputeId: string) {
  const q = await db();
  const rows = await q`SELECT workspace_id, -delta AS amt, stripe_ref FROM credit_ledger WHERE idempotency_key = ${`reversal:dispute:${disputeId}`}`;
  const r = rows[0];
  if (!r || (r.amt as number) <= 0) return 0;
  const ok = await grantCredits(r.workspace_id as string, r.amt as number, "Dispute won: credits restored", undefined, {
    kind: "reversal", // nets against the reversal, so a later real refund is sized correctly
    idempotencyKey: `restore:dispute:${disputeId}`,
    stripeRef: (r.stripe_ref as string | null) ?? undefined,
  });
  return ok ? (r.amt as number) : 0;
}
