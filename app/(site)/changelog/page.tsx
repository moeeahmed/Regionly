import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";

export const metadata: Metadata = { title: "Changelog · Regionly", description: "What's new in Regionly." };

const ENTRIES = [
  {
    date: "15 October 2026",
    title: "A proper home for Regionly",
    items: [
      "New pages: features, blog, compare, free tools, FAQ, contact and this changelog.",
      "Privacy, terms, cookie and data deletion pages.",
      "Delete your account and its data yourself from the data deletion page.",
      "Two free tools: a cost estimator and a line-length checker.",
    ],
  },
  {
    date: "15 October 2026",
    title: "A live example on the home page",
    items: [
      "Watch an example ad being localised for Mexico, Germany, Japan, the UAE and Brazil, step by step.",
      "A refreshed look across the site and the app.",
    ],
  },
  {
    date: "October 2026",
    title: "Regionly launches",
    items: [
      "Upload a video ad and localise it for 30 markets.",
      "Dub with ElevenLabs, or regenerate with Higgsfield and ElevenLabs voice.",
      "Scripts rewritten for each market by Claude, with back-translations and compliance notes.",
      "Team workspaces, credits, and Stripe billing with refunds for failed versions.",
    ],
  },
];

export default function Changelog() {
  return (
    <>
      <PageHero eyebrow="Changelog" title={<>What&apos;s <span className="hl">new</span></>} sub="Everything we ship, newest first." />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <ol className="log">
            {ENTRIES.map((e) => (
              <li key={e.title} data-reveal>
                <p className="log-date">{e.date}</p>
                <div className="log-card">
                  <h2>{e.title}</h2>
                  <ul>{e.items.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
