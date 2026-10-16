const BASE = process.env.HIGGSFIELD_API_BASE || "https://api.higgsfield.ai";

export const HF_MODELS = {
  image: process.env.HIGGSFIELD_IMAGE_MODEL || "higgsfield-ai/soul/v2/standard",
  video: process.env.HIGGSFIELD_VIDEO_MODEL || "bytedance/seedance-2.0/reference-to-video",
};

/** Higgsfield credential, exactly as the console shows it (usually "keyid:secret"). */
export function hfConfigured() {
  return !!process.env.HIGGSFIELD_API_KEY_ID?.trim();
}

function auth() {
  const key = process.env.HIGGSFIELD_API_KEY_ID?.trim();
  if (!key) throw new Error("Higgsfield API key is not configured");
  const [id, secret] = key.split(":");
  if (key.includes(":") && (!id || !secret)) throw new Error("HIGGSFIELD_API_KEY_ID looks incomplete: expected keyid:secret with both parts");
  if (!key.includes(":")) console.warn("HIGGSFIELD_API_KEY_ID has no ':' so it is sent as a Bearer token; Higgsfield keys are normally keyid:secret");
  return key.includes(":") ? `Key ${key}` : `Bearer ${key}`;
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
