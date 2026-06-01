"use client";

import { FormEvent, useMemo, useState } from "react";
import { Building2, Lock, Mail, User } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthView = "login" | "request" | "reset";

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const primaryButtonClassName =
  "w-full border border-teal-200/35 bg-teal-300/18 text-teal-50 shadow-[0_12px_32px_rgba(20,184,166,0.18)] hover:bg-teal-300/28";

const copy = {
  login: {
    eyebrow: "Welcome back",
    title: "Sign in",
    body: "승인된 계정으로 SeeV에 접속하세요.",
  },
  request: {
    eyebrow: "Access request",
    title: "가입 신청",
    body: "이메일, 이름, 소속, 비밀번호를 제출하면 관리자가 승인 후 로그인할 수 있습니다.",
  },
  reset: {
    eyebrow: "Password reset",
    title: "비밀번호 재설정",
    body: "이메일, 이름, 소속 확인 후 새 비밀번호를 설정합니다.",
  },
};

function Field({
  icon,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium text-white/82">
      {label}
      <span className="relative mt-2 block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/38">
          {icon}
        </span>
        <input
          className={cn(
            "h-12 w-full rounded-lg border border-white/14 bg-white/10 px-4 pl-11 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/70 focus:bg-white/14 focus:ring-4 focus:ring-teal-300/10",
            className
          )}
          {...props}
        />
      </span>
    </label>
  );
}

export function AuthPanel({ initialView }: { initialView: AuthView }) {
  const [view, setView] = useState<AuthView>(initialView);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isPasswordValid = useMemo(
    () => passwordPattern.test(password),
    [password]
  );
  const canSetPassword = isPasswordValid && password === confirmPassword;

  function move(nextView: AuthView) {
    setView(nextView);
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const requestPassword = String(formData.get("password") ?? "");
    const requestPasswordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (!passwordPattern.test(requestPassword)) {
      setNotice("비밀번호는 영문과 숫자를 포함해 8자리 이상이어야 합니다.");
      return;
    }

    if (requestPassword !== requestPasswordConfirm) {
      setNotice("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/register-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name"),
        organization: formData.get("organization"),
        password: formData.get("password"),
        passwordConfirm: formData.get("passwordConfirm"),
      }),
    });
    const result = (await response.json()) as { message?: string };

    setNotice(result.message ?? "가입 신청 처리 중 문제가 발생했습니다.");
    setIsSubmitting(false);
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    const result = (await response.json()) as {
      message?: string;
      redirectTo?: string;
    };

    if (response.ok && result.redirectTo) {
      window.location.href = result.redirectTo;
      return;
    }

    setNotice(result.message ?? "로그인 처리 중 문제가 발생했습니다.");
    setIsSubmitting(false);
  }

  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSetPassword) {
      setNotice("비밀번호는 영문과 숫자를 포함해 8자리 이상이어야 합니다.");
      return;
    }

    setNotice("비밀번호가 설정되었습니다. 이제 로그인할 수 있습니다.");
    setView("login");
  }

  return (
    <section className="relative z-10 w-full max-w-md rounded-2xl border border-white/18 bg-white/10 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-px before:rounded-[15px] before:border before:border-white/12 before:content-['']">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />

      <div className="relative">
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          SeeV
        </Link>

        <div className="mt-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-200/80">
            {copy[view].eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            {copy[view].title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/62">
            {copy[view].body}
          </p>
        </div>

        {notice && (
          <p className="mt-6 rounded-xl border border-teal-200/20 bg-teal-200/10 p-4 text-sm leading-6 text-teal-50/82">
            {notice}
          </p>
        )}

        {view === "login" && (
          <form className="mt-8 space-y-5" method="post" onSubmit={submitLogin}>
            <Field
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              label="Email"
              icon={<Mail className="h-4 w-4" />}
            />
            <Field
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
            />
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className={primaryButtonClassName}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        )}

        {view === "request" && (
          <form className="mt-8 space-y-5" method="post" onSubmit={submitRequest}>
            <Field
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              label="Email"
              required
              icon={<Mail className="h-4 w-4" />}
            />
            <Field
              name="name"
              type="text"
              autoComplete="name"
              placeholder="홍길동"
              label="Name"
              required
              icon={<User className="h-4 w-4" />}
            />
            <Field
              name="organization"
              type="text"
              placeholder="소속"
              label="Organization"
              required
              icon={<Building2 className="h-4 w-4" />}
            />
            <Field
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
              placeholder="영문+숫자 8자리 이상"
              label="Password"
              required
              icon={<Lock className="h-4 w-4" />}
            />
            <Field
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="비밀번호 다시 입력"
              label="Confirm password"
              required
              icon={<Lock className="h-4 w-4" />}
            />
            <p className="text-sm leading-6 text-white/48">
              비밀번호는 서버에 원문으로 저장되지 않고 bcrypt로 해시되어 저장됩니다.
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className={primaryButtonClassName}
            >
              {isSubmitting ? "Submitting..." : "Request approval"}
            </Button>
          </form>
        )}

        {view === "reset" && (
          <form className="mt-8 space-y-5" method="post" onSubmit={submitReset}>
            <Field
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              label="Email"
              required
              icon={<Mail className="h-4 w-4" />}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                name="name"
                type="text"
                placeholder="이름"
                label="Name"
                required
                icon={<User className="h-4 w-4" />}
              />
              <Field
                name="organization"
                type="text"
                placeholder="소속"
                label="Organization"
                required
                icon={<Building2 className="h-4 w-4" />}
              />
            </div>
            <Field
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="영문+숫자 8자리 이상"
              label="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
            <Field
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              label="Confirm"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
            <p
              className={cn(
                "text-sm",
                password && !isPasswordValid
                  ? "text-rose-200"
                  : "text-white/48"
              )}
            >
              비밀번호는 영문과 숫자를 섞어 8자리 이상이어야 합니다.
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={!canSetPassword}
              className={primaryButtonClassName}
            >
              Set password
            </Button>
          </form>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {view !== "login" && (
            <Link
              href="/auth"
              onClick={() => move("login")}
              className="font-medium text-white/70 transition-colors hover:text-white"
            >
              Back to sign in
            </Link>
          )}
          {view !== "request" && (
            <Link
              href="/auth?mode=request"
              onClick={() => move("request")}
              className="font-medium text-teal-200/90 transition-colors hover:text-teal-100"
            >
              Request access
            </Link>
          )}
          {view !== "reset" && (
            <Link
              href="/auth?mode=reset"
              onClick={() => move("reset")}
              className="font-medium text-white/58 transition-colors hover:text-white"
            >
              Forgot password?
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
