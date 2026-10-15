import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CtaCard } from "@/components/marketing/SiteChrome";
import { POSTS, formatDate, getPost, type Block } from "@/lib/content/blog";
import { photoUrl } from "@/lib/demo";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getPost((await params).slug);
  return p ? { title: `${p.title} · Regionly`, description: p.excerpt } : {};
}

function render(b: Block, i: number) {
  if ("h2" in b) return <h2 key={i}>{b.h2}</h2>;
  if ("ul" in b) return <ul key={i}>{b.ul.map((x) => <li key={x}>{x}</li>)}</ul>;
  if ("quote" in b) return <blockquote key={i}>{b.quote}</blockquote>;
  return <p key={i}>{b.p}</p>;
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);
  return (
    <>
      <article className="article">
        <div className="lp-wrap article-head">
          <Link href="/blog" className="back-link" data-rise>All articles</Link>
          <p className="post-meta" data-rise><span className="pill">{post.tag}</span>{formatDate(post.date)} · {post.minutes} min read · Regionly team</p>
          <h1 data-rise style={{ ["--i" as string]: 1 }}>{post.title}</h1>
          <p className="ph-sub" data-rise style={{ ["--i" as string]: 2 }}>{post.excerpt}</p>
        </div>
        <div className="lp-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="article-img" src={photoUrl(post.photo, 1400, 640)} width={1400} height={640} alt="" data-rise style={{ ["--i" as string]: 3 }} />
          <div className="prose">{post.body.map(render)}</div>
        </div>
      </article>

      <section className="lp-sec">
        <div className="lp-wrap">
          <h2 className="lp-h2">Keep reading</h2>
          <div className="post-grid post-grid-2">
            {more.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="post-card" data-reveal>
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
