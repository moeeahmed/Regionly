import { destroySession } from "@/lib/auth";

export async function POST(req: Request) {
  await destroySession();
  return Response.redirect(new URL("/", req.url), 303);
}
