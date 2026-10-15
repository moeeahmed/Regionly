import { createSession, HttpError, jsonError, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    const q = await db();
    const rows = (await q`SELECT id, password_hash FROM users WHERE email = ${(email ?? "").trim().toLowerCase()}`) as { id: string; password_hash: string }[];
    if (!rows[0] || !(await verifyPassword(password ?? "", rows[0].password_hash))) {
      throw new HttpError(401, "That email and password don't match an account.");
    }
    await createSession(rows[0].id);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
