export function StatusPill({ status, label }: { status: string; label?: string }) {
  const cls = status === "completed" ? "good" : status === "failed" ? "bad" : status === "running" || status === "queued" ? "work" : "";
  const text = label ?? (status === "completed" ? "Ready" : status === "failed" ? "Failed" : status === "running" ? "In progress" : "Queued");
  return <span className={`status ${cls}`}>{text}</span>;
}
