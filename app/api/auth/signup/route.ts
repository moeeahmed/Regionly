import { createSession, createUserWithWorkspace, HttpError, jsonError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, name, password } = (await req.json()) as { email?: string; name?: string; password?: string };
    const e = (email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new HttpError(400, "Enter an email address like name@company.com.");
    if ((password ?? "").length < 8) throw new HttpError(400, "Use a password of at least 8 characters.");
    const userId = await createUserWithWorkspace(e, (name ?? "").trim().slice(0, 80), password!);
    await createSession(userId);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
