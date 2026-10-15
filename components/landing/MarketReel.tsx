"use client";

import { useEffect, useState } from "react";
import { MARKETS, photoUrl } from "@/lib/demo";

/** A 9:16 frame that cycles through the finished market versions of the example ad. */
export function MarketReel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % MARKETS.length), 3200);
    return () => clearInterval(id);
  }, []);
  const m = MARKETS[i];
  return (
    <figure className="reel">
      {MARKETS.map((mk, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={mk.locale} src={photoUrl(mk.photo, 540, 960)} width={540} height={960} alt="" className={n === i ? "on" : ""} loading="lazy" />
      ))}
      <figcaption className="reel-tag"><b>{m.locale}</b> {m.label}</figcaption>
      <p className="reel-cap" dir={m.rtl ? "rtl" : "ltr"} lang={m.locale}><span key={m.locale}>{m.lines[1].text}</span></p>
      <div className="reel-dots" aria-hidden>
        {MARKETS.map((mk, n) => <i key={mk.locale} className={n === i ? "on" : ""} />)}
      </div>
    </figure>
  );
}
