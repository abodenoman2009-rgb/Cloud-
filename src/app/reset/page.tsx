"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { AuthShell } from "@/components/auth-shell";
import { Spinner } from "@/components/ui";

function ResetForm() {
  const { t, api, toast } = useApp();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError(t("auth.shortPassword"));
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
      toast(t("common.done"));
    } catch {
      setError(t("err.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell kicker="set new password">
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("auth.resetTitle")}</h1>

      {done ? (
        <div
          className="mt-6 rounded-xl border px-4 py-4 text-sm"
          style={{ background: "var(--c-ok-soft)", borderColor: "var(--c-ok)", color: "var(--c-ok)" }}
        >
          ✓ {t("common.done")}
          <Link href="/login" className="mt-3 block font-semibold underline underline-offset-4">
            {t("nav.login")}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {!params.get("token") && (
            <div>
              <label className="label mb-1.5 block" htmlFor="token">
                reset token
              </label>
              <input
                id="token"
                className="field"
                dir="ltr"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label mb-1.5 block" htmlFor="np">
              {t("auth.newPassword")}
            </label>
            <input
              id="np"
              type="password"
              className="field"
              dir="ltr"
              minLength={8}
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
            {t("common.save")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
