import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { appUrl, PLANS, type PlanKey } from "@/lib/config";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    const { plan } = (await req.json()) as { plan?: PlanKey };
    const p = plan && PLANS[plan];
    if (!p) throw new HttpError(400, "That plan doesn't exist.");
    if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Payments aren't switched on yet. Ask the site owner to connect Stripe.");
    // Use the Stripe price from env if set, otherwise create the price inline at checkout.
    const price = process.env[p.env];
    // Managed Payments (Stripe handles tax, fraud and order support) applies to one-off top-ups only.
    const managed = process.env.STRIPE_MANAGED_PAYMENTS === "true" && p.mode === "payment";
    const item = price
      ? { price, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: p.pence,
            product_data: {
              name: p.mode === "payment" ? `Regionly ${p.credits} credit top-up` : `Regionly ${p.name}, ${p.credits} credits a month`,
              ...(managed ? { tax_code: process.env.STRIPE_TAX_CODE || "txcd_10103100" } : {}),
            },
            ...(p.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
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
      success_url: `${base}/app/billing?success=1`,
      cancel_url: `${base}/app/billing?canceled=1`,
      metadata: meta,
      ...(p.mode === "subscription" ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
      allow_promotion_codes: "true",
      ...(managed ? { managed_payments: { enabled: "true" } } : {}),
    }, "POST", managed ? "2026-02-25.preview" : undefined);
    return Response.json({ url: session.url });
  } catch (e) {
    return jsonError(e);
  }
}
