import Link from "next/link";
import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/Legal";
import { SITE, operator } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy · Regionly" };
export const dynamic = "force-dynamic";

export default function Privacy() {
  const who = operator();
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          This policy explains what personal data Regionly collects, why, who processes it and the choices you have. Regionly is operated by{" "}
          {who}{SITE.legalAddress ? `, ${SITE.legalAddress}` : ""}, which is the controller of your personal data.
        </p>
      }
      sections={[
        {
          id: "what",
          title: "What we collect",
          body: (
            <ul>
              <li><strong>Account details:</strong> your email address, your name if you give it, and a scrambled (hashed) version of your password. We never store your password itself.</li>
              <li><strong>Workspace details:</strong> workspace names, who belongs to them and their roles, and invitations you send, including the invitee&apos;s email address.</li>
              <li><strong>Your ads:</strong> the videos you upload, a thumbnail frame, the transcript of the speech, the notes and brand words you add, and the versions Regionly produces for you, including scripts, voiceovers, generated images and videos.</li>
              <li><strong>Billing:</strong> your plan, credit balance and history, and a customer reference from Stripe. Card details are collected and held by Stripe, never by us.</li>
              <li><strong>Technical data:</strong> our hosting provider keeps short-lived server logs, which include IP addresses and request details, to run and secure the service.</li>
            </ul>
          ),
        },
        {
          id: "why",
          title: "Why we use it",
          body: (
            <>
              <ul>
                <li>To provide the service you signed up for: storing your ads, localising them and showing you the results. This is necessary to perform our contract with you.</li>
                <li>To take payment and keep billing records. This is necessary for the contract and to meet our legal obligations.</li>
                <li>To keep the service secure and working, and to fix problems. This is in our legitimate interests.</li>
                <li>To reply when you contact us.</li>
              </ul>
              <p>We don&apos;t sell your data, we don&apos;t use it for advertising, and we don&apos;t use your ads to train AI models.</p>
            </>
          ),
        },
        {
          id: "processors",
          title: "Who processes it",
          body: (
            <>
              <p>To localise an ad, its content is sent to the AI providers that do each step. We share only what each step needs.</p>
              <ul>
                <li><strong>Vercel</strong> hosts the site and stores uploaded and generated files.</li>
                <li><strong>Neon</strong> hosts our database.</li>
                <li><strong>ElevenLabs</strong> transcribes your ad, dubs it and records voiceovers.</li>
                <li><strong>Higgsfield</strong> generates presenters and video scenes for regenerated ads.</li>
                <li><strong>Anthropic</strong> rewrites your script for each market.</li>
                <li><strong>Stripe</strong> handles payments and subscriptions.</li>
              </ul>
              <p>Some of these providers are based in, or process data in, the United States. Where personal data leaves the UK, we rely on the safeguards UK law allows, such as the UK addendum to the EU standard contractual clauses or the UK–US data bridge.</p>
              <p>Images on our marketing pages are loaded from picsum.photos, which receives your IP address when you view them.</p>
            </>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <p>
              We keep your account, ads and versions for as long as your account is open. When you delete your account, we delete it from our
              database and remove its files from our storage straight away. Payment and invoice records are kept by Stripe for as long as tax law
              requires. Copies held by the AI providers are deleted according to their own retention policies.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <>
              <p>
                Under UK data protection law you can ask to access, correct, delete or receive a copy of your personal data, and you can object to or
                ask us to restrict some uses of it. You can delete your account at any time from the <Link href="/data-deletion">data deletion page</Link>.
              </p>
              <p>
                To make a request, contact us at <ContactLine />. If you&apos;re unhappy with how we handle your data, you can complain to the
                Information Commissioner&apos;s Office at ico.org.uk.
              </p>
            </>
          ),
        },
        {
          id: "others",
          title: "People in your ads",
          body: (
            <p>
              Your ads may show or include the voices of other people. You&apos;re responsible for having their permission to localise their likeness and
              voice, including cloning a voice for a dub. We process their data on your behalf, only to make the versions you ask for.
            </p>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: <p>We only use cookies that keep you signed in and remember your workspace. See the <Link href="/cookies">cookie policy</Link>.</p>,
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: <p>If we change this policy in a way that matters, we&apos;ll tell you by email or in the app before the change takes effect.</p>,
        },
      ]}
    />
  );
}
