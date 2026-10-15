import { randomBytes } from "node:crypto";
import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    if (ctx.role !== "owner" && ctx.role !== "admin") throw new HttpError(403, "Only owners and admins can invite people.");
    const { email, role } = (await req.json()) as { email?: string; role?: string };
    const e = (email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new HttpError(400, "Enter an email address like name@company.com.");
    const r = role === "admin" ? "admin" : "member";
    const token = randomBytes(18).toString("base64url");
    const q = await db();
    await q`INSERT INTO invites (token, workspace_id, email, role, invited_by) VALUES (${token}, ${ctx.workspace.id}, ${e}, ${r}, ${ctx.user.id})`;
    return Response.json({ link: `${appUrl(req)}/invite/${token}` });
  } catch (err) {
    return jsonError(err);
  }
}
