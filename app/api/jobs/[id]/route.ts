import { after } from "next/server";
import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceJob, STEP_LABELS, type JobRow } from "@/lib/pipeline";

export const maxDuration = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await apiCtx();
    const { id } = await params;
    const q = await db();
    const rows = (await q`SELECT *, (locked_until IS NOT NULL AND locked_until > now()) AS busy FROM jobs WHERE id = ${id} AND workspace_id = ${ctx.workspace.id}`) as (JobRow & { busy: boolean })[];
    const job = rows[0];
    if (!job) throw new HttpError(404, "That version doesn't exist in this workspace.");
    if ((job.status === "queued" || job.status === "running") && !job.busy) {
      after(() => advanceJob(job.id, 240_000));
    }
    return Response.json({ job: { ...job, stepLabel: STEP_LABELS[job.step] ?? job.step } });
  } catch (e) {
    return jsonError(e);
  }
}
