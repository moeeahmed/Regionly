import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { AcceptInvite } from "@/components/AcceptInvite";
import { getCtx } from "@/lib/auth";
import { isConfigured } from "@/lib/config";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  if (!isConfigured()) redirect("/setup");
  const { token } = await params;
  const q = await db();
  const rows = (await q`
    SELECT i.email, i.accepted_at, w.name AS workspace FROM invites i JOIN workspaces w ON w.id = i.workspace_id
    WHERE i.token = ${token}`) as { email: string; accepted_at: string | null; workspace: string }[];
  const inv = rows[0];
  const ctx = await getCtx();
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <>
      <header className="topbar"><div className="container inner"><Brand /></div></header>
      <main className="auth-wrap">
        <div className="panel auth-card stack" style={{ gap: 16 }}>
          {!inv || inv.accepted_at ? (
            <>
              <h1>This invite has expired</h1>
              <p className="muted">It may have been used already. Ask the person who invited you for a new link.</p>
            </>
          ) : (
            <>
              <h1>Join {inv.workspace} on Regionly</h1>
              <p className="muted">This invite is for <b>{inv.email}</b>.</p>
              {ctx ? (
                <AcceptInvite token={token} />
              ) : (
                <div className="row wrap">
                  <Link className="btn primary" href={`/signup?next=${next}`}>Create account</Link>
                  <Link className="btn" href={`/login?next=${next}`}>Sign in</Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
