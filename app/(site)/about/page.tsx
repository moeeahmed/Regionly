import Link from "next/link";
import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";
import { MarketReel } from "@/components/landing/MarketReel";
import { REGIONS } from "@/lib/regions";

export const metadata: Metadata = { title: "Why Regionly", description: "Why we built Regionly, and how it localises ads." };

export default function About() {
  return (
    <>
      <PageHero eyebrow="Why Regionly" title={<>Your best ad deserves a <span className="hl">second</span> market.</>} sub="Most brands find one ad that works and never take it further, because localising it properly has been slow and expensive. Regionly changes that." />

      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <div className="band" data-reveal>
            <MarketReel />
            <div className="band-copy">
              <h2>The problem with translating ads</h2>
              <p>An ad that converts is a careful thing. The hook stops the scroll in two seconds, the proof is believable, the offer feels like a bargain, and the person on screen feels like someone you&apos;d listen to.</p>
              <p>Translate it word for word and most of that is lost. Hire an agency for every market and it takes weeks, for every test. So the ad stays in one country.</p>
              <p>Regionly rewrites the ad for each market, then voices it, or films it again with a local presenter, in the time it takes to make a coffee.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2" data-reveal>What we believe</h2>
          <div className="steps">
            <div className="step" data-reveal>
              <h3>Keep what works</h3>
              <p>The structure, the offer and your brand stay the same in every market. Only what doesn&apos;t travel changes.</p>
            </div>
            <div className="step" data-reveal style={{ ["--i" as string]: 1 }}>
              <h3>Show your working</h3>
              <p>Every version comes with an English back-translation and a list of what changed, so nothing goes live unread.</p>
            </div>
            <div className="step" data-reveal style={{ ["--i" as string]: 2 }}>
              <h3>Pay for what you use</h3>
              <p>Credits, not contracts. If a version fails, its credits come back automatically.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="prose prose-narrow" data-reveal>
            <h2>Built on the best models for each job</h2>
            <p><strong>Claude</strong> by Anthropic rewrites each script for the market, using notes on tone, register and currency for {REGIONS.length} markets.</p>
            <p><strong>ElevenLabs</strong> transcribes your ad, dubs it in each speaker&apos;s cloned voice, and records new voiceovers.</p>
            <p><strong>Higgsfield</strong> casts local presenters and generates lip-synced scenes when an ad needs to be filmed again.</p>
            <p>Have a question? Read the <Link href="/faq">FAQ</Link> or <Link href="/contact">get in touch</Link>.</p>
          </div>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
