export type Region = {
  code: string;
  label: string;
  flag: string;
  locale: string;
  language: string;
  dubLang: string;
  currency: string;
  notes: string;
};

export const REGIONS: Region[] = [
  { code: "us", label: "United States", flag: "US", locale: "en-US", language: "English (US)", dubLang: "en", currency: "USD", notes: "Direct, benefit-led, energetic CTAs. Imperial units." },
  { code: "uk", label: "United Kingdom", flag: "GB", locale: "en-GB", language: "English (UK)", dubLang: "en", currency: "GBP", notes: "Understated, dry humour, avoid hype. British spelling, metric units." },
  { code: "au", label: "Australia", flag: "AU", locale: "en-AU", language: "English (AU)", dubLang: "en", currency: "AUD", notes: "Casual, friendly, self-deprecating. Southern-hemisphere seasons." },
  { code: "in", label: "India", flag: "IN", locale: "hi-IN", language: "Hindi", dubLang: "hi", currency: "INR", notes: "Family and value oriented; Hinglish code-switching is common in ads." },
  { code: "mx", label: "Mexico", flag: "MX", locale: "es-MX", language: "Spanish (Mexico)", dubLang: "es", currency: "MXN", notes: "Warm, family-centric, use 'ustedes', local idioms over Castilian." },
  { code: "es", label: "Spain", flag: "ES", locale: "es-ES", language: "Spanish (Spain)", dubLang: "es", currency: "EUR", notes: "Castilian Spanish, 'vosotros', playful and social tone." },
  { code: "ar", label: "Argentina", flag: "AR", locale: "es-AR", language: "Spanish (Argentina)", dubLang: "es", currency: "ARS", notes: "Voseo ('vos'), expressive, football references land well." },
  { code: "br", label: "Brazil", flag: "BR", locale: "pt-BR", language: "Portuguese (Brazil)", dubLang: "pt", currency: "BRL", notes: "Upbeat, informal 'você', emotional and social-proof driven." },
  { code: "pt", label: "Portugal", flag: "PT", locale: "pt-PT", language: "Portuguese (Portugal)", dubLang: "pt", currency: "EUR", notes: "More formal than Brazil; European Portuguese vocabulary." },
  { code: "fr", label: "France", flag: "FR", locale: "fr-FR", language: "French", dubLang: "fr", currency: "EUR", notes: "Elegant, quality-focused, avoid aggressive hard sell; Loi Toubon French copy." },
  { code: "ca-fr", label: "Quebec", flag: "CA", locale: "fr-CA", language: "French (Canada)", dubLang: "fr", currency: "CAD", notes: "Québécois vocabulary, friendly and local pride." },
  { code: "de", label: "Germany", flag: "DE", locale: "de-DE", language: "German", dubLang: "de", currency: "EUR", notes: "Precise, factual, proof points and specs; 'du' for D2C brands." },
  { code: "it", label: "Italy", flag: "IT", locale: "it-IT", language: "Italian", dubLang: "it", currency: "EUR", notes: "Style, craftsmanship, food and family imagery." },
  { code: "nl", label: "Netherlands", flag: "NL", locale: "nl-NL", language: "Dutch", dubLang: "nl", currency: "EUR", notes: "No-nonsense, value for money, direct." },
  { code: "se", label: "Sweden", flag: "SE", locale: "sv-SE", language: "Swedish", dubLang: "sv", currency: "SEK", notes: "Calm, sustainable, egalitarian; avoid boasting (lagom)." },
  { code: "pl", label: "Poland", flag: "PL", locale: "pl-PL", language: "Polish", dubLang: "pl", currency: "PLN", notes: "Value conscious, trust and reviews matter." },
  { code: "tr", label: "Türkiye", flag: "TR", locale: "tr-TR", language: "Turkish", dubLang: "tr", currency: "TRY", notes: "Hospitable, family, strong promo/discount culture." },
  { code: "sa", label: "Saudi Arabia", flag: "SA", locale: "ar-SA", language: "Arabic (Gulf)", dubLang: "ar", currency: "SAR", notes: "Modest wardrobe and imagery, family values, respect Ramadan context." },
  { code: "ae", label: "UAE", flag: "AE", locale: "ar-AE", language: "Arabic (Gulf)", dubLang: "ar", currency: "AED", notes: "Premium, aspirational, multicultural; modest imagery." },
  { code: "eg", label: "Egypt", flag: "EG", locale: "ar-EG", language: "Arabic (Egyptian)", dubLang: "ar", currency: "EGP", notes: "Humour and warmth, Egyptian colloquial lands best." },
  { code: "jp", label: "Japan", flag: "JP", locale: "ja-JP", language: "Japanese", dubLang: "ja", currency: "JPY", notes: "Polite register, detail and quality, kawaii or minimal aesthetics; avoid overclaiming." },
  { code: "kr", label: "South Korea", flag: "KR", locale: "ko-KR", language: "Korean", dubLang: "ko", currency: "KRW", notes: "Trend-driven, beauty and tech savvy, polished visuals." },
  { code: "cn", label: "China", flag: "CN", locale: "zh-CN", language: "Mandarin (Simplified)", dubLang: "zh", currency: "CNY", notes: "Social proof, KOL style, lucky numbers; avoid 4." },
  { code: "id", label: "Indonesia", flag: "ID", locale: "id-ID", language: "Indonesian", dubLang: "id", currency: "IDR", notes: "Friendly, community, halal sensitivities." },
  { code: "ph", label: "Philippines", flag: "PH", locale: "fil-PH", language: "Filipino", dubLang: "fil", currency: "PHP", notes: "Taglish is natural; family and humour." },
  { code: "vn", label: "Vietnam", flag: "VN", locale: "vi-VN", language: "Vietnamese", dubLang: "vi", currency: "VND", notes: "Young, mobile-first, energetic." },
  { code: "th", label: "Thailand", flag: "TH", locale: "th-TH", language: "Thai", dubLang: "th", currency: "THB", notes: "Playful, emotional storytelling, respect for monarchy and religion." },
  { code: "ng", label: "Nigeria", flag: "NG", locale: "en-NG", language: "English (Nigeria)", dubLang: "en", currency: "NGN", notes: "Energetic, Pidgin phrases resonate, aspirational." },
  { code: "za", label: "South Africa", flag: "ZA", locale: "en-ZA", language: "English (South Africa)", dubLang: "en", currency: "ZAR", notes: "Diverse casting, local slang (lekker), value-driven." },
  { code: "ru", label: "Russia", flag: "RU", locale: "ru-RU", language: "Russian", dubLang: "ru", currency: "RUB", notes: "Practical, quality and durability focus." },
];

export function getRegion(code: string): Region | undefined {
  return REGIONS.find((r) => r.code === code);
}

export const ASPECTS = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
  "1:1": { w: 720, h: 720 },
  "3:4": { w: 720, h: 960 },
} as const;
export type Aspect = keyof typeof ASPECTS;

export function closestAspect(w?: number | null, h?: number | null): Aspect {
  if (!w || !h) return "9:16";
  const r = w / h;
  let best: Aspect = "9:16";
  let bestDiff = Infinity;
  for (const [k, v] of Object.entries(ASPECTS) as [Aspect, { w: number; h: number }][]) {
    const d = Math.abs(Math.log(r / (v.w / v.h)));
    if (d < bestDiff) {
      bestDiff = d;
      best = k;
    }
  }
  return best;
}
