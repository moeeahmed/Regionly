import { db } from "./db";
import { grantCredits } from "./credits";
import { PLANS, type PlanKey } from "./config";

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
 * Grant credits for a paid one-off checkout. Safe to call from both the webhook and the
 * return page: the first caller for a session wins, later calls do nothing.
 */
export async function fulfilCreditPurchase(session: CheckoutSession) {
  const m = session.metadata ?? {};
  if (session.mode !== "payment" || session.payment_status !== "paid" || !m.workspace_id) return false;
  const q = await db();
  const fresh = await q`INSERT INTO stripe_events (id) VALUES (${`fulfil_${session.id}`}) ON CONFLICT DO NOTHING RETURNING id`;
  if (!fresh.length) return false;
  try {
    await grantCredits(m.workspace_id, Number(m.credits ?? 0), `Bought ${PLANS[m.plan as PlanKey]?.name ?? "credits"}`);
  } catch (e) {
    await q`DELETE FROM stripe_events WHERE id = ${`fulfil_${session.id}`}`;
    throw e;
  }
  return true;
}

/**
 * Switch a workspace onto a subscription plan and grant that billing period's credits.
 * Keyed on the invoice, so the webhook (invoice.paid / checkout.session.completed) and the
 * return page can all call it and the credits are only granted once.
 */
export async function fulfilSubscriptionInvoice(args: { invoiceId: string; workspaceId: string; plan?: string; credits?: number; subscriptionId: string; customerId?: string }) {
  const q = await db();
  const plan = PLANS[args.plan as PlanKey];
  await q`UPDATE workspaces SET plan = ${args.plan ?? "starter"}, stripe_subscription_id = ${args.subscriptionId},
    stripe_customer_id = COALESCE(stripe_customer_id, ${args.customerId ?? null}) WHERE id = ${args.workspaceId}`;
  const key = `fulfil_inv_${args.invoiceId}`;
  const fresh = await q`INSERT INTO stripe_events (id) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING id`;
  if (!fresh.length) return false;
  try {
    await grantCredits(args.workspaceId, args.credits ?? plan?.credits ?? 0, `${plan?.name ?? "Subscription"} monthly credits`);
  } catch (e) {
    await q`DELETE FROM stripe_events WHERE id = ${key}`;
    throw e;
  }
  return true;
}

/** Fulfil a paid checkout session of either kind. Returns the credits granted now (0 if already done). */
export async function fulfilCheckout(session: CheckoutSession) {
  const m = session.metadata ?? {};
  if (session.payment_status !== "paid" || !m.workspace_id) return 0;
  if (session.mode === "payment") return (await fulfilCreditPurchase(session)) ? Number(m.credits ?? 0) : 0;
  if (session.mode === "subscription" && session.subscription && session.invoice) {
    const credits = Number(m.credits ?? PLANS[m.plan as PlanKey]?.credits ?? 0);
    const done = await fulfilSubscriptionInvoice({ invoiceId: session.invoice, workspaceId: m.workspace_id, plan: m.plan, credits, subscriptionId: session.subscription, customerId: session.customer });
    return done ? credits : 0;
  }
  return 0;
}
