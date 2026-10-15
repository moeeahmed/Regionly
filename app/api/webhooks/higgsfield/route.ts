import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { advanceJob, webhookSig } from "@/lib/pipeline";

export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  const expected = webhookSig(job);
  if (!job || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return Response.json({ error: "bad signature" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { request_id?: string; status?: string } | null;
  if (!body?.request_id || !body.status) return Response.json({ error: "bad payload" }, { status: 400 });
  // The pipeline re-reads status from the API, so we only need to wake the job up.
  after(() => advanceJob(job, 240_000));
  return Response.json({ ok: true });
}
