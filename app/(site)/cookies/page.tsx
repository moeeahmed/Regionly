import Link from "next/link";
import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/Legal";

export const metadata: Metadata = { title: "Cookie policy · Regionly" };
export const dynamic = "force-dynamic";

export default function Cookies() {
  return (
    <LegalPage
      title="Cookie policy"
      intro={<p>Regionly uses as few cookies as possible. We don&apos;t use advertising or analytics cookies, so there&apos;s nothing to opt out of and no cookie banner.</p>}
      sections={[
        {
          id: "ours",
          title: "Cookies we set",
          body: (
            <div className="legal-table-wrap">
              <table className="legal-table">
                <thead><tr><th scope="col">Name</th><th scope="col">What it does</th><th scope="col">How long</th></tr></thead>
                <tbody>
                  <tr><td>rg_session</td><td>Keeps you signed in. It holds a signed reference to your account, not your password.</td><td>30 days</td></tr>
                  <tr><td>rg_ws</td><td>Remembers which workspace you were last using.</td><td>30 days</td></tr>
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "why",
          title: "Why there's no consent banner",
          body: <p>Both cookies are strictly necessary for a service you&apos;ve asked for, signing in. UK law doesn&apos;t require consent for strictly necessary cookies. They&apos;re only set when you sign in.</p>,
        },
        {
          id: "third",
          title: "Third parties",
          body: <p>When you buy a plan, you&apos;re taken to Stripe&apos;s checkout, which sets its own cookies on Stripe&apos;s website to process the payment and prevent fraud. Their use is covered by Stripe&apos;s own policy.</p>,
        },
        {
          id: "manage",
          title: "Managing cookies",
          body: (
            <p>
              Signing out removes both cookies. You can also delete them in your browser settings at any time, though you&apos;ll need to sign in again.
              Questions? Contact us at <ContactLine />, or read the <Link href="/privacy">privacy policy</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
