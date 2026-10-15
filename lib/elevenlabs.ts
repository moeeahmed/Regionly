const BASE = "https://api.elevenlabs.io";

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not configured");
  return k;
}

async function el(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "xi-api-key": key(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${init.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 400)}`);
  }
  return res;
}

export async function transcribe(file: Blob, filename: string) {
  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("file", file, filename);
  const res = await el("/v1/speech-to-text", { method: "POST", body: form });
  const json = (await res.json()) as { text?: string; language_code?: string };
  return { text: (json.text ?? "").trim(), language: json.language_code ?? null };
}

export async function synthesizePcm(voiceId: string, text: string) {
  const model = process.env.ELEVENLABS_TTS_MODEL || "eleven_v3";
  const res = await el(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_44100`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: model }),
  });
  return Buffer.from(await res.arrayBuffer());
}

export type Voice = { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string };

export async function listVoices(): Promise<Voice[]> {
  const res = await el("/v2/voices?page_size=100");
  const json = (await res.json()) as { voices?: Voice[] };
  return json.voices ?? [];
}

export async function createDubProject(opts: { sourceUrl: string; sourceLanguage?: string | null; keyterms?: string[]; reference?: string }) {
  const form = new FormData();
  form.append("source_url", opts.sourceUrl);
  if (opts.sourceLanguage) form.append("source_language", opts.sourceLanguage);
  if (opts.reference) form.append("reference", opts.reference.slice(0, 500));
  const terms = (opts.keyterms ?? []).map((t) => t.replace(/[<>{}\[\]\\]/g, "").trim()).filter((t) => t && t.length <= 50).slice(0, 200);
  if (terms.length) form.append("keyterms", JSON.stringify(terms));
  const res = await el("/v1/dubbing/project", { method: "POST", body: form });
  const json = (await res.json()) as { project_id: string; status: string };
  return json.project_id;
}


export type DubLanguage = {
  language_id: string;
  target_language: string;
  status: "queued" | "processing" | "completed" | "stale" | "failed";
  outputs?: { lossless_audio?: string | null } | null;
  error?: { error?: string } | null;
};

export async function addDubLanguage(projectId: string, targetLanguage: string) {
  const res = await el(`/v1/dubbing/project/${encodeURIComponent(projectId)}/language`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target_language: targetLanguage }),
  });
  return (await res.json()) as DubLanguage;
}

export async function getDubLanguage(projectId: string, languageId: string) {
  const res = await el(`/v1/dubbing/project/${encodeURIComponent(projectId)}/language/${encodeURIComponent(languageId)}`);
  return (await res.json()) as DubLanguage;
}
