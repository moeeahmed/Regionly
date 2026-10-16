import Link from "next/link";
import { FOOTER, NAV, SITE } from "@/lib/site";
import { IconArrow } from "@/components/Icons";
import { NavAuth } from "@/components/marketing/NavAuth";

export function SiteNav() {
  return (
    <header className="lp-nav">
      <div className="lp-nav-in">
        <Link href="/" className="lp-logo" aria-label="Regionly home">
          <span className="lp-logo-mark" aria-hidden>R</span>Regionly
        </Link>
        <nav className="lp-links" aria-label="Main">
          {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
        <div className="lp-nav-r">
          <NavAuth />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link href="/" className="lp-logo"><span className="lp-logo-mark" aria-hidden>R</span>Regionly</Link>
            <p>{SITE.tagline}</p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            </div>
          ))}
        </div>
        <p className="foot-small">© 2026 {SITE.legalEntity || "Regionly"}</p>
      </div>
    </footer>
  );
}

/** Small mono label above a section heading: a square bullet, a number and a name. */
export function Eyebrow({ n, label, light }: { n?: string; label: string; light?: boolean }) {
  return (
    <p className={`eyebrow ${light ? "eyebrow-light" : ""}`}>
      <i aria-hidden />
      {n && <span>{n}</span>}
      {label}
    </p>
  );
}

/** A full-width hairline with crosshair marks where it meets the page frame. */
export function XRule() {
  return (
    <div className="xrule" aria-hidden>
      <div className="lp-wrap"><span /></div>
    </div>
  );
}

/** Left-aligned page header used by every inner page. */
export function PageHero({ title, sub, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; eyebrow?: string }) {
  return (
    <section className="ph">
      <div className="lp-wrap">
        {eyebrow && <div data-rise><Eyebrow label={eyebrow} /></div>}
        <h1 data-rise style={{ ["--i" as string]: 1 }}>{title}</h1>
        {sub && <p className="ph-sub" data-rise style={{ ["--i" as string]: 2 }}>{sub}</p>}
      </div>
    </section>
  );
}

export function CtaCard({ title = "Your next market is one upload away.", text = "30 free credits when you sign up. See your ad in three markets before you pay anything." }: { title?: string; text?: string }) {
  return (
    <section className="lp-sec lp-sec-tight">
      <div className="lp-wrap">
        <div className="cta cta-big" data-reveal>
          <div className="rings rings-dark" aria-hidden />
          <h2>{title}</h2>
          <div className="cta-side">
            <p>{text}</p>
            <Link href="/signup" className="lp-btn lp-btn-lime">Localise an ad free <IconArrow size={16} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
