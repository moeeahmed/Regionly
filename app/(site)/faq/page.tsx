import Link from "next/link";
import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";
import { REGIONS } from "@/lib/regions";

export const metadata: Metadata = { title: "FAQ · Regionly", description: "Answers to common questions about Regionly." };

const GROUPS: { title: string; items: [string, React.ReactNode][] }[] = [
  {
    title: "The product",
    items: [
      ["Is this just translation?", "No. Claude rewrites the script for each market: prices in local money, local idioms, a register that fits, and claims checked. You get an English back-translation of every version."],
      ["What's the difference between Dub and Regenerate?", <>Dub keeps your footage and re-voices each speaker in their cloned voice. Regenerate keeps the structure and offer but films it again with a local presenter and setting. See <Link href="/blog/dub-or-regenerate">how to choose</Link>.</>],
      ["Which markets do you support?", <>{REGIONS.length} markets, from the US and Mexico to Japan, the UAE and Nigeria. Each has its own notes on tone, register and currency.</>],
      ["Can I keep my brand name and slogan?", "Yes. List them when you upload the ad and they're never translated, in the script or in the voice."],
    ],
  },
  {
    title: "Uploads and output",
    items: [
      ["Which videos can I upload?", "MP4, MOV or WebM, up to three minutes and 500 MB."],
      ["Which formats can I get back?", "Dubs keep your original format. Regenerated ads can be 9:16, 1:1, 3:4 or 16:9."],
      ["How long does a version take?", "A dub usually takes a few minutes. A regenerated ad takes longer because every scene is generated. You can close the page while it works."],
      ["Do I need rights to the ad?", "Yes. Only upload ads you have the rights to localise, including the voices and faces in them."],
    ],
  },
  {
    title: "Billing",
    items: [
      ["How do credits work?", "Dubbing uses 10 credits per minute of ad, per market. A regenerated ad uses 20 to 80 credits per market, depending on its length. You see the cost before you start."],
      ["What if a version fails?", "It retries itself. If it still can't finish, its credits come straight back to your balance."],
      ["Can I cancel?", "Yes, any time from the billing page. Top-up credits never expire."],
    ],
  },
  {
    title: "Your data",
    items: [
      ["Who processes my ads?", <>Your files are stored with Vercel and processed by ElevenLabs, Higgsfield and Anthropic to make each version. See the <Link href="/privacy">privacy policy</Link>.</>],
      ["Can I delete my data?", <>Yes. You can delete your account and its ads from the <Link href="/data-deletion">data deletion page</Link>.</>],
    ],
  },
];

export default function Faq() {
  return (
    <>
      <PageHero eyebrow="FAQ" title={<>Questions, <span className="hl">answered</span></>} sub={<>Can&apos;t find what you need? <Link href="/contact" className="inline-link">Get in touch</Link>.</>} />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap faq-page">
          {GROUPS.map((g) => (
            <div key={g.title} className="faq-group" data-reveal>
              <h2>{g.title}</h2>
              {g.items.map(([q, a]) => (
                <details key={q} className="qa">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          ))}
        </div>
      </section>
      <CtaCard />
    </>
  );
}
