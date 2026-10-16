"use client";

import { useEffect, useState } from "react";

/** A status notice that fades away after a few seconds and drops the checkout params from the URL. */
export function PaymentNotice({ message, seconds = 6 }: { message: string; seconds?: number }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setShown(false);
      window.history.replaceState(null, "", window.location.pathname);
    }, seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  if (!shown) return null;
  return <div className="notice warn" role="status" style={{ marginBottom: 24 }}>{message}</div>;
}
