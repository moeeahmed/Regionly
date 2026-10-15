export type Check = { key: string; label: string; ok: boolean; required: boolean; help: string };

export function configStatus(): Check[] {
  const e = process.env;
  return [
    { key: "DATABASE_URL", label: "Postgres database (Neon)", ok: !!(e.DATABASE_URL || e.POSTGRES_URL), required: true, help: "Add Neon from the Vercel Marketplace on the project's Storage tab. It sets DATABASE_URL for you." },
    { key: "SESSION_SECRET", label: "Session secret", ok: (e.SESSION_SECRET ?? "").length >= 16, required: true, help: "Any random string of 16 or more characters." },
    { key: "BLOB_READ_WRITE_TOKEN", label: "Vercel Blob storage", ok: !!e.BLOB_READ_WRITE_TOKEN, required: true, help: "Connect a Blob store to the project on the Storage tab." },
    { key: "ELEVENLABS_API_KEY", label: "ElevenLabs API key", ok: !!e.ELEVENLABS_API_KEY, required: true, help: "From elevenlabs.io, Developers, API keys. It needs Dubbing, Text to Speech, Speech to Text and Voices access." },
    { key: "HIGGSFIELD_API_KEY_ID", label: "Higgsfield API key", ok: !!e.HIGGSFIELD_API_KEY_ID?.trim(), required: true, help: "From the Higgsfield API console. Set HIGGSFIELD_API_KEY_ID to the key exactly as shown when you create it. It is only shown once." },
    { key: "ANTHROPIC_API_KEY", label: "Anthropic API key, for script rewrites", ok: !!e.ANTHROPIC_API_KEY, required: true, help: "From console.anthropic.com, API keys." },
    { key: "STRIPE_SECRET_KEY", label: "Stripe billing", ok: !!(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET), required: false, help: "Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the three STRIPE_PRICE_ IDs. The webhook URL is /api/webhooks/stripe." },
    { key: "LEGAL_ENTITY", label: "Company details for the legal pages", ok: !!(e.LEGAL_ENTITY && e.CONTACT_EMAIL), required: false, help: "Set LEGAL_ENTITY (your registered company name), LEGAL_ADDRESS and CONTACT_EMAIL. They appear in the privacy policy, terms and contact page." },
    { key: "CRON_SECRET", label: "Cron secret", ok: !!e.CRON_SECRET, required: false, help: "Protects the background job check at /api/cron/tick. Vercel sends it automatically once set." },
  ];
}

export function isConfigured() {
  return configStatus().every((c) => !c.required || c.ok);
}

export function appUrl(req?: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const PLANS = {
  starter: { name: "Starter", price: "£29/mo", credits: 200, env: "STRIPE_PRICE_STARTER", mode: "subscription" as const },
  growth: { name: "Growth", price: "£99/mo", credits: 800, env: "STRIPE_PRICE_GROWTH", mode: "subscription" as const },
  pack: { name: "Top-up pack", price: "£19 one-off", credits: 100, env: "STRIPE_PRICE_PACK", mode: "payment" as const },
};
export type PlanKey = keyof typeof PLANS;

export function estimateCredits(mode: "dub" | "regenerate", durationSec: number) {
  const mins = Math.max(1, Math.ceil(durationSec / 60));
  if (mode === "dub") return 10 * mins;
  const scenes = Math.min(6, Math.max(1, Math.ceil(durationSec / 12)));
  return 8 + 12 * scenes;
}
