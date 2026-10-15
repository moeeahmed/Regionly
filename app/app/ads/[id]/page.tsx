import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import type { AdRow } from "@/lib/pipeline";
import { LocalizeForm } from "@/components/LocalizeForm";
import { JobTable, type JobListRow } from "@/components/JobTable";
import { AutoRefresh } from "@/components/AutoRefresh";

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const q = await db();
  const ads = (await q`SELECT * FROM ads WHERE id = ${id} AND workspace_id = ${ctx.workspace.id}`) as AdRow[];
  const ad = ads[0];
  if (!ad) notFound();
  const jobs = (await q`
    SELECT id, region_code, region_label, mode, status, step, progress, created_at, output_url
    FROM jobs WHERE ad_id = ${ad.id} ORDER BY created_at DESC`) as JobListRow[];
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const terms = ad.brand_terms.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);

  return (
    <>
      <AutoRefresh active={active.length > 0} pingJobIds={active.map((j) => j.id)} />
      <div className="page-head">
        <div>
          <Link href="/app" className="back">Back to ads</Link>
          <h1>{ad.name}</h1>
        </div>
      </div>

      <div className="sidebar-layout">
        <aside className="stack" style={{ gap: 16 }} aria-label="Original ad">
          <div className="player">
            <video src={ad.video_url} poster={ad.thumbnail_url ?? undefined} controls playsInline preload="metadata" />
          </div>
          <dl className="kv">
            <dt>Length</dt><dd className="num">{ad.duration_sec.toFixed(1)} seconds</dd>
            <dt>Format</dt><dd>{ad.aspect_ratio}</dd>
            <dt>Language</dt><dd>{ad.source_language ? ad.source_language.toUpperCase() : "No speech"}</dd>
            {terms.length > 0 && (
              <>
                <dt>Kept as-is</dt>
                <dd className="row wrap" style={{ gap: 6 }}>{terms.map((t) => <span key={t} className="tag">{t}</span>)}</dd>
              </>
            )}
          </dl>
          <details className="panel pad">
            <summary className="label" style={{ cursor: "pointer" }}>Original transcript</summary>
            <p className="script muted" style={{ marginTop: 12, fontSize: 15 }}>{ad.transcript || "No speech was detected. This ad is music or visuals only."}</p>
          </details>
        </aside>

        <div className="stack" style={{ gap: 32 }}>
          <LocalizeForm
            adId={ad.id}
            durationSec={ad.duration_sec}
            aspect={ad.aspect_ratio}
            sourceLanguage={ad.source_language}
            hasSpeech={!!ad.transcript}
            credits={ctx.workspace.credits}
          />
          {jobs.length > 0 && (
            <section className="stack" style={{ gap: 12 }} aria-labelledby="markets-title">
              <h2 id="markets-title" className="section-title" style={{ marginBottom: 0 }}>Market versions</h2>
              <JobTable jobs={jobs} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
