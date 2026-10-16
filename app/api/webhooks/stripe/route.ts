import { db } from "@/lib/db";
import { fulfilCheckout, type CheckoutSession } from "@/lib/billing";
import { processFailedInvoice, processPaidInvoice, syncSubscription } from "@/lib/subscriptions";
import { handleDispute, handleDisputeClosed, handleRefund } from "@/lib/refunds";
import { verifyStripeSignature } from "@/lib/stripe";

type Obj = Record<string, unknown> & { metadata?: { workspace_id?: string }; id?: string };

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "not configured" }, { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { id: string; type: string; data: { object: Obj } };
  const q = await db();
  const fresh = await q`INSERT INTO stripe_events (id) VALUES (${event.id}) ON CONFLICT DO NOTHING RETURNING id`;
  if (!fresh.length) return Response.json({ ok: true, duplicate: true });

  try {
    const o = event.data.object;
    switch (event.type) {
      case "checkout.session.completed": {
        const m = o.metadata ?? {};
        if (!m.workspace_id) break;
        await fulfilCheckout(o as unknown as CheckoutSession);
        break;
      }
      case "invoice.paid":
        await processPaidInvoice(String(o.id));
        break;
      case "invoice.payment_failed":
        await processFailedInvoice(String(o.id));
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(String(o.id));
        break;
      case "charge.refunded":
        await handleRefund(o as unknown as Parameters<typeof handleRefund>[0]);
        break;
      case "charge.dispute.created":
        await handleDispute(o as unknown as Parameters<typeof handleDispute>[0]);
        break;
      case "charge.dispute.closed":
        await handleDisputeClosed(o as unknown as Parameters<typeof handleDisputeClosed>[0]);
        break;
      case "subscription_schedule.created":
      case "subscription_schedule.updated":
      case "subscription_schedule.released":
      case "subscription_schedule.completed":
      case "subscription_schedule.canceled":
      case "subscription_schedule.aborted": {
        if (o.subscription) await syncSubscription(String(o.subscription));
        break;
      }
    }
  } catch (e) {
    await q`DELETE FROM stripe_events WHERE id = ${event.id}`;
    console.error("stripe webhook", e);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
