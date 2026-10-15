import Link from "next/link";
import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";
import { POSTS, formatDate } from "@/lib/content/blog";
import { photoUrl } from "@/lib/demo";

export const metadata: Metadata = { title: "Blog · Regionly", description: "Guides on localising video ads for new markets." };

export default function BlogIndex() {
  const [lead, ...rest] = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHero eyebrow="Blog" title={<>Guides for taking ads <span className="hl">abroad</span>.</>} sub="Practical notes on localising video ads: what to keep, what to change and what to check." />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <Link href={`/blog/${lead.slug}`} className="post-lead" data-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(lead.photo, 1000, 640)} width={1000} height={640} alt="" />
            <div>
              <p className="post-meta"><span className="pill">{lead.tag}</span>{formatDate(lead.date)} · {lead.minutes} min read</p>
              <h2>{lead.title}</h2>
              <p>{lead.excerpt}</p>
              <span className="work-link">Read the article</span>
            </div>
          </Link>
          <div className="post-grid">
            {rest.map((p, i) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="post-card" data-reveal style={{ ["--i" as string]: i }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(p.photo, 640, 400)} width={640} height={400} alt="" loading="lazy" />
                <p className="post-meta"><span className="pill">{p.tag}</span>{p.minutes} min read</p>
                <h3>{p.title}</h3>
                <p>{p.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
