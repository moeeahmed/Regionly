import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { cancelAtPeriodEnd, cancelPendingChange, cancelPendingUpgrade, changeAtRenewal, changeNow, parseVariant, previewChange, reactivate } from "@/lib/subscriptions";

type Body = {
  action?: "preview_change" | "change_now" | "change_at_renewal" | "cancel_pending_change" | "cancel_pending_upgrade" | "cancel" | "reactivate";
  plan?: string;
  interval?: string;
};

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    if (ctx.role !== "owner" && ctx.role !== "admin") throw new HttpError(403, "Only a workspace owner can change the plan.");
    const { action, plan, interval } = (await req.json()) as Body;
    switch (action) {
      case "preview_change":
        return Response.json(await previewChange(ctx, parseVariant(plan, interval)));
      case "change_now":
        return Response.json(await changeNow(ctx, parseVariant(plan, interval)));
      case "change_at_renewal":
        await changeAtRenewal(ctx, parseVariant(plan, interval));
        return Response.json({ ok: true });
      case "cancel_pending_change":
        await cancelPendingChange(ctx);
        return Response.json({ ok: true });
      case "cancel_pending_upgrade":
        await cancelPendingUpgrade(ctx);
        return Response.json({ ok: true });
      case "cancel":
        await cancelAtPeriodEnd(ctx);
        return Response.json({ ok: true });
      case "reactivate":
        await reactivate(ctx);
        return Response.json({ ok: true });
      default:
        throw new HttpError(400, "Unknown action.");
    }
  } catch (e) {
    return jsonError(e);
  }
}
