"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/providers";
import { AuthShell, GoogleG } from "@/components/auth-shell";
import { Spinner } from "@/components/ui";

export default function RegisterPage() {
  const { t, api, setUser, toast } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError(t("auth.nameRequired"));
    if (password.length < 8) return setError(t("auth.shortPassword"));
    setBusy(true);
    try {
      const res = await api<{ user: unknown }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setUser(res.user as never);
      toast(t("auth.registered"));
      router.replace("/app");
    } catch (e2) {
      const code = (e2 as { code?: string }).code;
      setError(
        code === "email_exists"
          ? t("auth.emailExists")
          : code === "invalid_email"
            ? t("auth.invalidEmail")
            : code === "weak_password"
              ? t("auth.shortPassword")
              : t("err.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell kicker="create account · 15 gb free">
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("auth.registerTitle")}</h1>
      <p className="mt-2 text-sm text-ink2">{t("auth.registerSubtitle")}</p>

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
          <label className="label mb-1.5 block" htmlFor="name">
            {t("auth.name")}
          </label>
          <input
            id="name"
            className="field"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.name")}
          />
        </div>
        <div>
          <label className="label mb-1.5 block" htmlFor="email">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            className="field"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="label mb-1.5 block" htmlFor="password">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            className="field"
            dir="ltr"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="mt-1.5 text-[11px] text-ink3">{t("auth.shortPassword")}</p>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--c-danger)" }}>
            {error}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy} type="submit">
          {busy && <Spinner />}
          {t("nav.register")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink2">
        {t("auth.hasAccount")}{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
          {t("nav.login")}
        </Link>
      </p>
    </AuthShell>
  );
}
