const BASE = process.env.HIGGSFIELD_API_BASE || "https://api.higgsfield.ai";

export const HF_MODELS = {
  image: process.env.HIGGSFIELD_IMAGE_MODEL || "higgsfield-ai/soul/v2/standard",
  video: process.env.HIGGSFIELD_VIDEO_MODEL || "bytedance/seedance-2.0/reference-to-video",
};

/**
 * Higgsfield credentials. Either a single HIGGSFIELD_API_KEY exactly as the console shows it
 * (usually "keyid:secret"), or the older pair HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET.
 */
export function hfConfigured() {
  const e = process.env;
  return !!(e.HIGGSFIELD_API_KEY?.trim() || (e.HIGGSFIELD_API_KEY_ID && e.HIGGSFIELD_API_KEY_SECRET));
}

function auth() {
  const single = process.env.HIGGSFIELD_API_KEY?.trim();
  if (single) return single.includes(":") ? `Key ${single}` : `Bearer ${single}`;
  const idv = process.env.HIGGSFIELD_API_KEY_ID;
  const sec = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!idv || !sec) throw new Error("Higgsfield API key is not configured");
  return `Key ${idv}:${sec}`;
}

export type HfStatus = {
  status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";
  request_id: string;
  images?: { url: string }[];
  video?: { url: string };
  error?: string | null;
};

export async function hfSubmit(model: string, input: Record<string, unknown>, opts: { webhookUrl?: string; idempotencyKey: string }) {
  const qs = opts.webhookUrl ? `?hf_webhook=${encodeURIComponent(opts.webhookUrl)}` : "";
  const res = await fetch(`${BASE}/${model}${qs}`, {
    method: "POST",
    headers: {
      Authorization: auth(),
      "Content-Type": "application/json",
      "Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Higgsfield ${model} rejected the request (${res.status}): ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as HfStatus;
  if (!json.request_id) throw new Error("Higgsfield did not return a request_id");
  return json.request_id;
}

export async function hfStatus(requestId: string): Promise<HfStatus> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(requestId)}/status`, {
    headers: { Authorization: auth() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Higgsfield status check failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as HfStatus;
}

export function hfOutputUrl(s: Partial<HfStatus> & { payload?: { images?: { url: string }[]; video?: { url: string } } | null }) {
  return s.video?.url ?? s.images?.[0]?.url ?? s.payload?.video?.url ?? s.payload?.images?.[0]?.url ?? null;
}
