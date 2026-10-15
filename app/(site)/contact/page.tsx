import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/SiteChrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Contact · Regionly", description: "Get in touch with the Regionly team." };
export const dynamic = "force-dynamic";

export default function Contact() {
  const email = SITE.contactEmail;
  const mail = (subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  return (
    <>
      <PageHero eyebrow="Contact" title={<>Talk to <span className="hl">us</span></>} sub="Questions about a market, a bigger plan for your team, or something not working? We read every message." />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <div className="contact-grid">
            {[
              { t: "Sales and teams", d: "Agencies and teams localising lots of ads, or needing a custom plan.", s: "Regionly for our team" },
              { t: "Support", d: "Something didn't work, or a version came back wrong. Include the link to the job.", s: "Regionly support" },
              { t: "Privacy and data", d: "Requests about your personal data, or deleting an account you can't sign in to.", s: "Regionly data request" },
            ].map((c, i) => (
              <div key={c.t} className="step" data-reveal style={{ ["--i" as string]: i }}>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
                {email ? (
                  <a className="lp-btn lp-btn-soft contact-btn" href={mail(c.s)}>Email us</a>
                ) : (
                  <p className="contact-wait">Our contact address is being set up.</p>
                )}
              </div>
            ))}
          </div>
          <div className="cta" data-reveal style={{ marginTop: 18 }}>
            <div>
              <h2>Quicker answers</h2>
              <p>Most questions are covered in the FAQ.</p>
            </div>
            <Link href="/faq" className="lp-btn lp-btn-ghost">Read the FAQ</Link>
          </div>
        </div>
      </section>
    </>
  );
}
