"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page on an interval while something is still processing. */
export function AutoRefresh({ active, ms = 6000, pingJobIds = [] }: { active: boolean; ms?: number; pingJobIds?: string[] }) {
  const router = useRouter();
  const key = pingJobIds.slice(0, 8).join(",");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      // Pinging a job nudges its pipeline forward server-side.
      await Promise.allSettled((key ? key.split(",") : []).map((id) => fetch(`/api/jobs/${id}`, { cache: "no-store" })));
      router.refresh();
    }, ms);
    return () => clearInterval(t);
  }, [active, ms, router, key]);
  return null;
}
