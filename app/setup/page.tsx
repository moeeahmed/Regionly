import Link from "next/link";
import { Brand } from "@/components/Brand";
import { configStatus, isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Setup() {
  const checks = configStatus();
  const ready = isConfigured();
  const missing = checks.filter((c) => c.required && !c.ok).length;
  return (
    <>
      <header className="topbar"><div className="container inner"><Brand /></div></header>
      <main className="container page" style={{ maxWidth: 780 }}>
        <div className="page-head">
          <div>
            <h1>{ready ? "Everything's connected" : `Connect ${missing} more service${missing === 1 ? "" : "s"}`}</h1>
            <p className="sub">
              Add these as environment variables in your Vercel project under Settings, Environment Variables, then redeploy.
              This page only shows whether each one is set, never its value.
            </p>
          </div>
          {ready && <Link className="btn primary" href="/signup">Create the first account</Link>}
        </div>
        <ul className="panel" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {checks.map((c, i) => (
            <li key={c.key} style={{ padding: "18px 22px", borderTop: i ? "1px solid var(--rule)" : 0, display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{c.label}{!c.required && <span className="muted" style={{ fontWeight: 400 }}> (optional)</span>}</div>
                <p className="faint" style={{ marginTop: 4, maxWidth: "62ch" }}>{c.help}</p>
              </div>
              <span className={`status ${c.ok ? "good" : c.required ? "bad" : ""}`}>{c.ok ? "Connected" : "Not set"}</span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
