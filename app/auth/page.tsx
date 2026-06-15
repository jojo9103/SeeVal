import type { Metadata } from "next";

import { AuthPanel } from "@/components/auth-panel";

export const metadata: Metadata = {
  title: "SeeV Login",
};

type AuthPageProps = {
  searchParams: Promise<{
    mode?: string;
    next?: string;
  }>;
};

function getInitialMode(mode?: string) {
  if (mode === "request" || mode === "reset") {
    return mode;
  }

  return "login";
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#171717] px-6 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(20,184,166,0.22),transparent_28%),radial-gradient(circle_at_82%_24%,rgba(96,165,250,0.16),transparent_26%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35" />

      <AuthPanel initialView={getInitialMode(params.mode)} nextPath={params.next} />
    </main>
  );
}
