"use client";

import { useRouter } from "next/navigation";

export function WorkspaceSwitcher({ current, workspaces }: { current: string; workspaces: { id: string; name: string }[] }) {
  const router = useRouter();
  if (workspaces.length < 2) return null;
  return (
    <select
      aria-label="Workspace"
      value={current}
      style={{ width: "auto", minHeight: 40 }}
      onChange={async (e) => {
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId: e.target.value }),
        });
        router.push("/app");
        router.refresh();
      }}
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  );
}
