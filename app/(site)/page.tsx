import Link from "next/link";
import { HeroLocaliser } from "@/components/landing/HeroLocaliser";
import { MarketReel } from "@/components/landing/MarketReel";
import { FeatureTabs } from "@/components/landing/FeatureTabs";
import { ScrambleCycle, ScrambleIn } from "@/components/landing/Scramble";
import { CtaCard, Eyebrow, XRule } from "@/components/marketing/SiteChrome";
import { IconArrow, IconCheck, IconFilm, IconScript, IconShield, IconVoice, IconX } from "@/components/Icons";
import { isConfigured } from "@/lib/config";
import { MARKETS, ORIGINAL, photoUrl } from "@/lib/demo";
import { REGIONS } from "@/lib/regions";

export const dynamic = "force-dynamic";

/** What a word-for-word translation of the price line gives you: the price is never converted. */
const LITERAL: Record<string, string> = {
  "es-MX": "Las cápsulas Brewly salen a 40p la taza.",
  "de-DE": "Brewly-Kapseln kommen auf 40p pro Tasse.",
  "ja-JP": "Brewlyのポッドは1杯40pになります。",
};

/** The localised price in each market's version of the line. */
const PRICE: Record<string, string> = { "es-MX": "9 pesos", "de-DE": "45 Cent", "ja-JP": "約80円" };

const HERO_WORDS = ["every market", "Mexico", "Japan", "Germany", "Brazil", "the UAE", "Spain", "Korea"];

/** Splits `text` around the first `token` so the token can be styled or animated. */
function split(text: string, token: string): [string, string, string] {
  const i = text.indexOf(token);
  return i < 0 ? [text, "", ""] : [text.slice(0, i), token, text.slice(i + token.length)];
}

const PLANS = [
  {
    name: "Free",
    price: "£0",
    per: "to start",
    note: "No card needed",
    cta: "Localise your first ad",
    items: ["30 credits, enough to dub a one-minute ad into three markets", "Dub, regenerate and back-translations", "Compliance notes on every version"],
  },
  {
    name: "Starter",
    price: "£29",
    per: "a month",
    note: "For one brand",
    cta: "Choose Starter",
    items: ["200 credits a month", "Around 20 one-minute dubs, or 3 to 10 regenerated ads", "All 30 markets", "A shared team workspace"],
  },
  {
    name: "Growth",
    price: "£99",
    per: "a month",
    note: "For teams and agencies",
    cta: "Choose Growth",
    featured: true,
    items: ["800 credits a month", "Around 80 one-minute dubs, or 10 to 40 regenerated ads", "Room to test several hooks in every market", "Top-ups of 100 credits for £19 that never expire"],
  },
];

const STEPS = [
  { icon: <IconScript size={20} />, t: "Upload the ad that already sells", d: "It's transcribed in about a minute. List the brand words that must never change." },
  { icon: <IconVoice size={20} />, t: "Choose markets and a method", d: `Pick from ${REGIONS.length} markets, then dub the original or regenerate it. You see the credit cost first.` },
  { icon: <IconShield size={20} />, t: "Read it in English, then launch", d: "Check the back-translation and what changed, watch it beside the original, and download the MP4." },
];

function StillPhone({ i, className }: { i: number; className: string }) {
  const m = MARKETS[i];
  return (
    <figure className={`phone phone-side ${className}`} aria-hidden>
      <div className="still">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(m.photo, 420, 746)} width={420} height={746} alt="" />
        <figcaption className="reel-tag"><b>{m.locale}</b> {m.label}</figcaption>
        <p className="reel-cap" dir={m.rtl ? "rtl" : "ltr"}><span>{m.lines[1].text}</span></p>
      </div>
    </figure>
  );
}

export default function Landing() {
  const configured = isConfigured();
  return (
    <>
      {!configured && (
        <p className="lp-setup">
          This deployment isn&apos;t connected to its services yet. <Link href="/setup">Finish setup</Link>
        </p>
      )}

      {/* hero */}
      <section className="hx">
        <div className="hx-card">
          <div className="rings" aria-hidden />
          <div className="hx-copy">
            <p className="badge" data-rise>
              <span className="badge-stack" aria-hidden>{["MX", "JP", "DE", "AE", "BR"].map((c) => <i key={c}>{c}</i>)}</span>
              {REGIONS.length} markets · dub or recast
            </p>
            <h1 data-rise style={{ ["--i" as string]: 1 }}>
              Your best ad,<br />rewritten for<br />
              <ScrambleCycle className="hl" words={HERO_WORDS} label="every market" />
            </h1>
            <p className="hx-lede" data-rise style={{ ["--i" as string]: 2 }}>
              Regionly rewrites the video ad that already sells for each market, then re-voices it with ElevenLabs or films it
              again with Higgsfield. You read every version in English before it runs.
            </p>
            <div className="hx-ctas" data-rise style={{ ["--i" as string]: 3 }}>
              <Link href="/signup" className="lp-btn">Start free <IconArrow size={16} /></Link>
              <a href="#demo" className="lp-btn lp-btn-ghost">Watch it work</a>
            </div>
            <div className="works" data-rise style={{ ["--i" as string]: 4 }}>
              <p>Built on</p>
              <ul>
                <li><IconVoice size={15} />ElevenLabs voices</li>
                <li><IconFilm size={15} />Higgsfield video</li>
                <li><IconScript size={15} />Claude scripts</li>
                <li><span className="fmt" aria-hidden>9:16</span>Every ad format</li>
              </ul>
            </div>
          </div>
          <div className="fan" data-rise style={{ ["--i" as string]: 3 }}>
            <StillPhone i={0} className="fan-l" />
            <div className="phone fan-c"><MarketReel /></div>
            <StillPhone i={2} className="fan-r" />
          </div>
        </div>
      </section>

      {/* translated vs localised */}
      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="vs" data-reveal>
            <div className="vs-top">
              <div>
                <Eyebrow n="01" label="Why localise" light />
                <h2 className="lp-h2">A translation keeps the words. Regionly keeps <span className="hl">the sale.</span></h2>
              </div>
              <figure className="vs-source">
                <figcaption>Original line · en-GB</figcaption>
                <blockquote>{(() => { const [a, b, c] = split(ORIGINAL.lines[1].text, "40p"); return <>{a}<span className="tok">{b}</span>{c}</>; })()}</blockquote>
              </figure>
            </div>
            <div className="vs-grid">
              {MARKETS.slice(0, 3).map((m, n) => {
                const [la, lb, lc] = split(LITERAL[m.locale], "40p");
                const [ga, gb, gc] = split(m.lines[1].text, PRICE[m.locale]);
                return (
                  <article className="vs-card" key={m.locale} data-reveal style={{ ["--i" as string]: n + 1 }}>
                    <header><b>{m.locale}</b>{m.label}</header>
                    <div className="vs-bad">
                      <p className="vs-label"><span className="vs-ico" aria-hidden><IconX size={12} /></span>Word-for-word</p>
                      <p className="vs-text" lang={m.locale}>{la}<span className="tok-bad">{lb}</span>{lc}</p>
                      <p className="vs-why">Price left in pence. Nobody there pays in pence.</p>
                    </div>
                    <span className="vs-arrow" aria-hidden><IconArrow size={16} /></span>
                    <div className="vs-good">
                      <p className="vs-label"><span className="vs-ico" aria-hidden><IconCheck size={12} /></span>Regionly</p>
                      <p className="vs-text" lang={m.locale}>{ga}<ScrambleIn className="tok-good" text={gb} />{gc}</p>
                      <ul className="vs-chips">{m.changes.map((c) => <li key={c}>{c}</li>)}</ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <XRule />

      {/* live demo */}
      <section id="demo" className="lp-sec lp-sec-r">
        <div className="lp-wrap">
          <div className="sec-head sec-center" data-reveal>
            <Eyebrow n="02" label="Live example" />
            <h2 className="lp-h2">Watch one ad become <span className="hl">five.</span></h2>
            <p className="lp-sub">Pick a market and follow it through each step, from transcript to rewritten script to the finished version.</p>
          </div>
          <div className="stage" data-reveal>
            <span className="corner tl" aria-hidden /><span className="corner tr" aria-hidden />
            <span className="corner bl" aria-hidden /><span className="corner br" aria-hidden />
            <div className="stage-bg">
              <div className="demo-frame">
                <div className="demo-bar" aria-hidden>
                  <span className="dots"><i /><i /><i /></span>
                  <span className="live-dot" />Live
                  <span className="demo-brand">Brewly is an invented brand</span>
                </div>
                <div className="demo-body"><HeroLocaliser /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <XRule />

      {/* features */}
      <section id="features" className="lp-sec lp-sec-r">
        <div className="lp-wrap">
          <div className="sec-head" data-reveal>
            <Eyebrow n="03" label="Features" />
            <h2 className="lp-h2">Two ways to localise, and everything around them.</h2>
          </div>
          <div data-reveal><FeatureTabs /></div>
        </div>
      </section>

      {/* process */}
      <section id="how" className="lp-sec">
        <div className="lp-wrap">
          <div className="panel" data-reveal>
            <div className="sec-head sec-center">
              <Eyebrow n="04" label="How it works" />
              <h2 className="lp-h2">From upload to launch in an <span className="hl">afternoon.</span></h2>
            </div>
            <ol className="how">
              {STEPS.map((s, i) => (
                <li key={s.t} data-reveal style={{ ["--i" as string]: i }}>
                  <span className="how-top"><span className="how-ic">{s.icon}</span><span className="how-n">Step {i + 1}</span></span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <XRule />

      {/* markets */}
      <section className="lp-sec lp-sec-r">
        <div className="lp-wrap">
          <div className="sec-head sec-head-row" data-reveal>
            <div>
              <Eyebrow n="05" label="Markets" />
              <h2 className="lp-h2">{REGIONS.length} markets, each with its own playbook.</h2>
            </div>
            <p className="lp-sub">Tone, register, currency and the claims that land, written down for every market and used in every rewrite.</p>
          </div>
          <ul className="markets" data-reveal>
            {REGIONS.map((r) => (
              <li key={r.code}><b>{r.locale}</b><span>{r.label}</span><small>{r.currency}</small></li>
            ))}
          </ul>
        </div>
      </section>

      <XRule />

      {/* pricing */}
      <section id="pricing" className="lp-sec lp-sec-r">
        <div className="lp-wrap">
          <div className="sec-head sec-center" data-reveal>
            <Eyebrow n="06" label="Pricing" />
            <h2 className="lp-h2">Pay in <span className="hl">credits,</span> not retainers.</h2>
            <p className="lp-sub">Dubbing uses 10 credits per minute of ad, per market. A regenerated ad uses 20 to 80. Failed versions are refunded automatically.</p>
          </div>
          <div className="price">
            {PLANS.map((p, n) => (
              <div key={p.name} className={`price-col ${p.featured ? "feat" : ""}`} data-reveal style={{ ["--i" as string]: n }}>
                <p className="price-note">{p.note}{p.featured && <span className="price-flag">Most popular</span>}</p>
                <h3>{p.name}</h3>
                <p className="price-amt">{p.price} <small>{p.per}</small></p>
                <ul className="ticks">
                  {p.items.map((t) => <li key={t}><IconCheck size={16} />{t}</li>)}
                </ul>
                <Link href="/signup" className={`lp-btn ${p.featured ? "lp-btn-lime" : "lp-btn-ghost"}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
          <p className="price-foot">Cancel any time from the billing page. Top-up credits never expire. <Link href="/tools#cost">Estimate your cost</Link></p>
        </div>
      </section>

      <CtaCard />
    </>
  );
}
