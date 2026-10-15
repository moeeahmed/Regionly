import { after } from "next/server";
import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { db } from "@/lib/db";
import { reserveCredits } from "@/lib/credits";
import { advanceJob, type JobRow } from "@/lib/pipeline";
import { estimateCredits } from "@/lib/config";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await apiCtx();
    const { id } = await params;
    const q = await db();
    const rows = (await q`
      SELECT j.*, a.duration_sec FROM jobs j JOIN ads a ON a.id = j.ad_id
      WHERE j.id = ${id} AND j.workspace_id = ${ctx.workspace.id}`) as (JobRow & { duration_sec: number })[];
    const job = rows[0];
    if (!job) throw new HttpError(404, "That version doesn't exist in this workspace.");
    if (job.status !== "failed") throw new HttpError(400, "Only versions that failed can be retried.");
    const cost = estimateCredits(job.mode, job.duration_sec);
    await reserveCredits(ctx.workspace.id, cost, `Retry ${job.region_label}`, job.id);
    await q`UPDATE jobs SET status = 'running', attempts = 0, error = NULL, credits_reserved = ${cost}, locked_until = NULL, updated_at = now() WHERE id = ${id}`;
    after(() => advanceJob(id, 240_000));
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
