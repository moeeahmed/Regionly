import { createHmac } from "node:crypto";
import { join } from "node:path";
import { db } from "./db";
import { adaptAd, type Adaptation } from "./adapt";
import { addDubLanguage, getDubLanguage, listVoices, synthesizePcm } from "./elevenlabs";
import { HF_MODELS, hfOutputUrl, hfStatus, hfSubmit } from "./higgsfield";
import { download, muxAudio, pcmSeconds, pcmToWav, probe, stitch, uploadBuffer, uploadFile, withTmp } from "./media";
import { ASPECTS, getRegion, type Aspect, type Region } from "./regions";
import { grantCredits } from "./credits";
import { appUrl } from "./config";

export type JobOptions = {
  voiceId?: string;
  aspect?: Aspect;
  extraDirection?: string;
  useProductFrame?: boolean;
  resolution?: "480p" | "720p" | "1080p";
};

export type JobData = {
  adaptation?: Adaptation;
  dub?: { projectId: string; lang?: string; languageId?: string; audioUrl?: string; status?: string };
  voice?: { voiceId: string; scenes: { audioUrl: string; seconds: number }[] };
  talent?: { requestId?: string; imageUrl?: string; status?: string };
  clips?: { requestId: string; videoUrl?: string; status?: string }[];
  log?: { t: string; msg: string }[];
};

export type JobRow = {
  id: string;
  workspace_id: string;
  ad_id: string;
  mode: "dub" | "regenerate";
  region_code: string;
  region_label: string;
  locale: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  step: string;
  progress: number;
  credits_reserved: number;
  options: JobOptions;
  data: JobData;
  output_url: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type AdRow = {
  id: string;
  workspace_id: string;
  name: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_sec: number;
  width: number | null;
  height: number | null;
  aspect_ratio: string;
  source_language: string | null;
  transcript: string;
  brand_terms: string;
  product_notes: string;
  performance_notes: string;
  dub_project_id: string | null;
  created_at: string;
};

export const STEP_LABELS: Record<string, string> = {
  queued: "Queued",
  adapt: "Rewriting the script",
  dub_submit: "Starting the dub",
  dub_wait: "Dubbing voices",
  mux: "Rendering the video",
  voice: "Recording the voiceover",
  talent_submit: "Casting a presenter",
  talent_wait: "Generating the presenter",
  clips_submit: "Sending scenes",
  clips_wait: "Generating scenes",
  stitch: "Editing scenes together",
  done: "Done",
};

const FLOW: Record<JobRow["mode"], string[]> = {
  dub: ["adapt", "dub_submit", "dub_wait", "mux", "done"],
  regenerate: ["adapt", "voice", "talent_submit", "talent_wait", "clips_submit", "clips_wait", "stitch", "done"],
};

function nextStep(mode: JobRow["mode"], step: string) {
  const f = FLOW[mode];
  const i = f.indexOf(step);
  return f[Math.min(f.length - 1, i + 1)];
}

function progressFor(mode: JobRow["mode"], step: string) {
  const f = FLOW[mode];
  const i = Math.max(0, f.indexOf(step));
  return Math.round((i / (f.length - 1)) * 100);
}

export function webhookSig(jobId: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "x").update(`hf:${jobId}`).digest("hex").slice(0, 32);
}

function hfWebhook(jobId: string) {
  const base = appUrl();
  if (!base.startsWith("https://")) return undefined;
  return `${base}/api/webhooks/higgsfield?job=${jobId}&sig=${webhookSig(jobId)}`;
}

type Outcome = "advanced" | "waiting";

class Runner {
  constructor(public job: JobRow, public ad: AdRow, public region: Region) {}

  log(msg: string) {
    const log = this.job.data.log ?? [];
    log.push({ t: new Date().toISOString(), msg });
    this.job.data.log = log.slice(-40);
  }

  get aspect(): Aspect {
    const a = (this.job.options.aspect || this.ad.aspect_ratio) as Aspect;
    return a in ASPECTS ? a : "9:16";
  }

  async run(step: string): Promise<Outcome> {
    switch (step) {
      case "adapt": return this.adapt();
      case "dub_submit": return this.dubSubmit();
      case "dub_wait": return this.dubWait();
      case "mux": return this.mux();
      case "voice": return this.voice();
      case "talent_submit": return this.talentSubmit();
      case "talent_wait": return this.talentWait();
      case "clips_submit": return this.clipsSubmit();
      case "clips_wait": return this.clipsWait();
      case "stitch": return this.stitch();
      default: throw new Error(`Unknown step ${step}`);
    }
  }

  async adapt(): Promise<Outcome> {
    this.job.data.adaptation = await adaptAd({
      transcript: this.ad.transcript,
      sourceLanguage: this.ad.source_language,
      durationSec: this.ad.duration_sec,
      region: this.region,
      brandTerms: this.ad.brand_terms,
      productNotes: this.ad.product_notes,
      performanceNotes: this.ad.performance_notes,
      extraDirection: this.job.options.extraDirection,
    });
    this.log(`Script rewritten for ${this.region.label} (${this.job.data.adaptation.scenes.length} scenes)`);
    return "advanced";
  }

  async dubSubmit(): Promise<Outcome> {
    if (!this.ad.dub_project_id) throw new Error("This ad has no ElevenLabs dubbing project yet");
    const q = await db();
    const siblings = (await q`
      SELECT data FROM jobs WHERE ad_id = ${this.ad.id} AND id <> ${this.job.id} AND mode = 'dub'
        AND status <> 'failed' AND data->'dub'->>'languageId' IS NOT NULL
        AND data->'dub'->>'lang' = ${this.region.dubLang}
      LIMIT 1`) as { data: JobData }[];
    let languageId = siblings[0]?.data.dub?.languageId;
    if (!languageId) {
      const lang = await addDubLanguage(this.ad.dub_project_id, this.region.dubLang);
      languageId = lang.language_id;
      this.log(`ElevenLabs language target ${this.region.dubLang} created`);
    } else {
      this.log(`Reusing the ${this.region.dubLang} dub from another market`);
    }
    this.job.data.dub = { projectId: this.ad.dub_project_id, lang: this.region.dubLang, languageId, status: "queued" };
    return "advanced";
  }

  async dubWait(): Promise<Outcome> {
    const d = this.job.data.dub!;
    const lang = await getDubLanguage(d.projectId, d.languageId!);
    d.status = lang.status;
    if (lang.status === "failed") throw new FatalError(`ElevenLabs couldn't dub this ad: ${lang.error?.error ?? "no reason given"}`);
    if ((lang.status === "completed" || lang.status === "stale") && lang.outputs?.lossless_audio) {
      d.audioUrl = lang.outputs.lossless_audio;
      this.log("Dub finished");
      return "advanced";
    }
    return "waiting";
  }

  async mux(): Promise<Outcome> {
    const d = this.job.data.dub!;
    if (!d.audioUrl) {
      this.job.step = "dub_wait";
      return "waiting";
    }
    try {
      const url = await withTmp(async (dir) => {
        const v = await download(this.ad.video_url, join(dir, "src.mp4"));
        const a = await download(d.audioUrl!, join(dir, "dub.flac"));
        const out = await muxAudio(v, a, join(dir, "out.mp4"), this.ad.duration_sec);
        return uploadFile(out, `outputs/${this.job.id}/${slug(this.ad.name)}-${this.region.code}.mp4`, "video/mp4");
      });
      this.job.output_url = url;
      this.log("Dubbed video rendered");
      return "advanced";
    } catch (e) {
      d.audioUrl = undefined;
      this.job.step = "dub_wait";
      throw e;
    }
  }

  async voice(): Promise<Outcome> {
    const scenes = this.job.data.adaptation!.scenes;
    let voiceId = this.job.options.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "";
    if (!voiceId) {
      const voices = await listVoices();
      if (!voices.length) throw new FatalError("Your ElevenLabs account has no voices to use");
      voiceId = voices[0].voice_id;
    }
    const out: { audioUrl: string; seconds: number }[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const pcm = await synthesizePcm(voiceId, scenes[i].voiceover);
      const wav = pcmToWav(pcm);
      const audioUrl = await uploadBuffer(wav, `work/${this.job.id}/vo_${i}.wav`, "audio/wav");
      out.push({ audioUrl, seconds: pcmSeconds(pcm) });
    }
    this.job.data.voice = { voiceId, scenes: out };
    this.log(`Voiceover recorded (${out.reduce((s, x) => s + x.seconds, 0).toFixed(1)}s)`);
    return "advanced";
  }

  async talentSubmit(): Promise<Outcome> {
    const a = this.job.data.adaptation!;
    const prompt = `${a.talent_prompt}. Photorealistic vertical-video ad still, natural skin texture, candid expression, shot on a modern smartphone, soft natural light, no text, no logos.`;
    const requestId = await hfSubmit(
      HF_MODELS.image,
      { prompt, aspect_ratio: this.aspect, resolution: "1080p", batch_size: 1, enhance_prompt: false },
      { idempotencyKey: `${this.job.id}-talent-${this.job.attempts}`, webhookUrl: hfWebhook(this.job.id) },
    );
    this.job.data.talent = { requestId, status: "queued" };
    this.log("Presenter requested from Higgsfield");
    return "advanced";
  }

  async talentWait(): Promise<Outcome> {
    const t = this.job.data.talent!;
    const s = await hfStatus(t.requestId!);
    t.status = s.status;
    if (s.status === "completed") {
      t.imageUrl = hfOutputUrl(s) ?? undefined;
      if (!t.imageUrl) throw new FatalError("Higgsfield finished but returned no image");
      this.log("Presenter generated");
      return "advanced";
    }
    if (s.status === "nsfw") throw new FatalError("Higgsfield's moderation rejected the presenter image. Change the direction and retry.");
    if (s.status === "failed" || s.status === "canceled") {
      this.job.step = "talent_submit";
      throw new Error(`Higgsfield presenter generation ${s.status}`);
    }
    return "waiting";
  }

  async clipsSubmit(): Promise<Outcome> {
    const a = this.job.data.adaptation!;
    const voice = this.job.data.voice!;
    const talent = this.job.data.talent!.imageUrl!;
    const useProduct = this.job.options.useProductFrame !== false && !!this.ad.thumbnail_url;
    const existing = this.job.data.clips ?? [];
    const clips = [...existing];
    for (let i = clips.length; i < a.scenes.length; i++) {
      const scene = a.scenes[i];
      const vo = voice.scenes[i];
      const duration = Math.min(15, Math.max(4, Math.ceil(vo.seconds + 0.6)));
      const refs = useProduct ? [talent, this.ad.thumbnail_url!] : [talent];
      const prompt = [
        `Image 1 is the on-camera presenter — keep their face, hair and wardrobe exactly.`,
        useProduct ? `Image 2 is a frame from the original ad: use it only for the product's look and the type of setting, never for the person.` : "",
        `The presenter speaks the words in audio 1 directly to camera in ${this.region.language}, with accurate lip-sync and natural gestures.`,
        `Shot: ${scene.visual}.`,
        `Authentic ${this.region.label} setting, UGC-style performance ad, handheld smartphone feel, natural light, no on-screen text.`,
      ].filter(Boolean).join(" ");
      const requestId = await hfSubmit(
        HF_MODELS.video,
        {
          prompt,
          image_urls: refs,
          audio_urls: [vo.audioUrl],
          duration,
          aspect_ratio: this.aspect,
          resolution: this.job.options.resolution ?? "720p",
          generate_audio: true,
        },
        { idempotencyKey: `${this.job.id}-clip-${i}-${this.job.attempts}`, webhookUrl: hfWebhook(this.job.id) },
      );
      clips.push({ requestId, status: "queued" });
      this.job.data.clips = clips;
    }
    this.log(`${clips.length} scene(s) sent to Higgsfield`);
    return "advanced";
  }

  async clipsWait(): Promise<Outcome> {
    const clips = this.job.data.clips!;
    for (const c of clips) {
      if (c.videoUrl) continue;
      const s = await hfStatus(c.requestId);
      c.status = s.status;
      if (s.status === "completed") c.videoUrl = hfOutputUrl(s) ?? undefined;
      if (s.status === "nsfw") throw new FatalError("Higgsfield's moderation rejected a scene. Change the direction and retry.");
      if (s.status === "failed" || s.status === "canceled") {
        const idx = clips.indexOf(c);
        this.job.data.clips = clips.slice(0, idx);
        this.job.step = "clips_submit";
        throw new Error(`Higgsfield scene ${idx + 1} ${s.status}`);
      }
    }
    if (clips.every((c) => c.videoUrl)) {
      this.log("All scenes generated");
      return "advanced";
    }
    return "waiting";
  }

  async stitch(): Promise<Outcome> {
    const clips = this.job.data.clips!;
    const voice = this.job.data.voice!;
    const { w, h } = ASPECTS[this.aspect];
    const url = await withTmp(async (dir) => {
      const parts: { video: string; audio: string }[] = [];
      for (let i = 0; i < clips.length; i++) {
        const v = await download(clips[i].videoUrl!, join(dir, `clip_${i}.mp4`));
        const a = await download(voice.scenes[i].audioUrl, join(dir, `vo_${i}.wav`));
        parts.push({ video: v, audio: a });
      }
      const out = await stitch(dir, parts, w, h, join(dir, "final.mp4"));
      const p = await probe(out);
      this.log(`Final cut ${p.duration.toFixed(1)}s at ${w}x${h}`);
      return uploadFile(out, `outputs/${this.job.id}/${slug(this.ad.name)}-${this.region.code}.mp4`, "video/mp4");
    });
    this.job.output_url = url;
    return "advanced";
  }
}

class FatalError extends Error {}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ad";
}

async function save(job: JobRow, unlock = false) {
  const q = await db();
  await q`
    UPDATE jobs SET status = ${job.status}, step = ${job.step}, progress = ${job.progress},
      data = ${JSON.stringify(job.data)}::jsonb, output_url = ${job.output_url}, error = ${job.error},
      attempts = ${job.attempts}, updated_at = now(),
      completed_at = ${job.status === "completed" ? new Date().toISOString() : null},
      locked_until = ${unlock ? null : new Date(Date.now() + 5 * 60_000).toISOString()}
    WHERE id = ${job.id}`;
}

const MAX_ATTEMPTS = 3;

export async function advanceJob(jobId: string, budgetMs = 200_000): Promise<void> {
  const q = await db();
  const locked = (await q`
    UPDATE jobs SET locked_until = now() + interval '5 minutes'
    WHERE id = ${jobId} AND status IN ('queued', 'running')
      AND (locked_until IS NULL OR locked_until < now())
    RETURNING *`) as JobRow[];
  const job = locked[0];
  if (!job) return;
  const ads = (await q`SELECT * FROM ads WHERE id = ${job.ad_id}`) as AdRow[];
  const region = getRegion(job.region_code);
  if (!ads[0] || !region) {
    job.status = "failed";
    job.error = "The ad or market for this version no longer exists";
    await save(job, true);
    return;
  }
  const runner = new Runner(job, ads[0], region);
  const started = Date.now();

  if (job.status === "queued") {
    job.status = "running";
    job.step = FLOW[job.mode][0];
  }

  try {
    while (job.step !== "done" && Date.now() - started < budgetMs) {
      const stepBefore = job.step;
      const outcome = await runner.run(job.step);
      if (outcome === "waiting") break;
      if (job.step === stepBefore) job.step = nextStep(job.mode, job.step);
      job.progress = progressFor(job.mode, job.step);
      job.error = null;
      await save(job);
    }
    if (job.step === "done") {
      job.status = "completed";
      job.progress = 100;
      runner.log("Ready to download");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    job.attempts += 1;
    job.error = msg;
    runner.log(`Error: ${msg}`);
    if (e instanceof FatalError || job.attempts >= MAX_ATTEMPTS) {
      job.status = "failed";
      await save(job, true);
      if (job.credits_reserved > 0) {
        await grantCredits(job.workspace_id, job.credits_reserved, `Refund for ${job.region_label}`, job.id);
        await q`UPDATE jobs SET credits_reserved = 0 WHERE id = ${job.id}`;
      }
      return;
    }
  }
  await save(job, true);
}

export async function advanceActive(limit = 10, budgetMs = 45_000) {
  const q = await db();
  const rows = (await q`
    SELECT id FROM jobs WHERE status IN ('queued','running')
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY updated_at ASC LIMIT ${limit}`) as { id: string }[];
  for (const r of rows) await advanceJob(r.id, budgetMs);
  return rows.length;
}
