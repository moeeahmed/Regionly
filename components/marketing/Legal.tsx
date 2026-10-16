import Link from "next/link";
import { SITE } from "@/lib/site";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** Shared layout for the legal pages: header, a contents list and the sections. */
export function LegalPage({ title, intro, sections }: { title: string; intro: React.ReactNode; sections: LegalSection[] }) {
  return (
    <section className="legal">
      <div className="lp-wrap">
        <header className="legal-head">
          <p className="ph-eyebrow">Legal</p>
          <h1>{title}</h1>
          <p className="legal-date">Last updated {SITE.legalUpdated}</p>
          <div className="legal-intro">{intro}</div>
        </header>
        <div className="legal-grid">
          <nav className="legal-toc" aria-label="On this page">
            <p>On this page</p>
            {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
          </nav>
          <div className="prose legal-body">
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2>{s.title}</h2>
                {s.body}
              </section>
            ))}
            <p className="legal-also">
              See also: <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/cookies">Cookies</Link> ·{" "}
              <Link href="/data-deletion">Data deletion</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContactLine() {
  return SITE.contactEmail ? (
    <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
  ) : (
    <Link href="/contact">our contact page</Link>
  );
}
