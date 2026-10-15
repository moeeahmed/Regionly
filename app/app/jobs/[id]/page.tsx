import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { STEP_LABELS, type JobRow } from "@/lib/pipeline";
import { LocaleTag } from "@/components/LocaleTag";
import { JobView } from "@/components/JobView";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const q = await db();
  const rows = (await q`
    SELECT j.*, a.name AS ad_name, a.video_url AS ad_video FROM jobs j JOIN ads a ON a.id = j.ad_id
    WHERE j.id = ${id} AND j.workspace_id = ${ctx.workspace.id}`) as (JobRow & { ad_name: string; ad_video: string })[];
  const row = rows[0];
  if (!row) notFound();
  const { ad_name, ad_video, ...job } = row;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href={`/app/ads/${job.ad_id}`} className="back">Back to {ad_name}</Link>
          <h1 className="row" style={{ gap: 14 }}><LocaleTag code={job.region_code} />{job.region_label}</h1>
        </div>
      </div>
      <JobView initial={{ ...job, stepLabel: STEP_LABELS[job.step] }} adName={ad_name} adVideo={ad_video} />
    </>
  );
}
