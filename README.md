# Regionly — AI ad localisation SaaS

Upload a high-performing video ad and localise it for any market:

- **Dub mode (ElevenLabs Dubbing v2):** keeps the original footage; every speaker is re-voiced in the target language with a cloned voice, then the dubbed track is muxed back onto the original video.
- **Regenerate mode (Higgsfield + ElevenLabs):** Claude transcreates the script into market-native scenes, ElevenLabs records the voiceover, Higgsfield Soul V2 casts a local presenter, Seedance 2.0 generates lip-synced scenes from the presenter + voice, and ffmpeg edits them into the final ad.

Every job also produces a cultural adaptation report: localised script, back-translation, on-screen text replacements and compliance flags.

## Stack

Next.js 15 (App Router) · Neon Postgres · Vercel Blob · ffmpeg-static · Stripe (REST) · ElevenLabs · Higgsfield · Anthropic Claude.
No auth or ORM libraries — sessions are HMAC-signed cookies, passwords use scrypt.

## How jobs run on serverless

Each localisation is a resumable state machine stored in `jobs.data` (`lib/pipeline.ts`). `advanceJob()` takes a row lock, runs steps until it has to wait on a provider, and saves after every step. It is triggered by:

1. the localise request itself (`after()`),
2. the job page polling `/api/jobs/:id` every few seconds,
3. Higgsfield webhooks (`/api/webhooks/higgsfield`, HMAC-signed per job),
4. a daily cron (`/api/cron/tick`) as a safety net. On Vercel Pro you can change it to every minute in `vercel.json`.

Failed jobs retry up to 3 times and refund their credits automatically.

## Setup

See `.env.example`. Then open `/setup` on the deployment to check which services are connected.

Stripe: create two recurring prices (Starter, Growth) and one one-time price (Top-up), set their IDs, and add a webhook endpoint at `/api/webhooks/stripe` for `checkout.session.completed`, `invoice.paid` and `customer.subscription.deleted`.
