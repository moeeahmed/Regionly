import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";

export const metadata: Metadata = { title: "Compare · Regionly", description: "Regionly compared with agencies and plain translation." };

const COLS = ["Localisation agency", "Translate and voice over", "Regionly"];
const ROWS: [string, string, string, string][] = [
  ["Time to a first version", "Days to weeks", "Hours to days", "Minutes for a dub, a little longer to regenerate"],
  ["Script", "Written by a local copywriter", "Word-for-word translation", "Rewritten for each market, with an English back-translation"],
  ["Prices and references", "Adapted", "Usually left as they are", "Adapted to local money, register and idiom"],
  ["Voice", "Local voice actor", "Stock voice or none", "The original speaker's cloned voice, or a voice you choose"],
  ["New presenter and setting", "Reshoot, at extra cost", "Not offered", "Regenerated with Higgsfield"],
  ["Compliance notes", "Depends on the agency", "Rarely", "Flagged on every version"],
  ["Cost to test a new market", "Typically a fixed fee per market", "Per word or per minute", "From 10 credits per minute of ad"],
];

export default function Compare() {
  return (
    <>
      <PageHero eyebrow="Compare" title={<>How Regionly <span className="hl">compares</span></>} sub="The three common ways to take an ad into a new market, side by side." />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap">
          <div className="cmp-wrap" data-reveal>
            <table className="cmp">
              <thead>
                <tr><th scope="col"><span className="visually-hidden">Compared</span></th>{COLS.map((c, i) => <th key={c} scope="col" className={i === 2 ? "us" : ""}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map(([k, ...v]) => (
                  <tr key={k}><th scope="row">{k}</th>{v.map((x, i) => <td key={i} className={i === 2 ? "us" : ""}>{x}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="prose prose-narrow">
            <h2>When an agency is still the right call</h2>
            <p>
              For a flagship brand campaign, a big-budget launch or a heavily regulated category, a local agency&apos;s judgement is worth paying for.
              Many teams use Regionly to find which markets and angles work first, then bring the winners to an agency.
            </p>
            <h2>When plain translation is enough</h2>
            <p>
              For product demos, tutorials and support videos where the words carry the meaning and there&apos;s no hook to protect,
              a straight translation is often fine. Performance ads are different: the first two seconds decide everything.
            </p>
          </div>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
