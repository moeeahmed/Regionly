import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Brand } from "@/components/Brand";

export default function Login() {
  return (
    <>
      <header className="topbar"><div className="container inner"><Brand /></div></header>
      <main className="auth-wrap">
        <Suspense><AuthForm mode="login" /></Suspense>
      </main>
    </>
  );
}
