"use client";

import { useMemo, useState } from "react";
import { estimateCredits, PLANS } from "@/lib/config";

/** Works out the credits a localisation run needs and which plan covers it. */
export function CostEstimator() {
  const [seconds, setSeconds] = useState(30);
  const [markets, setMarkets] = useState(3);
  const [mode, setMode] = useState<"dub" | "regenerate">("dub");
  const [adsPerMonth, setAds] = useState(4);

  const per = estimateCredits(mode, seconds);
  const perAd = per * markets;
  const monthly = perAd * adsPerMonth;
  const plan = monthly <= 30 ? "Free covers your first run" : monthly <= PLANS.starter.credits ? "Starter (£29/month) covers this" : monthly <= PLANS.growth.credits ? "Growth (£99/month) covers this" : `Growth plus ${Math.ceil((monthly - PLANS.growth.credits) / PLANS.pack.credits)} top-up pack(s)`;

  return (
    <div className="tool" id="cost">
      <div className="tool-in">
        <label className="tool-field">
          <span>Ad length <b>{seconds} s</b></span>
          <input type="range" min={6} max={180} step={1} value={seconds} onChange={(e) => setSeconds(+e.target.value)} />
        </label>
        <label className="tool-field">
          <span>Markets <b>{markets}</b></span>
          <input type="range" min={1} max={30} step={1} value={markets} onChange={(e) => setMarkets(+e.target.value)} />
        </label>
        <label className="tool-field">
          <span>Ads a month <b>{adsPerMonth}</b></span>
          <input type="range" min={1} max={20} step={1} value={adsPerMonth} onChange={(e) => setAds(+e.target.value)} />
        </label>
        <div className="tool-seg" role="group" aria-label="Method">
          <button type="button" aria-pressed={mode === "dub"} onClick={() => setMode("dub")}>Dub</button>
          <button type="button" aria-pressed={mode === "regenerate"} onClick={() => setMode("regenerate")}>Regenerate</button>
        </div>
      </div>
      <div className="tool-out" aria-live="polite">
        <p><span>Per market</span><b>{per} credits</b></p>
        <p><span>Per ad</span><b>{perAd} credits</b></p>
        <p><span>Per month</span><b>{monthly} credits</b></p>
        <p className="tool-plan">{plan}</p>
      </div>
    </div>
  );
}

const WPS: Record<string, number> = { English: 2.6, Spanish: 2.9, German: 2.3, French: 2.8, Portuguese: 2.8 };

/** Rough check of whether a line fits the seconds it has, and how long it runs as a caption. */
export function LineFit() {
  const [text, setText] = useState("Brewly pods work out at 40p a cup.");
  const [secs, setSecs] = useState(3);
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);
  const chars = text.length;
  return (
    <div className="tool" id="fit">
      <div className="tool-in">
        <label className="tool-field">
          <span>Your line</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        </label>
        <label className="tool-field">
          <span>Seconds available <b>{secs} s</b></span>
          <input type="range" min={1} max={15} step={0.5} value={secs} onChange={(e) => setSecs(+e.target.value)} />
        </label>
      </div>
      <div className="tool-out" aria-live="polite">
        <p><span>Words</span><b>{words}</b></p>
        <p><span>Characters</span><b>{chars}{chars > 42 ? " (two caption lines)" : ""}</b></p>
        {Object.entries(WPS).map(([lang, w]) => {
          const need = words / w;
          return <p key={lang}><span>{lang}</span><b className={need > secs ? "over" : "ok"}>{need.toFixed(1)} s {need > secs ? "· too long" : "· fits"}</b></p>;
        })}
        <p className="tool-note">Rough guide using typical ad speaking speeds. Translations often change the word count, so leave room.</p>
      </div>
    </div>
  );
}
