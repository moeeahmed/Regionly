import Link from "next/link";
import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/Legal";
import { SITE, operator } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of service · Regionly" };
export const dynamic = "force-dynamic";

export default function Terms() {
  const who = operator();
  return (
    <LegalPage
      title="Terms of service"
      intro={
        <p>
          These terms are an agreement between you and {who} (&ldquo;we&rdquo;) for your use of Regionly. By creating an account you accept them. If you
          use Regionly for a business, you accept them on its behalf.
        </p>
      }
      sections={[
        {
          id: "service",
          title: "The service",
          body: (
            <p>
              Regionly lets you upload video ads and produce localised versions of them using AI services, including script rewriting, dubbing,
              voiceovers and generated video. Features can change as we improve the service.
            </p>
          ),
        },
        {
          id: "account",
          title: "Your account",
          body: (
            <ul>
              <li>Give accurate details and keep your password safe. You&apos;re responsible for activity on your account.</li>
              <li>Workspace owners and admins control who can access a workspace and its credits.</li>
              <li>You must be at least 18 and able to enter a contract.</li>
            </ul>
          ),
        },
        {
          id: "content",
          title: "Your content and acceptable use",
          body: (
            <>
              <p>You keep ownership of the ads you upload. You give us permission to store and process them, and to send them to our providers, only to run the service for you.</p>
              <p>You must have every right needed to localise what you upload, including permission from anyone whose face or voice appears in it, before their voice is cloned or their likeness is used. You must not use Regionly to:</p>
              <ul>
                <li>make content that is unlawful, misleading, defamatory, or that infringes anyone&apos;s rights;</li>
                <li>impersonate a real person or make it appear that someone said something they didn&apos;t;</li>
                <li>make claims in an ad that you couldn&apos;t make in the original market, or that break advertising rules where the ad will run;</li>
                <li>break the usage policies of the providers we use, or attempt to disrupt or reverse-engineer the service.</li>
              </ul>
              <p>We may suspend accounts that break these rules.</p>
            </>
          ),
        },
        {
          id: "outputs",
          title: "AI-generated output",
          body: (
            <p>
              Localised versions are produced by AI and can contain mistakes in language, meaning, pronunciation or appearance. Back-translations and
              compliance notes are a guide, not legal advice. You&apos;re responsible for reviewing every version and for how and where you publish it.
              Subject to our providers&apos; terms, you may use the versions made for you for any lawful purpose.
            </p>
          ),
        },
        {
          id: "billing",
          title: "Plans, credits and payment",
          body: (
            <ul>
              <li>Paid plans are billed monthly in advance through Stripe and renew until cancelled. You can cancel from the billing page, and the plan ends at the end of the period you&apos;ve paid for.</li>
              <li>Monthly plan credits are added each billing period. Top-up credits don&apos;t expire while your account is open.</li>
              <li>Credits are reserved when a localisation starts. If a version can&apos;t be produced, its credits are returned automatically.</li>
              <li>Except where the law says otherwise, payments aren&apos;t refundable. If you&apos;re a consumer, your statutory rights aren&apos;t affected.</li>
              <li>We&apos;ll give you notice before changing prices for your plan.</li>
            </ul>
          ),
        },
        {
          id: "availability",
          title: "Availability",
          body: <p>We work to keep Regionly running, but it depends on third-party providers and may sometimes be unavailable or slow. We don&apos;t guarantee that any version will be produced in a particular time.</p>,
        },
        {
          id: "liability",
          title: "Liability",
          body: (
            <p>
              Nothing in these terms limits liability that can&apos;t be limited by law. Otherwise, we aren&apos;t liable for indirect or consequential loss,
              or for lost profits or revenue, and our total liability to you in any 12 months is limited to the amount you paid us in that time.
            </p>
          ),
        },
        {
          id: "ending",
          title: "Ending the agreement",
          body: (
            <p>
              You can stop using Regionly and <Link href="/data-deletion">delete your account</Link> at any time. We may end or suspend your access if you
              seriously or repeatedly break these terms. When an account is deleted, its content is deleted as described in our{" "}
              <Link href="/privacy">privacy policy</Link>.
            </p>
          ),
        },
        {
          id: "law",
          title: "Law and contact",
          body: (
            <p>
              These terms are governed by the law of {SITE.jurisdiction}, and its courts have jurisdiction. If we change these terms in a way that matters,
              we&apos;ll tell you before the change takes effect. Questions? Contact us at <ContactLine />.
            </p>
          ),
        },
      ]}
    />
  );
}
