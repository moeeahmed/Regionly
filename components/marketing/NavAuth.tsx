"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Public pages stay static; this swaps the login buttons for "Open app" once the session is confirmed. */
export function NavAuth() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSignedIn(!!j.signedIn))
      .catch(() => {});
  }, []);
  if (signedIn) return <Link href="/app" className="lp-btn lp-btn-sm">Open app</Link>;
  return (
    <>
      <Link href="/login" className="lp-login">Log in</Link>
      <Link href="/signup" className="lp-btn lp-btn-sm">Start free</Link>
    </>
  );
}
