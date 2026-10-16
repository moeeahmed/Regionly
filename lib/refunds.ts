import { stripe } from "./stripe";
import { restoreAfterDispute, reverseForPayment } from "./subscription-credits";

type Charge = { id: string; amount: number; amount_refunded?: number; payment_intent?: string | null; invoice?: string | null };
type Dispute = { id: string; charge: string; status?: string };

/** The invoice or checkout session that a charge paid for, which is what its credits were granted against. */
async function refOfCharge(c: Charge) {
  if (c.invoice) return c.invoice;
  if (!c.payment_intent) return null;
  try {
    const r = await stripe<{ data: { invoice?: string }[] }>("invoice_payments", { payment: { type: "payment_intent", payment_intent: c.payment_intent } }, "GET");
    if (r.data[0]?.invoice) return r.data[0].invoice;
  } catch {
    // older API versions have no invoice_payments; fall through to checkout sessions
  }
  const s = await stripe<{ data: { id: string }[] }>("checkout/sessions", { payment_intent: c.payment_intent }, "GET");
  return s.data[0]?.id ?? null;
}

/** charge.refunded: take back credits in proportion to the amount refunded so far, never below a zero balance. */
export async function handleRefund(charge: Charge) {
  const refunded = charge.amount_refunded ?? 0;
  if (refunded <= 0) return 0;
  const ref = await refOfCharge(charge);
  if (!ref) return 0;
  return reverseForPayment({ ref, key: `reversal:${charge.id}:${refunded}`, refunded, charged: charge.amount, reason: "Refund: credits taken back" });
}

/** charge.dispute.created: take back the credits for the disputed payment. */
export async function handleDispute(dispute: Dispute) {
  const charge = await stripe<Charge>(`charges/${dispute.charge}`, undefined, "GET");
  const ref = await refOfCharge(charge);
  if (!ref) return 0;
  return reverseForPayment({ ref, key: `reversal:dispute:${dispute.id}`, refunded: charge.amount, charged: charge.amount, reason: "Dispute opened: credits held back" });
}

/** charge.dispute.closed: if we won, give the credits back. */
export async function handleDisputeClosed(dispute: Dispute) {
  return dispute.status === "won" ? restoreAfterDispute(dispute.id) : 0;
}
