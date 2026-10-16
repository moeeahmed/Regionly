import { hasSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ signedIn: await hasSession() }, { headers: { "Cache-Control": "no-store" } });
}
