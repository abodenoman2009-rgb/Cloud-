"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { AuthShell } from "@/components/auth-shell";
import { Spinner } from "@/components/ui";

export default function ForgotPage() {
  const { t, api, toast } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setDone(true);
      toast(t("auth.sendReset"));
    } catch (e2) {
      const code = (e2 as { code?: string }).code;
      setError(
        code === "email_not_configured"
          ? t("err.generic") + " (SMTP_URL)"
          : code === "invalid_email"
            ? t("auth.invalidEmail")
            : t("err.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell kicker="account recovery">
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("auth.forgotTitle")}</h1>
      <p className="mt-2 text-sm text-ink2">{t("auth.forgotSubtitle")}</p>

      {done ? (
        <div
          className="mt-6 rounded-xl border px-4 py-4 text-sm"
          style={{
            background: "var(--c-ok-soft)",
            borderColor: "var(--c-ok)",
            color: "var(--c-ok)",
          }}
        >
          ✓ {t("auth.sendReset")}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
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
          {error && (
            <p className="text-sm" style={{ color: "var(--c-danger)" }}>
              {error}
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            {busy && <Spinner />}
            {t("auth.sendReset")}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink2">
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
          {t("nav.login")}
        </Link>
      </p>
    </AuthShell>
  );
}
