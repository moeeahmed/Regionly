import { advanceActive } from "@/lib/pipeline";
import { allocateMonthlyCredits } from "@/lib/subscription-credits";

export const maxDuration = 300;

/** Safety net that keeps jobs moving even when nobody has the job page open. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const n = await advanceActive(10, 25_000);
  // Annual subscribers receive their credits month by month; this hands out any month that has started.
  const credits = await allocateMonthlyCredits().catch((e) => {
    console.error("monthly credit allocation", e);
    return 0;
  });
  return Response.json({ advanced: n, annualCreditsGranted: credits });
}
