"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Ads", match: (p: string) => p === "/app" || p.startsWith("/app/ads") },
  { href: "/app/jobs", label: "Localisations", match: (p: string) => p.startsWith("/app/jobs") },
  { href: "/app/team", label: "Team", match: (p: string) => p.startsWith("/app/team") },
  { href: "/app/billing", label: "Billing", match: (p: string) => p.startsWith("/app/billing") },
];

export function NavLinks() {
  const path = usePathname() ?? "";
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.match(path) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
