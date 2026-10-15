import Link from "next/link";
import { STEP_LABELS } from "@/lib/pipeline";
import { StatusPill } from "@/components/StatusPill";
import { LocaleTag } from "@/components/LocaleTag";

export type JobListRow = { id: string; ad_name?: string; ad_id?: string; region_code: string; region_label: string; mode: string; status: string; step: string; progress: number; created_at: string; output_url: string | null };

export function JobTable({ jobs, showAd = false }: { jobs: JobListRow[]; showAd?: boolean }) {
  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <table className="list">
        <thead>
          <tr>
            <th scope="col">Market</th>
            {showAd && <th scope="col">Ad</th>}
            <th scope="col">Mode</th>
            <th scope="col">Status</th>
            <th scope="col">Progress</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <Link href={`/app/jobs/${j.id}`} className="market"><LocaleTag code={j.region_code} />{j.region_label}</Link>
              </td>
              {showAd && <td className="muted">{j.ad_name ?? ""}</td>}
              <td>{j.mode === "dub" ? "Dub" : "Regenerate"}</td>
              <td><StatusPill status={j.status} label={j.status === "running" ? STEP_LABELS[j.step] ?? undefined : undefined} /></td>
              <td>
                <div className="bar" role="progressbar" aria-valuenow={j.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${j.region_label} progress`}>
                  <i style={{ width: `${j.progress}%` }} />
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                {j.output_url ? (
                  <a className="btn sm" href={j.output_url} download>Download</a>
                ) : (
                  <Link className="btn sm ghost" href={`/app/jobs/${j.id}`}>View</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
