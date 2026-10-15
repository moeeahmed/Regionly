import Link from "next/link";
import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/marketing/Legal";
import { DeleteAccount } from "@/components/marketing/DeleteAccount";
import { getCtx } from "@/lib/auth";
import { isConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Data deletion · Regionly" };
export const dynamic = "force-dynamic";

export default async function DataDeletion() {
  let email: string | null = null;
  if (isConfigured()) {
    try {
      email = (await getCtx())?.user.email ?? null;
    } catch {
      email = null;
    }
  }
  return (
    <LegalPage
      title="Data deletion"
      intro={
        <>
          <p>You can delete your Regionly account and its data yourself, at any time.</p>
          {email ? (
            <DeleteAccount email={email} />
          ) : (
            <div className="del-box">
              <h3>Delete your account</h3>
              <p>Sign in first, then come back to this page to delete your account.</p>
              <Link className="lp-btn" href="/login?next=/data-deletion">Sign in to continue</Link>
            </div>
          )}
        </>
      }
      sections={[
        {
          id: "what",
          title: "What gets deleted",
          body: (
            <ul>
              <li>Your account: your email, name and password.</li>
              <li>Every workspace where you&apos;re the only member, with all its ads, versions, scripts, credits and invitations.</li>
              <li>The uploaded videos, thumbnails, voiceovers and finished videos of those workspaces, from our file storage.</li>
              <li>Any active subscription on those workspaces is cancelled, so you won&apos;t be charged again.</li>
            </ul>
          ),
        },
        {
          id: "shared",
          title: "Shared workspaces",
          body: <p>If other people are members of a workspace, deleting your account only removes you from it. The workspace, its ads and its credits stay with the remaining members. Ask an owner to remove anything you uploaded first if you want it gone.</p>,
        },
        {
          id: "kept",
          title: "What we can't delete straight away",
          body: (
            <ul>
              <li>Payment and invoice records held by Stripe, which are kept as tax law requires.</li>
              <li>Copies held by our AI providers while they processed your ads, which they delete under their own retention policies.</li>
              <li>Short-lived server logs kept by our hosting provider.</li>
            </ul>
          ),
        },
        {
          id: "help",
          title: "Can't sign in?",
          body: <p>If you can&apos;t sign in to your account, contact us at <ContactLine /> from the email address on the account and we&apos;ll delete it for you.</p>,
        },
      ]}
    />
  );
}
