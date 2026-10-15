import { apiCtx, HttpError, jsonError, setActiveWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ctx = await apiCtx();
    const { token } = await params;
    const q = await db();
    const rows = (await q`SELECT * FROM invites WHERE token = ${token}`) as { workspace_id: string; email: string; role: string; accepted_at: string | null }[];
    const inv = rows[0];
    if (!inv || inv.accepted_at) throw new HttpError(404, "This invite link has expired or was already used. Ask for a new one.");
    if (inv.email !== ctx.user.email) throw new HttpError(403, `This invite is for ${inv.email}. Sign in with that email to accept it.`);
    await q`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${inv.workspace_id}, ${ctx.user.id}, ${inv.role}) ON CONFLICT DO NOTHING`;
    await q`UPDATE invites SET accepted_at = now() WHERE token = ${token}`;
    await setActiveWorkspace(inv.workspace_id);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
