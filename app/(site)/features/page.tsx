import Link from "next/link";
import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";
import { IconArrow, IconFilm, IconSwap, IconUsers, IconVoice } from "@/components/Icons";
import { FEATURES } from "@/lib/content/features";

export const metadata: Metadata = { title: "Features · Regionly", description: "Dub, regenerate, back-translation and team workspaces." };

const ICONS: Record<string, React.ReactNode> = {
  dub: <IconVoice />,
  regenerate: <IconFilm />,
  "back-translation": <IconSwap />,
  workspaces: <IconUsers />,
};

export default function FeaturesIndex() {
  return (
    <>
      <PageHero eyebrow="Features" title={<>Everything you need to <span className="hl">launch</span> abroad.</>} sub="Two ways to localise an ad, a script you can check in English, and a workspace for your whole team." />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <div className="work">
            {FEATURES.map((f, i) => (
              <Link href={`/features/${f.slug}`} className="work-card" key={f.slug} data-reveal style={{ ["--i" as string]: i % 2 }}>
                <span className="ic">{ICONS[f.slug]}</span>
                <h3>{f.name}</h3>
                <p>{f.sub}</p>
                <span className="work-link">Learn more <IconArrow size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
