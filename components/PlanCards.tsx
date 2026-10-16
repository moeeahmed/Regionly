"use client";

import { useState } from "react";
import { BuyButton } from "@/components/BillingButtons";
import { ChangeAtRenewalButton, ChangeNowButton } from "@/components/SubscriptionActions";
import { classifyChange, type Interval } from "@/lib/subscription-math";

export type PlanCardInfo = {
  key: string;
  name: string;
  credits: number;
  monthlyPence: number;
  annualPence: number;
  savePence: number;
  savePercent: number;
  monthsFree: number;
  featured?: boolean;
};

export type PlanCardsProps = {
  plans: PlanCardInfo[];
  pack: { credits: number; pence: number };
  current: { plan: string; interval: Interval } | null; // null when there is no active subscription
  pending: { plan: string; interval: Interval; atLabel: string } | null;
  ending: boolean;
  canManage: boolean;
  hasPendingUpgrade: boolean;
  periodEndLabel: string;
};

const gbp = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: pence % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function PlanCards(p: PlanCardsProps) {
  const [view, setView] = useState<Interval>(p.current?.interval ?? "year");
  const best = Math.max(...p.plans.map((x) => x.savePercent));
  return (
    <>
      <div role="group" aria-label="Billing period" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button className={`btn ${view === "month" ? "primary" : ""}`} aria-pressed={view === "month"} onClick={() => setView("month")}>Monthly</button>
        <button className={`btn ${view === "year" ? "primary" : ""}`} aria-pressed={view === "year"} onClick={() => setView("year")}>Annual{best > 0 ? `, save up to ${best}%` : ""}</button>
      </div>
      <div className="plan-cards" style={{ marginTop: 0, marginBottom: 48 }}>
        {p.plans.map((pl) => {
          const target = { plan: pl.key, interval: view };
          const isCurrent = p.current?.plan === pl.key && p.current.interval === view;
          const isPending = p.pending?.plan === pl.key && p.pending.interval === view;
          const kind = p.current ? classifyChange({ credits: p.plans.find((x) => x.key === p.current!.plan)?.credits ?? 0, interval: p.current.interval }, { credits: pl.credits, interval: view }) : null;
          const yearly = view === "year";
          return (
            <div key={pl.key} className={`plan-card ${isCurrent ? "featured" : ""}`}>
              <h3>{pl.name}{isCurrent ? ", your plan" : ""}</h3>
              <div className="amt">{gbp(yearly ? pl.annualPence : pl.monthlyPence)}<small>{yearly ? "/yr" : "/mo"}</small></div>
              {yearly && pl.savePence > 0 && (
                <p style={{ margin: 0, fontSize: 14 }}>
                  <b>Save {gbp(pl.savePence)} a year ({pl.savePercent}%)</b>, {pl.monthsFree} months free.
                  <br /><span className="faint">That&apos;s {gbp(Math.round(pl.annualPence / 12))} a month instead of {gbp(pl.monthlyPence)}.</span>
                </p>
              )}
              <p className="what">{pl.credits} credits every month{yearly ? ", added month by month, billed once a year" : ""}</p>
              {isCurrent ? (
                <span className="faint">Your current plan.</span>
              ) : !p.current ? (
                <BuyButton plan={pl.key} interval={view} label={`Subscribe to ${pl.name}${yearly ? " annually" : ""}`} primary={pl.featured} />
              ) : p.ending ? (
                <span className="faint">Keep your subscription to change plan.</span>
              ) : !p.canManage ? (
                <span className="faint">Ask a workspace owner to change the plan.</span>
              ) : p.hasPendingUpgrade ? (
                <span className="faint">Finish or cancel your pending upgrade first.</span>
              ) : isPending ? (
                <span className="faint">Scheduled for {p.pending!.atLabel}.</span>
              ) : kind === "now" ? (
                <ChangeNowButton plan={target.plan} interval={view} label={`Switch to ${pl.name}${yearly ? " annual" : " monthly"}`} />
              ) : kind === "at_renewal" ? (
                <ChangeAtRenewalButton
                  plan={target.plan}
                  interval={view}
                  label={`Switch to ${pl.name}${yearly ? " annual" : " monthly"} at renewal`}
                  summary={`${pl.name}, ${pl.credits} credits a month, billed ${yearly ? "yearly" : "monthly"}`}
                  date={p.periodEndLabel}
                />
              ) : null}
            </div>
          );
        })}
        <div className="plan-card">
          <h3>Top-up pack</h3>
          <div className="amt">{gbp(p.pack.pence)}<small> one-off</small></div>
          <p className="what">{p.pack.credits} credits, never expire</p>
          <BuyButton plan="pack" label={`Buy ${p.pack.credits} credits`} />
        </div>
      </div>
    </>
  );
}
