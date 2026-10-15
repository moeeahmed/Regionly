"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function UploadAd() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analysing">("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f?: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/")) return setError("That file isn't a video. Choose an MP4, MOV or WebM.");
    if (f.size > 500 * 1024 * 1024) return setError("That video is over 500 MB. Export a smaller version and try again.");
    setError("");
    setFile(f);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("Choose a video to upload.");
    const form = new FormData(e.currentTarget);
    setError("");
    try {
      setPhase("uploading");
      const blob = await upload(`ads/${file.name.replace(/[^\w.-]+/g, "_")}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob",
        contentType: file.type,
        onUploadProgress: (p) => setPct(Math.round(p.percentage)),
      });
      setPhase("analysing");
      const res = await fetch("/api/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name") || file.name.replace(/\.[^.]+$/, ""),
          videoUrl: blob.url,
          brandTerms: form.get("brandTerms"),
          productNotes: form.get("productNotes"),
          performanceNotes: form.get("performanceNotes"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The ad couldn't be analysed. Try uploading it again.");
      router.push(`/app/ads/${json.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";

  return (
    <form onSubmit={onSubmit} className="two-col">
      <div className="stack">
        <label
          className={`dropzone ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
          style={{ cursor: busy ? "default" : "pointer", display: "block" }}
        >
          <input type="file" accept="video/*" className="visually-hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
          {file ? (
            <>
              <video src={preview ?? undefined} muted playsInline controls style={{ maxHeight: 380, margin: "0 auto 14px", borderRadius: 10 }} />
              <div style={{ fontWeight: 600 }}>{file.name}</div>
              <div className="faint">{(file.size / 1024 / 1024).toFixed(1)} MB. Click to choose a different file.</div>
            </>
          ) : (
            <>
              <div className="display" style={{ fontSize: 26 }}>Drop your video here</div>
              <p className="muted" style={{ marginTop: 6 }}>or click to browse. MP4, MOV or WebM, up to 3 minutes and 500 MB.</p>
            </>
          )}
        </label>
        {busy && (
          <div className="notice" role="status">
            {phase === "uploading" ? `Uploading, ${pct}% done` : "Transcribing the voiceover and reading the format. This takes about a minute."}
            <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${phase === "uploading" ? pct : 100}%` }} /></div>
          </div>
        )}
      </div>

      <div className="panel pad stack" style={{ gap: 18 }}>
        <label className="field">Name<input type="text" name="name" placeholder="Summer hook v3" /></label>
        <label className="field">
          Words to keep as they are
          <span className="hint">Brand, product names and slogans, separated by commas.</span>
          <input type="text" name="brandTerms" placeholder="Brewly, ColdPress Pro" />
        </label>
        <label className="field">
          What&apos;s being sold
          <span className="hint">The product, the offer and the claims you&apos;re allowed to make.</span>
          <textarea name="productNotes" placeholder="Reusable coffee pods, 20% off first order, compostable" />
        </label>
        <label className="field">
          Why it performs
          <span className="hint">Optional. The hook, angle or metrics, so the rewrite keeps what works.</span>
          <textarea name="performanceNotes" placeholder="Money-saving hook in the first 2 seconds, 3.8x ROAS on Meta" />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy || !file}>{busy ? "Uploading" : "Upload and analyse"}</button>
        <p className="faint">Only upload ads you have the rights to localise, including the voices and faces in them.</p>
      </div>
    </form>
  );
}
