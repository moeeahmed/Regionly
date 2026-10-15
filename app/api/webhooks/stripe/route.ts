import { db } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { fulfilCreditPurchase, type CheckoutSession } from "@/lib/billing";
import { PLANS, type PlanKey } from "@/lib/config";
import { stripe, verifyStripeSignature } from "@/lib/stripe";

type Meta = { workspace_id?: string; plan?: string; credits?: string };
type Obj = Record<string, unknown> & { metadata?: Meta; customer?: string; id?: string };

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
        await fulfilCreditPurchase(o as unknown as CheckoutSession);
        if (o.mode === "subscription") {
          await q`UPDATE workspaces SET plan = ${m.plan ?? "starter"}, stripe_subscription_id = ${String(o.subscription ?? "")},
            stripe_customer_id = COALESCE(stripe_customer_id, ${o.customer ?? null}) WHERE id = ${m.workspace_id}`;
        }
        break;
      }
      case "invoice.paid": {
        const parent = (o.parent ?? {}) as { subscription_details?: { metadata?: Meta; subscription?: string } };
        const legacy = (o.subscription_details ?? {}) as { metadata?: Meta };
        let meta: Meta = parent.subscription_details?.metadata ?? legacy.metadata ?? {};
        const subId = parent.subscription_details?.subscription ?? (o.subscription as string | undefined);
        if (!meta.workspace_id && subId) {
          const sub = await stripe<{ metadata?: Meta }>(`subscriptions/${subId}`, undefined, "GET");
          meta = sub.metadata ?? {};
        }
        if (!subId || !meta.workspace_id) break;
        const plan = PLANS[meta.plan as PlanKey];
        const credits = Number(meta.credits ?? plan?.credits ?? 0);
        await q`UPDATE workspaces SET plan = ${meta.plan ?? "starter"}, stripe_subscription_id = ${subId} WHERE id = ${meta.workspace_id}`;
        await grantCredits(meta.workspace_id, credits, `${plan?.name ?? "Subscription"} monthly credits`);
        break;
      }
      case "customer.subscription.deleted": {
        await q`UPDATE workspaces SET plan = 'free', stripe_subscription_id = NULL WHERE stripe_subscription_id = ${o.id ?? ""}`;
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
