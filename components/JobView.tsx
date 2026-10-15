"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobRow } from "@/lib/pipeline";

type Job = JobRow & { stepLabel?: string };

const FLOWS: Record<string, { key: string; label: string }[]> = {
  dub: [
    { key: "adapt", label: "Rewrite the script for the market" },
    { key: "dub_submit", label: "Send to ElevenLabs" },
    { key: "dub_wait", label: "Dub voices in the new language" },
    { key: "mux", label: "Put the new audio on your footage" },
  ],
  regenerate: [
    { key: "adapt", label: "Rewrite the script into scenes" },
    { key: "voice", label: "Record the voiceover" },
    { key: "talent_submit", label: "Cast a local presenter" },
    { key: "talent_wait", label: "Generate the presenter" },
    { key: "clips_submit", label: "Send scenes to Higgsfield" },
    { key: "clips_wait", label: "Generate lip-synced scenes" },
    { key: "stitch", label: "Edit scenes into one ad" },
  ],
};

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function JobView({ initial, adName, adVideo }: { initial: Job; adName: string; adVideo: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job>(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const active = job.status === "queued" || job.status === "running";

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok && !stop) {
        const j = await res.json();
        setJob(j.job);
        if (j.job.status === "completed" || j.job.status === "failed") router.refresh();
      }
    };
    const t = setInterval(tick, 4000);
    tick();
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [active, job.id, router]);

  async function retry() {
    setRetrying(true);
    setRetryError("");
    const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setRetrying(false);
    if (!res.ok) return setRetryError(j.error ?? "Retry couldn't start.");
    setJob({ ...job, status: "running", error: null });
    router.refresh();
  }

  const flow = FLOWS[job.mode] ?? [];
  const idx = job.status === "completed" ? flow.length : Math.max(0, flow.findIndex((s) => s.key === job.step));
  const a = job.data.adaptation;
  const talent = job.data.talent?.imageUrl;
  const failed = job.status === "failed";

  return (
    <div className="two-col">
      <div className="stack" style={{ gap: 20 }}>
        {job.output_url ? (
          <div className="player">
            <video src={job.output_url} controls playsInline autoPlay muted />
          </div>
        ) : (
          <div className="pending-frame" role="status">
            <div className="display" style={{ fontSize: 26 }}>{failed ? "This version didn't finish" : job.stepLabel ?? "Starting"}</div>
            {active && (
              <div className="bar" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
                <i style={{ width: `${job.progress}%` }} />
              </div>
            )}
            <p style={{ color: "#c9d1e0", fontSize: 15 }}>
              {failed ? "Your credits were refunded. See the reason under the steps." : "You can leave this page. Progress continues and your video will be here when it's ready."}
            </p>
          </div>
        )}
        <div className="row wrap">
          {job.output_url && <a className="btn primary" href={job.output_url} download>Download MP4</a>}
          <a className="btn" href={adVideo} target="_blank" rel="noreferrer">Open original</a>
          {failed && <button className="btn dark" onClick={retry} disabled={retrying}>{retrying ? "Retrying" : "Retry"}</button>}
        </div>
        {retryError && <div className="error" role="alert">{retryError}</div>}

        <section className="panel pad" aria-labelledby="steps-title">
          <h2 id="steps-title" className="section-title">Progress</h2>
          <ol className="steps">
            {flow.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? (failed ? "fail" : "now") : "";
              return (
                <li key={s.key} className={state} aria-current={state === "now" ? "step" : undefined}>
                  <span className="n">{state === "done" ? <Check /> : i + 1}</span>
                  {s.label}
                </li>
              );
            })}
          </ol>
          {job.error && <div className="notice bad" style={{ marginTop: 14 }}>{job.error}</div>}
        </section>

        {talent && (
          <section className="panel pad stack" style={{ gap: 12 }} aria-labelledby="talent-title">
            <h2 id="talent-title" className="section-title" style={{ marginBottom: 0 }}>Presenter</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={talent} alt={`Presenter generated for ${job.region_label}`} style={{ borderRadius: 10, maxHeight: 340, objectFit: "cover" }} />
          </section>
        )}
      </div>

      <div className="stack" style={{ gap: 20 }}>
        <dl className="kv panel pad">
          <dt>Original</dt><dd>{adName}</dd>
          <dt>Market</dt><dd>{job.region_label}, {job.locale}</dd>
          <dt>Method</dt><dd>{job.mode === "dub" ? "Dubbed with ElevenLabs on your original footage" : "Regenerated with Higgsfield, voiced with ElevenLabs"}</dd>
          <dt>Credits</dt><dd className="num">{job.credits_reserved ? job.credits_reserved : failed ? "Refunded" : "None"}</dd>
        </dl>

        {a ? (
          <>
            <section className="panel pad stack" style={{ gap: 14 }} aria-labelledby="script-title">
              <h2 id="script-title" className="section-title" style={{ marginBottom: 0 }}>Script for {job.region_label}</h2>
              <p className="muted">{a.headline_insight}</p>
              <p className="script" lang={job.locale}>{a.adapted_script}</p>
              <details>
                <summary className="label" style={{ cursor: "pointer" }}>English back-translation</summary>
                <p className="script muted" style={{ marginTop: 10, fontSize: 15 }}>{a.back_translation}</p>
              </details>
              {job.mode === "dub" && (
                <p className="faint">In Dub mode ElevenLabs translates from your original audio to keep the timing. Use this script to check the meaning and to update on-screen text.</p>
              )}
            </section>

            {a.compliance_flags?.length > 0 && (
              <div className="notice warn">
                <strong>Check before launch</strong>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{a.compliance_flags.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}

            {a.cultural_changes?.length > 0 && (
              <section className="panel pad" aria-labelledby="changes-title">
                <h2 id="changes-title" className="section-title">What changed for this market</h2>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>{a.cultural_changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </section>
            )}

            {a.on_screen_text?.length > 0 && (
              <section className="panel" style={{ overflowX: "auto" }} aria-label="On-screen text replacements">
                <table className="list">
                  <thead><tr><th scope="col">On-screen text</th><th scope="col">Replace with</th></tr></thead>
                  <tbody>{a.on_screen_text.map((t, i) => <tr key={i}><td className="muted">{t.original}</td><td lang={job.locale}>{t.localized}</td></tr>)}</tbody>
                </table>
              </section>
            )}

            {job.mode === "regenerate" && (
              <section className="panel pad" aria-labelledby="scenes-title">
                <h2 id="scenes-title" className="section-title">Scenes</h2>
                <ol className="steps">
                  {a.scenes.map((s, i) => (
                    <li key={i} style={{ alignItems: "start" }}>
                      <span className="n">{i + 1}</span>
                      <div className="stack" style={{ gap: 4 }}>
                        <span style={{ color: "var(--ink)" }} lang={job.locale}>{s.voiceover}</span>
                        <span className="faint">{s.visual}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        ) : (
          <div className="panel pad muted">The rewritten script appears here once the first step finishes, usually within 30 seconds.</div>
        )}

        {job.data.log && job.data.log.length > 0 && (
          <details className="panel pad">
            <summary className="label" style={{ cursor: "pointer" }}>Activity</summary>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
              {job.data.log.slice().reverse().map((l, i) => (
                <li key={i} className="faint"><span className="num">{new Date(l.t).toLocaleTimeString("en-GB")}</span> {l.msg}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
