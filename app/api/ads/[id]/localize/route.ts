import { after } from "next/server";
import { apiCtx, HttpError, jsonError } from "@/lib/auth";
import { db, id } from "@/lib/db";
import { estimateCredits, REGENERATE_ENABLED } from "@/lib/config";
import { grantCredits, reserveCredits } from "@/lib/credits";
import { createDubProject } from "@/lib/elevenlabs";
import { advanceJob, type AdRow, type JobOptions } from "@/lib/pipeline";
import { ASPECTS, getRegion, type Aspect } from "@/lib/regions";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await apiCtx();
    const { id: adId } = await params;
    const body = (await req.json()) as {
      regions?: string[];
      mode?: "dub" | "regenerate";
      voiceId?: string;
      aspect?: string;
      extraDirection?: string;
      useProductFrame?: boolean;
    };
    const mode = body.mode === "regenerate" ? "regenerate" : "dub";
    if (mode === "regenerate" && !REGENERATE_ENABLED) throw new HttpError(400, "Regenerate is coming soon. Dub is available now.");
    const regions = [...new Set(body.regions ?? [])].map(getRegion).filter((r): r is NonNullable<typeof r> => !!r);
    if (!regions.length) throw new HttpError(400, "Pick at least one market.");
    if (regions.length > 20) throw new HttpError(400, "Pick up to 20 markets at a time.");

    const q = await db();
    const ads = (await q`SELECT * FROM ads WHERE id = ${adId} AND workspace_id = ${ctx.workspace.id}`) as AdRow[];
    const ad = ads[0];
    if (!ad) throw new HttpError(404, "That ad doesn't exist in this workspace.");

    if (mode === "dub") {
      const src = (ad.source_language ?? "").slice(0, 2).toLowerCase();
      const same = regions.filter((r) => r.dubLang.slice(0, 2) === src);
      if (src && same.length) {
        throw new HttpError(400, `${same.map((r) => r.label).join(", ")} already speak${same.length === 1 ? "s" : ""} the ad's language. Use Regenerate for ${same.length === 1 ? "that market" : "those markets"}.`);
      }
      if (!ad.transcript) throw new HttpError(400, "There's no speech in this ad to dub. Use Regenerate instead.");
    }

    const options: JobOptions = {
      voiceId: body.voiceId || undefined,
      aspect: body.aspect && body.aspect in ASPECTS ? (body.aspect as Aspect) : undefined,
      extraDirection: (body.extraDirection ?? "").slice(0, 1000) || undefined,
      useProductFrame: body.useProductFrame !== false,
    };

    const perJob = estimateCredits(mode, ad.duration_sec);
    const total = perJob * regions.length;
    await reserveCredits(ctx.workspace.id, total, `${mode === "dub" ? "Dub" : "Regenerate"} "${ad.name}" for ${regions.length} market${regions.length === 1 ? "" : "s"}`);

    try {
      if (mode === "dub" && !ad.dub_project_id) {
        const projectId = await createDubProject({
          sourceUrl: ad.video_url,
          sourceLanguage: ad.source_language,
          keyterms: ad.brand_terms.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
          reference: `regionly:${ad.id}`,
        });
        await q`UPDATE ads SET dub_project_id = ${projectId} WHERE id = ${ad.id}`;
      }
    } catch (e) {
      await grantCredits(ctx.workspace.id, total, "Refund: ElevenLabs dubbing couldn't start");
      throw e;
    }

    const jobIds: string[] = [];
    for (const r of regions) {
      const jobId = id("job");
      jobIds.push(jobId);
      await q`
        INSERT INTO jobs (id, workspace_id, ad_id, created_by, mode, region_code, region_label, locale, credits_reserved, options)
        VALUES (${jobId}, ${ctx.workspace.id}, ${ad.id}, ${ctx.user.id}, ${mode}, ${r.code}, ${r.label}, ${r.locale}, ${perJob}, ${JSON.stringify(options)}::jsonb)`;
    }

    after(async () => {
      await Promise.allSettled(jobIds.map((j) => advanceJob(j, 240_000)));
    });

    return Response.json({ jobIds, creditsUsed: total });
  } catch (e) {
    return jsonError(e);
  }
}
