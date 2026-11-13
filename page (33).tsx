"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { AuthShell, GoogleG, authErrorKey, noticeKey } from "@/components/auth-shell";
import { Spinner } from "@/components/ui";

function LoginForm() {
  const { t, api, setUser, toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errKey = authErrorKey(params.get("error"));
  const notice = noticeKey(params.get("notice"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ user: unknown }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(res.user as never);
      toast(t("auth.title"));
      router.replace("/app");
    } catch (e2) {
      const code = (e2 as { code?: string }).code;
      setError(
        code === "use_google"
          ? t("auth.useGoogle")
          : code === "invalid_credentials"
            ? t("auth.invalidCredentials")
            : t("err.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("auth.title")}</h1>
      <p className="mt-2 text-sm text-ink2">{t("auth.subtitle")}</p>

      {(errKey || notice) && (
        <div
          className="mt-5 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: errKey ? "var(--c-warn-soft)" : "var(--c-ok-soft)",
            borderColor: errKey ? "var(--c-warn)" : "var(--c-ok)",
            color: errKey ? "var(--c-warn)" : "var(--c-ok)",
          }}
        >
          {errKey ? t(errKey) : notice ? t(notice) : ""}
        </div>
      )}

      <button
        className="btn btn-outline mt-6 w-full"
        onClick={() => {
          window.location.href = `/api/auth/google?mode=login&next=${encodeURIComponent("/app")}`;
        }}
      >
        <GoogleG />
        {t("auth.google")}
      </button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="label">{t("auth.or")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label mb-1.5 block" htmlFor="email">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            className="field"
            dir="ltr"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label" htmlFor="password">
              {t("auth.password")}
            </label>
            <Link href="/forgot" className="text-xs text-ink2 underline underline-offset-4">
              {t("auth.forgot")}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            className="field"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--c-danger)" }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy} type="submit">
          {busy && <Spinner />}
          {t("auth.title")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink2">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-ink underline underline-offset-4">
          {t("nav.register")}
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  const { t } = useApp();
  return (
    <AuthShell kicker="sign in · secure session">
      <Suspense fallback={<div className="py-16 text-center text-ink3">{t("common.loading")}</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
