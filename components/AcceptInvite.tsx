"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack">
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/invite/${token}`, { method: "POST" });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(j.error ?? "The invite couldn't be accepted.");
            setBusy(false);
            return;
          }
          router.push("/app");
          router.refresh();
        }}
      >
        {busy ? "Joining" : "Accept invite"}
      </button>
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
