"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { estimateCredits } from "@/lib/config";
import { ASPECTS, REGIONS } from "@/lib/regions";

type Voice = { id: string; name: string; category: string; accent: string; gender: string; preview: string | null };

export function LocalizeForm(props: { adId: string; durationSec: number; aspect: string; sourceLanguage: string | null; hasSpeech: boolean; credits: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"dub" | "regenerate">(props.hasSpeech ? "dub" : "regenerate");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [aspect, setAspect] = useState(props.aspect);
  const [direction, setDirection] = useState("");
  const [useProductFrame, setUseProductFrame] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "regenerate" || voices) return;
    fetch("/api/voices")
      .then((r) => r.json())
      .then((j) => setVoices(j.voices ?? []))
      .catch(() => setVoices([]));
  }, [mode, voices]);

  const src = (props.sourceLanguage ?? "").slice(0, 2).toLowerCase();
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return REGIONS.filter((r) => !f || r.label.toLowerCase().includes(f) || r.language.toLowerCase().includes(f) || r.locale.toLowerCase().includes(f));
  }, [filter]);

  const perJob = estimateCredits(mode, props.durationSec);
  const total = perJob * picked.length;
  const isSame = (code: string) => REGIONS.find((r) => r.code === code)?.dubLang.slice(0, 2) === src;
  const blocked = mode === "dub" ? picked.filter(isSame) : [];
  const short = total > props.credits;

  function toggle(code: string) {
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  }

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/ads/${props.adId}/localize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ regions: picked, mode, voiceId: voiceId || undefined, aspect, extraDirection: direction, useProductFrame }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Localisation couldn't start. Try again.");
    setPicked([]);
    router.refresh();
  }

  return (
    <section className="panel pad stack" style={{ gap: 22 }} aria-labelledby="localise-title">
      <div>
        <h2 id="localise-title" style={{ fontSize: "var(--step-2)" }}>Localise this ad</h2>
        <p className="muted" style={{ marginTop: 4 }}>Choose how, then pick the markets.</p>
      </div>

      <div className="segmented" role="group" aria-label="Localisation method">
        <button type="button" aria-pressed={mode === "dub"} onClick={() => setMode("dub")} disabled={!props.hasSpeech}>
          <strong>Dub</strong>
          <span>{props.hasSpeech ? "Same footage, re-voiced in each language with the speaker's own cloned voice." : "No speech was found in this ad, so there's nothing to dub."}</span>
        </button>
        <button type="button" aria-pressed={mode === "regenerate"} onClick={() => setMode("regenerate")}>
          <strong>Regenerate</strong>
          <span>New native script, local presenter and lip-synced scenes.</span>
        </button>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <div className="row between wrap">
          <span className="label">{picked.length === 0 ? "Markets" : `${picked.length} market${picked.length === 1 ? "" : "s"} selected`}</span>
          <label className="row" style={{ gap: 8 }}>
            <span className="visually-hidden">Search markets</span>
            <input type="text" placeholder="Search markets" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 220, minHeight: 40 }} />
          </label>
        </div>
        <div className="region-list">
          {shown.map((r) => {
            const same = mode === "dub" && r.dubLang.slice(0, 2) === src;
            return (
              <button
                type="button"
                key={r.code}
                className={`region ${same ? "same" : ""}`}
                aria-pressed={picked.includes(r.code)}
                onClick={() => toggle(r.code)}
                title={same ? "Already speaks the ad's language. Use Regenerate for this market." : r.notes}
              >
                <span className="loc">{r.locale}</span>
                <span>
                  <span className="rn">{r.label}</span>
                  <small>{same ? "Same language as the ad" : r.language}</small>
                </span>
              </button>
            );
          })}
          {shown.length === 0 && <p className="muted">No market matches &ldquo;{filter}&rdquo;.</p>}
        </div>
      </div>

      {mode === "regenerate" && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label className="field">
            Voice
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
              <option value="">{voices === null ? "Loading your ElevenLabs voices" : "Default voice"}</option>
              {(voices ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.name, v.accent, v.gender].filter(Boolean).join(", ")}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Format
            <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
              {Object.keys(ASPECTS).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            Direction for the new version
            <span className="hint">Optional. Casting, setting or tone.</span>
            <textarea value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Presenter in her 30s, home kitchen, keep the three-reasons structure" />
          </label>
          <label className="row" style={{ gridColumn: "1 / -1", fontSize: 15, alignItems: "flex-start" }}>
            <input type="checkbox" checked={useProductFrame} onChange={(e) => setUseProductFrame(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Match the product to the original. A frame from your ad is used as a reference for how the product looks.</span>
          </label>
        </div>
      )}

      {blocked.length > 0 && (
        <div className="notice warn">
          {blocked.map((c) => REGIONS.find((r) => r.code === c)?.label).join(", ")} already {blocked.length === 1 ? "speaks" : "speak"} the ad&apos;s language, so a dub wouldn&apos;t change anything. Switch to Regenerate, or deselect {blocked.length === 1 ? "it" : "them"}.
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}

      <hr className="divider" />
      <div className="row between wrap">
        <p className="muted">
          {picked.length === 0
            ? `${perJob} credits per market.`
            : short
              ? `Needs ${total} credits and you have ${props.credits}. Top up on the Billing page.`
              : `Uses ${total} credits of your ${props.credits}.`}
        </p>
        <button className="btn primary" disabled={busy || !picked.length || blocked.length > 0 || short} onClick={submit}>
          {busy ? "Starting" : picked.length ? `Localise for ${picked.length} market${picked.length === 1 ? "" : "s"}` : "Localise"}
        </button>
      </div>
    </section>
  );
}
