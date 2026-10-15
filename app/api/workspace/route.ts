import { apiCtx, HttpError, jsonError, setActiveWorkspace } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    const { workspaceId } = (await req.json()) as { workspaceId?: string };
    if (!ctx.workspaces.some((w) => w.id === workspaceId)) throw new HttpError(404, "You're not a member of that workspace.");
    await setActiveWorkspace(workspaceId!);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
