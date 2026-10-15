import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    if (!ctx.workspace.stripe_customer_id) throw new HttpError(400, "There's no billing account yet. Choose a plan first.");
    const s = await stripe<{ url: string }>("billing_portal/sessions", {
      customer: ctx.workspace.stripe_customer_id,
      return_url: `${appUrl(req)}/app/billing`,
    });
    return Response.json({ url: s.url });
  } catch (e) {
    return jsonError(e);
  }
}
