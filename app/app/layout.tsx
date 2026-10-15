import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { NavLinks } from "@/components/NavLinks";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { requireCtx } from "@/lib/auth";
import { isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isConfigured()) redirect("/setup");
  const ctx = await requireCtx();
  return (
    <>
      <header className="topbar">
        <div className="container inner">
          <Brand href="/app" />
          <NavLinks />
          <div className="grow" />
          <WorkspaceSwitcher current={ctx.workspace.id} workspaces={ctx.workspaces} />
          <Link href="/app/billing" className="credits" aria-label={`${ctx.workspace.credits} credits left`}>
            <b>{ctx.workspace.credits}</b><span>credits</span>
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="btn ghost sm" title={ctx.user.email}>Sign out</button>
          </form>
        </div>
      </header>
      <main className="container page">{children}</main>
    </>
  );
}
