"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconArrow, IconCheck, IconFilm, IconSwap, IconUsers, IconVoice } from "@/components/Icons";
import { FEATURES } from "@/lib/content/features";

const ICONS: Record<string, React.ReactNode> = {
  dub: <IconVoice size={22} />,
  regenerate: <IconFilm size={22} />,
  "back-translation": <IconSwap size={22} />,
  workspaces: <IconUsers size={22} />,
};

const SHORT: Record<string, string> = {
  dub: "Re-voice the original in each speaker's cloned voice.",
  regenerate: "Film it again with a local presenter and setting.",
  "back-translation": "Read every version in English before it runs.",
  workspaces: "Share ads, versions and credits with your team.",
};

/** A list of features on the left that swaps the panel on the right. Advances on its own until someone picks one. */
export function FeatureTabs() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAuto(false);
  }, []);

  const f = FEATURES[i];
  return (
    <div className="ftabs" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="ftabs-list" role="tablist" aria-label="Features">
        {FEATURES.map((x, n) => (
          <button
            key={x.slug}
            type="button"
            role="tab"
            id={`ftab-${x.slug}`}
            aria-selected={n === i}
            aria-controls="ftab-panel"
            className={`ftab ${n === i ? "on" : ""}`}
            onClick={() => {
              setI(n);
              setAuto(false);
            }}
          >
            <span className="ftab-ic">{ICONS[x.slug]}</span>
            <span className="ftab-txt">
              <b>{x.name}</b>
              <small>{SHORT[x.slug]}</small>
            </span>
            {n === i && auto && (
              <span
                className="ftab-bar"
                style={{ animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={() => setI((k) => (k + 1) % FEATURES.length)}
              />
            )}
          </button>
        ))}
      </div>
      <div className="ftabs-stage">
        <div className="ftabs-card" role="tabpanel" id="ftab-panel" aria-labelledby={`ftab-${f.slug}`} key={f.slug}>
          <p className="ftabs-kicker">{ICONS[f.slug]} {f.name}</p>
          <h3>{f.title}</h3>
          <p className="ftabs-sub">{f.sub}</p>
          <ul className="ftabs-points">
            {f.points.map((p) => (
              <li key={p.title}><IconCheck size={16} /><span><b>{p.title}</b>{p.text}</span></li>
            ))}
          </ul>
          <div className="ftabs-foot">
            <span className="ftabs-cost">{f.cost}</span>
            <Link href={`/features/${f.slug}`} className="work-link">Learn more <IconArrow size={16} /></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
