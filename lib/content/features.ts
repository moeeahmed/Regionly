export type Feature = {
  slug: string;
  name: string;
  title: string;
  sub: string;
  points: { title: string; text: string }[];
  steps: string[];
  bestFor: string[];
  cost: string;
};

export const FEATURES: Feature[] = [
  {
    slug: "dub",
    name: "Dub with ElevenLabs",
    title: "Keep your footage. Change the language.",
    sub: "Dub re-voices every speaker in your ad in the new language, in their own cloned voice, and lays the new track over your original edit.",
    points: [
      { title: "Your edit stays untouched", text: "Cuts, music, on-screen product and pacing are exactly as you made them. Only the voice track changes." },
      { title: "Each speaker keeps their voice", text: "ElevenLabs clones every speaker in the ad, so your founder or creator sounds like themselves in Spanish, German or Japanese." },
      { title: "One dub per language, shared across markets", text: "If you pick Spain and Mexico, the Spanish dub is made once and reused, so you only wait for it once." },
      { title: "A rewritten script to check against", text: "Claude still writes a market version of your script with a back-translation, so you can check meaning and update on-screen text." },
    ],
    steps: [
      "Upload the ad and list the brand words that must never change.",
      "Choose Dub and pick the markets.",
      "ElevenLabs dubs the audio. Regionly puts it back on your footage and renders an MP4.",
      "Watch it beside the original and download.",
    ],
    bestFor: ["Founder-led and UGC ads", "Ads where the person on screen is the brand", "Fast tests in a new market"],
    cost: "10 credits per minute of ad, per market.",
  },
  {
    slug: "regenerate",
    name: "Regenerate with Higgsfield · Coming soon",
    title: "Same hook. A local presenter and a local setting.",
    sub: "Regenerate keeps the structure, offer and product of your ad, then films it again for the market: a new presenter, a new setting and lip-synced scenes.",
    points: [
      { title: "A script written for the market", text: "Claude rewrites the ad into scenes for the market, keeping the hook in the first two seconds, the proof and the offer." },
      { title: "A presenter who fits", text: "Higgsfield generates a presenter and setting that suit the market, using a frame from your ad so the product looks right." },
      { title: "Voiced, then lip-synced", text: "ElevenLabs records the voiceover in the voice you choose, and each scene is generated to match it." },
      { title: "Edited into one ad", text: "Regionly cuts the scenes together at your chosen format, 9:16, 1:1, 3:4 or 16:9, and renders the final MP4." },
    ],
    steps: [
      "Upload the ad and add notes on what's being sold.",
      "Choose Regenerate, pick the markets, a voice and the format.",
      "Add direction if you like: casting, setting or tone.",
      "Review the presenter, the scenes and the finished ad, then download.",
    ],
    bestFor: ["Markets where your casting would feel foreign", "Ads with no speech to dub", "Testing new angles in a market"],
    cost: "20 to 80 credits per market, depending on the ad's length.",
  },
  {
    slug: "back-translation",
    name: "Back-translation and compliance",
    title: "Know exactly what every version says.",
    sub: "Every localised script comes with an English back-translation, a list of what changed and anything to check before it goes live.",
    points: [
      { title: "Read it in English", text: "The back-translation tells you what the Japanese or Arabic version actually says, not what you hope it says." },
      { title: "See what changed and why", text: "Prices, idioms, register and references that were adapted for the market are listed one by one." },
      { title: "Flags before launch", text: "Pricing, claims and cultural points worth checking in that market are flagged on the job page." },
      { title: "On-screen text, ready to swap", text: "Supers, prices and calls to action are listed with their localised versions for your editor." },
    ],
    steps: [
      "Localise an ad with either method.",
      "Open a version to see the script, back-translation and flags.",
      "Update on-screen text from the replacements list.",
      "Approve and download.",
    ],
    bestFor: ["Teams without native speakers for every market", "Regulated categories", "Brands with strict wording"],
    cost: "Included with every version.",
  },
  {
    slug: "workspaces",
    name: "Team workspaces",
    title: "One place for every ad, market and teammate.",
    sub: "Invite your team or clients to a workspace. Everyone shares the same ads, versions and credits, and each brand can have its own workspace.",
    points: [
      { title: "Invite by link", text: "Create an invite for a colleague's email. They join as soon as they sign in with it." },
      { title: "Owners, admins and members", text: "Owners and admins can invite people. Everyone can upload ads and localise them." },
      { title: "Shared credits", text: "Credits belong to the workspace, so the whole team draws from one balance with one bill." },
      { title: "Separate brands", text: "Agencies can keep a workspace per client and switch between them from the top bar." },
    ],
    steps: [
      "Open Team in the app.",
      "Create an invite link for a colleague's email.",
      "Send it to them. They join after signing in.",
      "Switch workspaces from the top bar when you work across brands.",
    ],
    bestFor: ["Growth and performance teams", "Agencies with several clients", "Founders working with a freelancer"],
    cost: "Included on every plan.",
  },
];

export const getFeature = (slug: string) => FEATURES.find((f) => f.slug === slug);
