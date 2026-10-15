import { del } from "@vercel/blob";
import { apiCtx, destroySession, HttpError, jsonError } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

type JobData = { voice?: { scenes?: { audioUrl?: string }[] } };

/**
 * Permanently deletes the signed-in user. Workspaces where they are the only member are deleted with
 * everything in them (ads, versions, credits, invites) and their stored files. In shared workspaces
 * only their membership is removed and the workspace's content stays with the remaining members.
 */
export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
    if ((confirm ?? "").trim().toLowerCase() !== ctx.user.email.toLowerCase()) {
      throw new HttpError(400, "Type your email address exactly to confirm.");
    }
    const q = await db();
    const sole = (await q`
      SELECT w.id, w.stripe_subscription_id FROM workspaces w
      JOIN memberships m ON m.workspace_id = w.id AND m.user_id = ${ctx.user.id}
      WHERE (SELECT COUNT(*) FROM memberships m2 WHERE m2.workspace_id = w.id) = 1`) as { id: string; stripe_subscription_id: string | null }[];

    const ids = sole.map((w) => w.id);
    const files: string[] = [];
    if (ids.length) {
      const ads = (await q`SELECT video_url, thumbnail_url FROM ads WHERE workspace_id = ANY(${ids})`) as { video_url: string; thumbnail_url: string | null }[];
      const jobs = (await q`SELECT output_url, data FROM jobs WHERE workspace_id = ANY(${ids})`) as { output_url: string | null; data: JobData }[];
      for (const a of ads) files.push(a.video_url, a.thumbnail_url ?? "");
      for (const j of jobs) {
        files.push(j.output_url ?? "");
        for (const s of j.data?.voice?.scenes ?? []) files.push(s.audioUrl ?? "");
      }
    }

    for (const w of sole) {
      if (w.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
        await stripe(`subscriptions/${w.stripe_subscription_id}`, undefined, "DELETE").catch((e) => console.error("cancel subscription", e));
      }
    }
    if (ids.length) await q`DELETE FROM workspaces WHERE id = ANY(${ids})`;
    await q`DELETE FROM invites WHERE email = ${ctx.user.email}`;
    await q`DELETE FROM users WHERE id = ${ctx.user.id}`;

    const blobs = files.filter((u) => /\.blob\.vercel-storage\.com\//.test(u));
    for (let i = 0; i < blobs.length; i += 100) {
      await del(blobs.slice(i, i + 100)).catch((e) => console.error("blob delete", e));
    }

    await destroySession();
    return Response.json({ ok: true, workspacesDeleted: ids.length, filesDeleted: blobs.length });
  } catch (e) {
    return jsonError(e);
  }
}
