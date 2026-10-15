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
    const price = process.env[p.env];
    if (!price) throw new HttpError(503, "Payments aren't switched on yet. Ask the site owner to connect Stripe.");

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
      line_items: { 0: { price, quantity: 1 } },
      success_url: `${base}/app/billing?success=1`,
      cancel_url: `${base}/app/billing?canceled=1`,
      metadata: meta,
      ...(p.mode === "subscription" ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
      allow_promotion_codes: "true",
    });
    return Response.json({ url: session.url });
  } catch (e) {
    return jsonError(e);
  }
}
