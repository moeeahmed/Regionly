import type { Metadata } from "next";
import { CtaCard, PageHero } from "@/components/marketing/SiteChrome";
import { CostEstimator, LineFit } from "@/components/marketing/Tools";

export const metadata: Metadata = { title: "Free tools · Regionly", description: "Free tools for planning localised video ads." };

export default function Tools() {
  return (
    <>
      <PageHero eyebrow="Free tools" title={<>Plan your <span className="hl">rollout</span></>} sub="Two quick tools for planning localised ads. No sign-up needed." />
      <section className="lp-sec lp-sec-flush">
        <div className="lp-wrap tool-stack">
          <div data-reveal>
            <h2 className="tool-h">Localisation cost estimator</h2>
            <p className="tool-p">How many credits a run needs, and which plan covers it.</p>
            <CostEstimator />
          </div>
          <div data-reveal>
            <h2 className="tool-h">Will this line fit?</h2>
            <p className="tool-p">Check whether a line of your script fits the seconds it has, before it&apos;s translated.</p>
            <LineFit />
          </div>
        </div>
      </section>
      <CtaCard />
    </>
  );
}
