import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";

export default async function Signup() {
  if (await getCtx()) redirect("/app");
  return (
    <>
      <header className="topbar"><div className="container inner"><Brand /></div></header>
      <main className="auth-wrap">
        <Suspense><AuthForm mode="signup" /></Suspense>
      </main>
    </>
  );
}
