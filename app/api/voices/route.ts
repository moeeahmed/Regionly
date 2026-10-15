import { apiCtx, jsonError } from "@/lib/auth";
import { listVoices } from "@/lib/elevenlabs";

export async function GET() {
  try {
    await apiCtx();
    const voices = await listVoices();
    return Response.json({
      voices: voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category ?? "",
        accent: v.labels?.accent ?? "",
        gender: v.labels?.gender ?? "",
        preview: v.preview_url ?? null,
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
