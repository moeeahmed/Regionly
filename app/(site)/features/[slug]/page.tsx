import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";
import { IconArrow, IconCheck } from "@/components/Icons";
import { FEATURES, getFeature } from "@/lib/content/features";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = getFeature((await params).slug);
  return f ? { title: `${f.name} · Regionly`, description: f.sub } : {};
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const f = getFeature((await params).slug);
  if (!f) notFound();
  const others = FEATURES.filter((x) => x.slug !== f.slug);
  return (
    <>
      <PageHero eyebrow={f.name} title={f.title} sub={f.sub} />

      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <div className="work">
            {f.points.map((p, i) => (
              <div className="work-card" key={p.title} data-reveal style={{ ["--i" as string]: i % 2 }}>
                <span className="ic"><IconCheck /></span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <div className="split" data-reveal>
            <div>
              <h2>How it works</h2>
              <ol className="howlist">
                {f.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
            <aside className="side-card">
              <h3>Best for</h3>
              <ul className="ticks">
                {f.bestFor.map((b) => <li key={b}><IconCheck size={16} />{b}</li>)}
              </ul>
              <h3>Cost</h3>
              <p>{f.cost}</p>
              <Link href="/signup" className="lp-btn">Try it free</Link>
            </aside>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2" data-reveal>More from Regionly</h2>
          <div className="mini-grid">
            {others.map((o) => (
              <Link key={o.slug} href={`/features/${o.slug}`} className="mini" data-reveal>
                <strong>{o.name}</strong>
                <span>{o.title}</span>
                <IconArrow size={16} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
