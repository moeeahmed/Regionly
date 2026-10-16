import type { Region } from "./regions";

export type Scene = { voiceover: string; visual: string; seconds: number };

export type Adaptation = {
  headline_insight: string;
  adapted_script: string;
  back_translation: string;
  cultural_changes: string[];
  on_screen_text: { original: string; localized: string }[];
  compliance_flags: string[];
  talent_prompt: string;
  scenes: Scene[];
};

const TOOL = {
  name: "submit_localisation",
  description: "Return the fully localised ad plan for the target region.",
  input_schema: {
    type: "object",
    properties: {
      headline_insight: { type: "string", description: "One sentence on why the original ad performs and how that hook is preserved in this market." },
      adapted_script: { type: "string", description: "Full voiceover script in the target language and locale, natural for native speakers. Not a literal translation." },
      back_translation: { type: "string", description: "English back-translation of adapted_script so the marketer can check it." },
      cultural_changes: { type: "array", items: { type: "string" }, description: "Concrete adaptations made (idioms, references, currency, units, casting, settings)." },
      on_screen_text: {
        type: "array",
        items: { type: "object", properties: { original: { type: "string" }, localized: { type: "string" } }, required: ["original", "localized"] },
        description: "Supers, captions, prices and CTAs to replace in the edit.",
      },
      compliance_flags: { type: "array", items: { type: "string" }, description: "Advertising-regulation or sensitivity risks to check in this market. Empty if none." },
      talent_prompt: {
        type: "string",
        description: "English image prompt for a photoreal on-camera presenter and setting authentic to this market, matching the original ad's role, energy and product context. Describe person, wardrobe, location, lighting, framing. No brand logos, no text.",
      },
      scenes: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        description: "The adapted script split into consecutive shots for regeneration. Each voiceover must be speakable in 3-13 seconds.",
        items: {
          type: "object",
          properties: {
            voiceover: { type: "string", description: "The exact line spoken in this shot, in the target language." },
            visual: { type: "string", description: "English shot description for a video model: action, camera move, framing. The presenter speaks the line to camera unless it's B-roll." },
            seconds: { type: "number", description: "Estimated spoken duration in seconds (3-13)." },
          },
          required: ["voiceover", "visual", "seconds"],
        },
      },
    },
    required: ["headline_insight", "adapted_script", "back_translation", "cultural_changes", "on_screen_text", "compliance_flags", "talent_prompt", "scenes"],
  },
} as const;

export async function adaptAd(input: {
  transcript: string;
  sourceLanguage: string | null;
  durationSec: number;
  region: Region;
  brandTerms: string;
  productNotes: string;
  performanceNotes: string;
  extraDirection?: string;
}): Promise<Adaptation> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const { region } = input;

  const prompt = `You are a senior performance-marketing localisation lead. Transcreate a proven, high-performing video ad for a new market. Preserve what makes it convert (hook in the first 2 seconds, problem→solution flow, proof, offer, CTA) while making it feel native to the market — not translated.

TARGET MARKET: ${region.label} (${region.locale}, ${region.language}). Currency: ${region.currency}.
MARKET NOTES: ${region.notes}
SOURCE LANGUAGE: ${input.sourceLanguage ?? "auto-detected"}
ORIGINAL DURATION: ${input.durationSec.toFixed(1)}s — the adapted script must fit within ±10% of this when spoken at a natural ad pace.
BRAND / PRODUCT TERMS TO KEEP UNTRANSLATED: ${input.brandTerms || "(none given)"}
PRODUCT NOTES: ${input.productNotes || "(none)"}
WHY IT PERFORMS (from the marketer): ${input.performanceNotes || "(not given — infer from the script)"}
${input.extraDirection ? `EXTRA DIRECTION: ${input.extraDirection}\n` : ""}
ORIGINAL VOICEOVER TRANSCRIPT:
"""
${input.transcript || "(no speech detected — the ad is music/visual only; write a short native voiceover that fits the product notes)"}
"""

Rules:
- Convert prices to ${region.currency} only if the original states a price; otherwise do not invent prices or claims.
- Never invent product claims, statistics or testimonials that aren't in the original.
- Split the adapted script into ${Math.min(6, Math.max(1, Math.ceil(input.durationSec / 12)))} scene(s) of 3–13 seconds of speech each.
Call submit_localisation with the result.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      tools: [TOOL],
      // Forcing a tool ("tool"/"any") is rejected by this model; "auto" plus the prompt's instruction is enough.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Script adaptation failed (${res.status}): ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { content: { type: string; name?: string; input?: Adaptation }[] };
  const block = json.content.find((c) => c.type === "tool_use" && c.name === TOOL.name);
  if (!block?.input) throw new Error("Script adaptation returned no result");
  const a = block.input;
  a.scenes = (a.scenes ?? []).filter((s) => s.voiceover?.trim()).slice(0, 6);
  if (!a.scenes.length) a.scenes = [{ voiceover: a.adapted_script, visual: "Presenter speaks to camera", seconds: Math.min(13, input.durationSec) }];
  return a;
}
