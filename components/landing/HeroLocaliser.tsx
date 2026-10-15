"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_LENGTH, MARKETS, ORIGINAL, PIPELINE, photoUrl, type DemoMarket } from "@/lib/demo";

const TICK = 0.1;
const STEP_TIME = 0.6;
const PROCESS_TIME = STEP_TIME * PIPELINE.length;

function lineAt(m: DemoMarket, t: number) {
  return m.lines.find((l) => t >= l.start && t < l.end) ?? m.lines[0];
}

function Frame({ market, t, label, busy, step }: { market: DemoMarket; t: number; label: string; busy?: boolean; step?: number }) {
  const line = lineAt(market, t);
  return (
    <figure className="ui-frame">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={market.photo}
        className={`ui-frame-img ${busy ? "is-busy" : ""}`}
        src={photoUrl(market.photo, 360, 640)}
        width={360}
        height={640}
        alt=""
      />
      <figcaption className="ui-frame-tag">
        <b>{market.locale}</b> {label}
      </figcaption>
      {busy ? (
        <p className="ui-frame-busy" role="status">
          <span className="ui-spin" aria-hidden />
          {PIPELINE[Math.min(step ?? 0, PIPELINE.length - 1)]}
        </p>
      ) : (
        <p className="ui-frame-cap" dir={market.rtl ? "rtl" : "ltr"} lang={market.locale}>
          <span key={`${market.locale}-${line.start}`}>{line.text}</span>
        </p>
      )}
    </figure>
  );
}

/** The hero's working fragment: pick a market and watch the ad come back rewritten for it. */
export function HeroLocaliser() {
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(4);
  const [run, setRun] = useState(PROCESS_TIME + 1);
  const [playing, setPlaying] = useState(false);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const tRef = useRef<number>(4);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      tRef.current = 0;
      setT(0);
      setRun(0);
      setPlaying(true);
    }
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    const id = setInterval(() => {
      let next = tRef.current + TICK;
      if (next >= DEMO_LENGTH) {
        next = 0;
        if (auto) {
          setIdx((i) => (i + 1) % MARKETS.length);
          setRun(0);
        } else setRun((r) => r + TICK);
      } else setRun((r) => r + TICK);
      tRef.current = next;
      setT(next);
    }, TICK * 1000);
    return () => clearInterval(id);
  }, [playing, visible, auto]);

  function pick(i: number) {
    setAuto(false);
    setIdx(i);
    tRef.current = 0;
    setT(0);
    setRun(0);
    setPlaying(true);
  }

  const market = MARKETS[idx];
  const busy = run < PROCESS_TIME;
  const step = Math.floor(run / STEP_TIME);
  const active = lineAt(ORIGINAL, t);
  const rewriting = busy && run < STEP_TIME * 2;

  return (
    <div className="ui-localiser" data-ui ref={rootRef}>
      <div className="ui-head">
        <div>
          <p className="ui-title">Summer hook v3</p>
          <p className="ui-sub">Example ad · 12 s · 9:16 · English (UK)</p>
        </div>
        <button type="button" className="ui-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause the example" : "Play the example"}>
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><rect x="1.5" y="1" width="3" height="10" rx="0.5" fill="currentColor" /><rect x="7.5" y="1" width="3" height="10" rx="0.5" fill="currentColor" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 1v10l8.5-5z" fill="currentColor" /></svg>
          )}
        </button>
      </div>

      <div className="ui-tabs" role="tablist" aria-label="Choose a market">
        {MARKETS.map((m, i) => (
          <button key={m.locale} type="button" role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => pick(i)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="ui-body">
        <Frame market={ORIGINAL} t={t} label="Original" />
        <Frame market={market} t={t} label={market.label} busy={busy} step={step} />
        <div className="ui-side">
          <ol className="ui-steps" aria-label={`Localising for ${market.label}`}>
            {PIPELINE.map((s, i) => {
              const done = run >= STEP_TIME * (i + 1);
              const now = !done && step === i;
              return (
                <li key={s} className={done ? "done" : now ? "now" : ""}>
                  <span className="ui-tick" aria-hidden>{done && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
                  {s}
                </li>
              );
            })}
          </ol>
          <ul className="ui-script" aria-label="Script, original and rewritten">
            {ORIGINAL.lines.map((l, i) => (
              <li key={l.start} className={active.start === l.start ? "now" : ""}>
                <span className="src">{l.text}</span>
                <span className={`dst ${rewriting ? "wait" : ""}`} dir={market.rtl ? "rtl" : "ltr"} lang={market.locale}>
                  {rewriting ? "Rewriting…" : market.lines[i].text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ui-track" aria-hidden>
        {ORIGINAL.lines.map((l) => <span key={l.start} className={active.start === l.start ? "now" : ""} />)}
        <i style={{ transform: `translateX(${(t / DEMO_LENGTH) * 100}cqw)` }} />
      </div>

      <div className="ui-changes">
        <p>What changed for {market.label}</p>
        <ul>{market.changes.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
    </div>
  );
}
