import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";
import { POSTS } from "@/lib/content/blog";
import { FEATURES } from "@/lib/content/features";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const pages = ["", "/about", "/features", "/blog", "/compare", "/tools", "/changelog", "/faq", "/contact", "/privacy", "/terms", "/cookies", "/data-deletion", "/signup", "/login"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...FEATURES.map((f) => ({ url: `${base}/features/${f.slug}`, priority: 0.7 })),
    ...POSTS.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.date, priority: 0.6 })),
  ];
}
