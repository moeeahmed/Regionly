import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { db, id } from "@/lib/db";
import { download, extractAudio, extractFrame, probe, uploadFile, withTmp } from "@/lib/media";
import { transcribe } from "@/lib/elevenlabs";
import { closestAspect } from "@/lib/regions";

export const maxDuration = 300;

export async function GET() {
  try {
    const ctx = await apiCtx();
    const q = await db();
    const ads = await q`SELECT * FROM ads WHERE workspace_id = ${ctx.workspace.id} ORDER BY created_at DESC LIMIT 200`;
    return Response.json({ ads });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await apiCtx();
    const body = (await req.json()) as {
      name?: string;
      videoUrl?: string;
      brandTerms?: string;
      productNotes?: string;
      performanceNotes?: string;
    };
    const name = (body.name ?? "").trim().slice(0, 120) || "Untitled ad";
    let host = "";
    try {
      host = new URL(body.videoUrl ?? "").hostname;
    } catch {}
    if (!host.endsWith(".blob.vercel-storage.com")) throw new HttpError(400, "Upload the video first.");

    const adId = id("ad");
    const meta = await withTmp(async (dir) => {
      const src = await download(body.videoUrl!, join(dir, "src"));
      const p = await probe(src);
      if (!p.duration) throw new HttpError(400, "That file couldn't be played as a video. Export it as MP4 and try again.");
      if (p.duration > 180) throw new HttpError(400, "That ad is longer than 3 minutes. Trim it and upload again.");
      const thumb = await extractFrame(src, Math.min(1.5, p.duration / 3), join(dir, "thumb.jpg"));
      const thumbnailUrl = await uploadFile(thumb, `ads/${adId}/thumb.jpg`, "image/jpeg");
      let transcript = "";
      let language: string | null = null;
      if (p.hasAudio) {
        const mp3 = await extractAudio(src, join(dir, "audio.mp3"));
        const r = await transcribe(new Blob([new Uint8Array(await readFile(mp3))], { type: "audio/mpeg" }), "audio.mp3");
        transcript = r.text;
        language = r.language;
      }
      return { ...p, thumbnailUrl, transcript, language };
    });

    const q = await db();
    await q`
      INSERT INTO ads (id, workspace_id, created_by, name, video_url, thumbnail_url, duration_sec, width, height,
        aspect_ratio, source_language, transcript, brand_terms, product_notes, performance_notes)
      VALUES (${adId}, ${ctx.workspace.id}, ${ctx.user.id}, ${name}, ${body.videoUrl!}, ${meta.thumbnailUrl},
        ${meta.duration}, ${meta.width}, ${meta.height}, ${closestAspect(meta.width, meta.height)}, ${meta.language},
        ${meta.transcript}, ${(body.brandTerms ?? "").slice(0, 500)}, ${(body.productNotes ?? "").slice(0, 2000)},
        ${(body.performanceNotes ?? "").slice(0, 2000)})`;
    return Response.json({ id: adId });
  } catch (e) {
    return jsonError(e);
  }
}
