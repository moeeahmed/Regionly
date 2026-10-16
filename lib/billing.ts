import { db } from "./db";
import { grantCredits } from "./credits";
import { PLANS, type PlanKey } from "./config";
import { processPaidInvoice } from "./subscriptions";

export type CheckoutSession = {
  id: string;
  mode?: string;
  customer?: string;
  subscription?: string;
  invoice?: string;
  payment_status?: string;
  metadata?: { workspace_id?: string; plan?: string; credits?: string };
};

/**
 * Grant credits for a paid one-off top-up. Called from the webhook and the return page;
 * the ledger's idempotency key means the credits are only ever added once.
 */
export async function fulfilCreditPurchase(session: CheckoutSession) {
  const m = session.metadata ?? {};
  if (session.mode !== "payment" || session.payment_status !== "paid" || !m.workspace_id) return false;
  const q = await db();
  // Purchases fulfilled before the ledger had idempotency keys were recorded here.
  const legacy = await q`SELECT 1 FROM stripe_events WHERE id = ${`fulfil_${session.id}`}`;
  if (legacy.length) return false;
  return grantCredits(m.workspace_id, Number(m.credits ?? 0), `Bought ${PLANS[m.plan as PlanKey]?.name ?? "credits"}`, undefined, {
    kind: "purchase",
    idempotencyKey: `pack:${session.id}`,
    stripeRef: session.id,
  });
}

/** Fulfil a paid checkout session of either kind. Returns the credits granted now (0 if already done). */
export async function fulfilCheckout(session: CheckoutSession) {
  const m = session.metadata ?? {};
  if (session.payment_status !== "paid" || !m.workspace_id) return 0;
  if (session.mode === "payment") return (await fulfilCreditPurchase(session)) ? Number(m.credits ?? 0) : 0;
  if (session.mode === "subscription" && session.invoice) return processPaidInvoice(session.invoice);
  return 0;
}
