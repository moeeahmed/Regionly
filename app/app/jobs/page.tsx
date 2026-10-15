import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { JobTable, type JobListRow } from "@/components/JobTable";
import { AutoRefresh } from "@/components/AutoRefresh";

export default async function Jobs() {
  const ctx = await requireCtx();
  const q = await db();
  const jobs = (await q`
    SELECT j.id, a.name AS ad_name, a.id AS ad_id, j.region_code, j.region_label, j.mode, j.status, j.step, j.progress, j.created_at, j.output_url
    FROM jobs j JOIN ads a ON a.id = j.ad_id
    WHERE j.workspace_id = ${ctx.workspace.id}
    ORDER BY j.created_at DESC LIMIT 200`) as JobListRow[];
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");

  return (
    <>
      <AutoRefresh active={active.length > 0} pingJobIds={active.map((j) => j.id)} />
      <div className="page-head">
        <div>
          <h1>Localisations</h1>
          <p className="sub">Every market version across all your ads.</p>
        </div>
      </div>
      {jobs.length === 0 ? (
        <div className="panel empty">
          <h2>No localisations yet</h2>
          <p className="muted">Open an ad and choose the markets you want it in.</p>
          <Link href="/app" className="btn">Go to ads</Link>
        </div>
      ) : (
        <JobTable jobs={jobs} showAd />
      )}
    </>
  );
}
