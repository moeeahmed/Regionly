import { db } from "./db";
import { grantCredits } from "./credits";
import { PLANS, type PlanKey } from "./config";

export type CheckoutSession = {
  id: string;
  mode?: string;
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
