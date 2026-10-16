import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { appUrl, PLANS, type PlanKey } from "@/lib/config";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { ensurePrice, parseVariant } from "@/lib/subscriptions";

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    const { plan, interval } = (await req.json()) as { plan?: PlanKey; interval?: string };
    const p = plan && PLANS[plan];
    if (!p) throw new HttpError(400, "That plan doesn't exist.");
    if (p.mode === "subscription" && ctx.workspace.stripe_subscription_id) {
      // Never run two subscriptions side by side. Only let a new one start if the old one has really ended.
      const sub = await stripe<{ status?: string }>(`subscriptions/${ctx.workspace.stripe_subscription_id}`, undefined, "GET").catch(() => null);
      if (sub && !["canceled", "incomplete_expired"].includes(sub.status ?? "")) {
        throw new HttpError(409, "You already have a subscription. Change or cancel it from the Billing page.");
      }
    }
    if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Payments aren't switched on yet. Ask the site owner to connect Stripe.");
    // Subscriptions use real Stripe prices (created on first use). The top-up pack uses the env price or an inline one.
    const price = process.env[p.env];
    // Managed Payments (Stripe handles tax, fraud and order support) applies to one-off top-ups only.
    // It is on by default on some Stripe accounts, so it is set explicitly on every session.
    const managed = process.env.STRIPE_MANAGED_PAYMENTS !== "false" && p.mode === "payment";
    const item = p.mode === "subscription"
      ? { price: await ensurePrice(parseVariant(plan, interval)), quantity: 1 }
      : price
      ? { price, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: p.pence,
            product_data: {
              name: `Regionly ${p.credits} credit top-up`,
              ...(managed ? { tax_code: process.env.STRIPE_TAX_CODE || "txcd_10103001" } : {}),
            },
          },
        };

    let customer = ctx.workspace.stripe_customer_id;
    if (!customer) {
      const c = await stripe<{ id: string }>("customers", {
        email: ctx.user.email,
        name: ctx.workspace.name,
        metadata: { workspace_id: ctx.workspace.id },
      });
      customer = c.id;
      const q = await db();
      await q`UPDATE workspaces SET stripe_customer_id = ${customer} WHERE id = ${ctx.workspace.id}`;
    }

    const base = appUrl(req);
    const meta = { workspace_id: ctx.workspace.id, plan: plan!, credits: String(p.credits) };
    const session = await stripe<{ url: string }>("checkout/sessions", {
      mode: p.mode,
      customer,
      client_reference_id: ctx.workspace.id,
      line_items: { 0: item },
      success_url: `${base}/app/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/app/billing?canceled=1`,
      metadata: meta,
      ...(p.mode === "subscription" ? { subscription_data: { metadata: { workspace_id: ctx.workspace.id } } } : { payment_intent_data: { metadata: meta } }),
      allow_promotion_codes: "true",
      managed_payments: { enabled: managed ? "true" : "false" },
    }, "POST", "2026-02-25.preview");
    return Response.json({ url: session.url });
  } catch (e) {
    return jsonError(e);
  }
}
