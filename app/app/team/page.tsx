import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { InviteForm } from "@/components/InviteForm";

const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };

export default async function Team() {
  const ctx = await requireCtx();
  const q = await db();
  const members = (await q`
    SELECT u.email, u.name, m.role, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ${ctx.workspace.id} ORDER BY m.created_at ASC`) as { email: string; name: string; role: string; created_at: string }[];
  const pending = (await q`
    SELECT email, role, created_at FROM invites WHERE workspace_id = ${ctx.workspace.id} AND accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 20`) as { email: string; role: string; created_at: string }[];
  const canInvite = ctx.role === "owner" || ctx.role === "admin";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p className="sub">Everyone here shares {ctx.workspace.name}&apos;s ads and credits.</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 24, maxWidth: 780 }}>
        {canInvite && <InviteForm />}
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="list">
            <thead><tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Since</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.email}>
                  <td><div style={{ fontWeight: 600 }}>{m.name || m.email}</div>{m.name && <div className="faint">{m.email}</div>}</td>
                  <td>{ROLE[m.role] ?? m.role}</td>
                  <td className="muted num">{new Date(m.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>
                </tr>
              ))}
              {pending.map((p) => (
                <tr key={`inv-${p.email}-${String(p.created_at)}`}>
                  <td className="muted">{p.email}</td>
                  <td><span className="status work">Invited as {(ROLE[p.role] ?? p.role).toLowerCase()}</span></td>
                  <td className="muted num">{new Date(p.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
