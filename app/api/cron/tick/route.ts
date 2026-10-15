import { advanceActive } from "@/lib/pipeline";

export const maxDuration = 300;

/** Safety net that keeps jobs moving even when nobody has the job page open. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const n = await advanceActive(10, 25_000);
  return Response.json({ advanced: n });
}
