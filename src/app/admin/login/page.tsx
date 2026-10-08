import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { DisplayTitle } from "@/components/ui/display-title";
import { isAdmin, isAdminConfigured } from "@/lib/auth";

const LoginGate = async () => {
  if (await isAdmin()) redirect("/admin");
  return <LoginForm configured={isAdminConfigured()} />;
};

const LoginPage = () => (
  <main className="stage flex min-h-dvh flex-col justify-center gap-12">
    <DisplayTitle text="Адмін" className="text-[clamp(48px,14vw,160px)]" />
    <Suspense fallback={<p className="tag animate-pulse">Підключення…</p>}>
      <LoginGate />
    </Suspense>
  </main>
);

export default LoginPage;
