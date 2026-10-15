import { createHmac, timingSafeEqual } from "node:crypto";

function key() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("Stripe is not configured");
  return k;
}

function encode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") out.push(...encode(v as Record<string, unknown>, name));
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, unknown>, method = "POST", apiVersion?: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && params ? `?${encode(params).join("&")}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      ...(apiVersion ? { "Stripe-Version": apiVersion } : {}),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "GET" ? undefined : encode(params ?? {}).join("&"),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe: ${json.error?.message ?? res.statusText}`);
  return json;
}

/** Verify a Stripe webhook signature header (v1 scheme, 5 minute tolerance). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const t = parts.t;
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => {
    const a = Buffer.from(s);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
