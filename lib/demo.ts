/**
 * Content for the live localisation demo on the landing page.
 * Drop real MP4 files into /public/demo and list them in `video` to replace the
 * animated stand-in scene; captions stay in sync with the video's playback time.
 */

export type DemoLine = { start: number; end: number; text: string };

export type DemoMarket = {
  locale: string;
  label: string;
  rtl?: boolean;
  video?: string;
  scene: string; // background tint for the stand-in scene
  photo: string; // picsum id used as the scene's stand-in footage
  back: string; // English back-translation of the price line
  note: string; // one sentence on what was adapted
  lines: DemoLine[];
  changes: string[];
};

/** Stock photograph (Unsplash licence, served by picsum.photos) at a given crop. */
export function photoUrl(id: string, w: number, h: number) {
  return `https://picsum.photos/id/${id}/${w}/${h}`;
}

export const PHOTO_CREDITS = [
  "Luke Chesser",
  "Charles L.",
  "Sylwia Bartyzel",
  "Breather",
  "Kevin Young",
  "Victor Erixon",
];

export const DEMO_LENGTH = 12;

const T = [
  [0, 3],
  [3, 6],
  [6, 9],
  [9, 12],
] as const;

function lines(texts: string[]): DemoLine[] {
  return texts.map((text, i) => ({ start: T[i][0], end: T[i][1], text }));
}

export const ORIGINAL: DemoMarket = {
  locale: "en-GB",
  label: "Original",
  scene: "#3d4a5c",
  photo: "42",
  back: "Brewly pods work out at 40p a cup.",
  note: "The original, in English (UK).",
  lines: lines([
    "I stopped buying coffee out.",
    "Brewly pods work out at 40p a cup.",
    "Same café taste, made at home.",
    "First box is 20% off. Link below.",
  ]),
  changes: [],
};

export const MARKETS: DemoMarket[] = [
  {
    locale: "es-MX",
    label: "Mexico",
    scene: "#7a4a32",
    photo: "308",
    back: "With Brewly, each cup comes to 9 pesos.",
    note: "Price in pesos, the informal tú, and a street setting instead of a London café.",
    lines: lines([
      "Dejé de comprar café en la calle.",
      "Con Brewly, cada taza sale en 9 pesos.",
      "El mismo sabor de cafetería, en tu casa.",
      "Tu primera caja con 20% de descuento.",
    ]),
    changes: ["40p → 9 pesos", "Informal “tú” register", "Brewly kept as-is"],
  },
  {
    locale: "de-DE",
    label: "Germany",
    scene: "#4a5a4f",
    photo: "212",
    back: "With Brewly, a cup costs 45 cents.",
    note: "The price proof moves to the second line and the claims are toned down for German rules.",
    lines: lines([
      "Ich kaufe keinen Kaffee mehr unterwegs.",
      "Mit Brewly kostet die Tasse 45 Cent.",
      "Café-Geschmack, ganz einfach zu Hause.",
      "Erste Box 20 % günstiger. Link unten.",
    ]),
    changes: ["40p → 45 Cent", "Price proof moved up", "Formal claims softened"],
  },
  {
    locale: "ja-JP",
    label: "Japan",
    scene: "#6b6f78",
    photo: "625",
    back: "With Brewly, about 80 yen per cup.",
    note: "Polite form, shorter lines for subtitles, and a quieter home setting.",
    lines: lines([
      "外でコーヒーを買うのをやめました。",
      "Brewlyなら1杯あたり約80円。",
      "カフェの味を、おうちで。",
      "初回ボックスは20%オフ。",
    ]),
    changes: ["40p → 約80円", "Polite です/ます form", "Shorter lines for subtitles"],
  },
  {
    locale: "ar-AE",
    label: "UAE",
    rtl: true,
    scene: "#5c4a3a",
    photo: "1067",
    back: "With Brewly, a cup for just two dirhams.",
    note: "Gulf Arabic phrasing, captions set right to left, and a Dubai skyline.",
    lines: lines([
      "توقفت عن شراء القهوة من الخارج.",
      "مع Brewly، الكوب بدرهمين فقط.",
      "نفس طعم المقهى، في بيتك.",
      "خصم 20% على أول علبة.",
    ]),
    changes: ["40p → 2 dirhams", "Right-to-left captions", "Gulf Arabic phrasing"],
  },
  {
    locale: "pt-BR",
    label: "Brazil",
    scene: "#3f6150",
    photo: "281",
    back: "With Brewly, each cup comes to R$ 2.50.",
    note: "Price in reais, the informal você and an upbeat outdoor delivery.",
    lines: lines([
      "Parei de comprar café na rua.",
      "Com Brewly, cada xícara sai R$ 2,50.",
      "O mesmo sabor de cafeteria, em casa.",
      "Primeira caixa com 20% off.",
    ]),
    changes: ["40p → R$ 2,50", "Informal “você”", "Upbeat delivery"],
  },
];

export const PIPELINE = ["Transcribe", "Rewrite for market", "Clone voice", "Lip-sync", "Render"];
