/** Site-wide details used by the marketing and legal pages. Set the env vars in Vercel before launch. */
export const SITE = {
  name: "Regionly",
  tagline: "Turn the ad that already works into a native ad for every market.",
  /** Registered legal name of the business that operates Regionly. */
  legalEntity: process.env.LEGAL_ENTITY || "",
  /** Address shown in the legal pages. */
  legalAddress: process.env.LEGAL_ADDRESS || "",
  contactEmail: process.env.CONTACT_EMAIL || "",
  jurisdiction: "England and Wales",
  legalUpdated: "15 October 2026",
};

export const operator = () => SITE.legalEntity || "the operator of Regionly";
export const legalReady = () => !!(SITE.legalEntity && SITE.contactEmail);

export const NAV = [
  { href: "/about", label: "Why Regionly" },
  { href: "/features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

export const FOOTER = [
  {
    title: "Features",
    links: [
      { href: "/features/dub", label: "Dub with ElevenLabs" },
      { href: "/features/regenerate", label: "Regenerate with Higgsfield" },
      { href: "/features/back-translation", label: "Back-translation" },
      { href: "/features/workspaces", label: "Team workspaces" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/compare", label: "Compare" },
      { href: "/tools", label: "Free tools" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/data-deletion", label: "Data deletion" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/about", label: "Why Regionly" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/login", label: "Log in" },
    ],
  },
];
