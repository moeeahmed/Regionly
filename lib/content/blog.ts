export type Block = { h2: string } | { p: string } | { ul: string[] } | { quote: string };

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  minutes: number;
  tag: string;
  photo: string; // picsum id
  body: Block[];
};

export const POSTS: Post[] = [
  {
    slug: "translation-vs-transcreation",
    title: "Translation vs transcreation: why your best ad flops abroad",
    excerpt: "A word-for-word translation keeps the words and loses the reason the ad worked. Here's what to keep, and what to change.",
    date: "2026-10-15",
    minutes: 5,
    tag: "Strategy",
    photo: "308",
    body: [
      { p: "You have an ad that works. The hook stops the scroll, the proof lands, the offer converts. So you translate it for a new market, run it, and it underperforms. Nothing about the product changed. What changed is that the ad no longer speaks the way people there speak." },
      { h2: "What translation keeps, and what it loses" },
      { p: "A straight translation keeps the words. But ads rarely work because of their words alone. They work because of rhythm, references, the price that feels like a bargain, and a voice that sounds like someone the viewer knows." },
      { ul: [
        "A price like 40p means nothing in Mexico City. 9 pesos does.",
        "An informal, jokey tone that sells in the UK can read as careless in Japan, where a polite register is expected in ads.",
        "An idiom that works in English often turns into a literal sentence nobody would say.",
        "A hook that takes two seconds in English may take four in German, and the first seconds are where you win or lose the viewer.",
      ] },
      { h2: "Transcreation: keep the job, change the words" },
      { p: "Transcreation starts from what each line of the ad is for, not what it says. The hook's job is to stop the scroll. The proof's job is to make the claim believable. The offer's job is to make acting now feel easy. A transcreated ad gives each line the same job, written the way a local copywriter would write it." },
      { quote: "Ask of every line: what is this line doing? Then write a line that does that, for this audience." },
      { h2: "What to keep the same everywhere" },
      { ul: [
        "The structure: hook, problem, proof, offer, call to action.",
        "Your brand and product names, and any slogan you've trademarked.",
        "Claims you can stand behind. Never let a localised version claim more than the original.",
      ] },
      { h2: "How Regionly does it" },
      { p: "Regionly asks Claude to rewrite your script for each market using notes on that market's tone, register and currency, while keeping your brand words untouched. Every version comes with an English back-translation, so you can see exactly what it says before it goes live." },
    ],
  },
  {
    slug: "dub-or-regenerate",
    title: "Dub or regenerate? Choosing the right method for each market",
    excerpt: "Dubbing keeps your footage. Regenerating recasts it. Here's how to decide, market by market.",
    date: "2026-10-14",
    minutes: 4,
    tag: "Guide",
    photo: "212",
    body: [
      { p: "Regionly gives you two ways to localise an ad. They suit different ads and different markets, and you can mix them for the same ad." },
      { h2: "Dub when the person on screen is the point" },
      { p: "Dubbing keeps your footage, music and edit, and re-voices each speaker in the new language in their own cloned voice. It's the right choice when the ad's power comes from a specific person: a founder talking to camera, a creator your audience recognises, a customer telling their own story." },
      { ul: [
        "Founder-led and UGC-style ads",
        "Fast tests in a new market, where you want results before investing more",
        "Markets where your existing casting already feels natural",
      ] },
      { h2: "Regenerate when the setting gets in the way" },
      { p: "Regenerating keeps the structure, offer and product, then films the ad again with a local presenter and a local setting, voiced in the language. It's the right choice when your footage would feel foreign to the audience: the kitchen, the street, the weather or the person on screen." },
      { ul: [
        "Markets culturally far from where you shot the original",
        "Ads with no speech, where there's nothing to dub",
        "Testing a fresh angle on a proven script",
      ] },
      { h2: "A simple rule of thumb" },
      { p: "Start with a dub in markets close to your original, and regenerate where the setting or casting would stand out. Watch both beside the original and let performance decide where to invest next." },
    ],
  },
  {
    slug: "pre-launch-checklist",
    title: "A pre-launch checklist for localised video ads",
    excerpt: "Ten things to check before a localised ad goes live, from prices to captions.",
    date: "2026-10-13",
    minutes: 4,
    tag: "Checklist",
    photo: "625",
    body: [
      { p: "Localising an ad is quick now. Checking it is still on you. Run through this list for every market before you spend on it." },
      { h2: "The script" },
      { ul: [
        "Read the English back-translation in full. Does it say what you'd say?",
        "Are prices in local currency and believable for that market?",
        "Is every claim one you can support there? Rules on health, finance and comparison claims differ by country.",
        "Are brand and product names unchanged?",
      ] },
      { h2: "The edit" },
      { ul: [
        "Replace on-screen text: supers, prices, offers and the call to action.",
        "Check captions fit the frame. Some languages run much longer than English.",
        "For right-to-left languages such as Arabic, check captions and graphics read the right way.",
      ] },
      { h2: "The launch" },
      { ul: [
        "Check whether prices must be shown including tax in that market.",
        "Make sure the landing page the ad links to is localised too.",
        "Run the localised version against a translated control if you can, so you learn what the extra work is worth.",
      ] },
      { p: "Regionly flags pricing, claims and cultural points for each version and lists on-screen text replacements, but a native speaker's final read is always worth it for big spends." },
    ],
  },
  {
    slug: "write-ads-that-travel",
    title: "How to write ads that travel",
    excerpt: "Small choices when you write the original make every localised version better.",
    date: "2026-10-12",
    minutes: 3,
    tag: "Craft",
    photo: "42",
    body: [
      { p: "The easiest ads to localise were written with other markets in mind. You don't need to plan every version, just avoid the things that don't travel." },
      { h2: "Do" },
      { ul: [
        "Put the hook in the first line of speech, not only in on-screen text.",
        "State one clear number: a price, a saving or a time.",
        "Keep sentences short. They survive translation and fit on screen as captions.",
        "Leave a beat of silence at the end of lines. Some languages need more time.",
      ] },
      { h2: "Avoid" },
      { ul: [
        "Puns and wordplay that only work in one language.",
        "References to local holidays, sports or TV unless the ad is only for that market.",
        "Burned-in text you can't replace. Keep a clean version of the edit.",
      ] },
      { p: "Write the original this way and the localised versions will need fewer changes, keep more of the hook, and come back faster." },
    ],
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);
export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
