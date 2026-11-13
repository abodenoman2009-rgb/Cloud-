"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { GoogleG } from "@/components/auth-shell";
import { Loading, Toggle } from "@/components/ui";
import { formatDate } from "@/lib/util";
import { LogOut, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const { t, lang, user, setUser, theme, setTheme, setLang, api, toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      await fetch("/api/auth/me").catch(() => undefined);
      setLoading(false);
    })();
  }, []);

  if (loading || !user) return <Loading />;

  async function patchPrefs(patch: { wifiOnly?: boolean; autoUpload?: boolean }) {
    try {
      const res = await api<{ user: typeof user }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setUser(res.user);
      toast(t("settings.saved"));
    } catch {
      toast(t("err.generic"), "err");
    }
  }

  async function changePassword() {
    if (next.length < 8) return toast(t("auth.shortPassword"), "err");
    setBusy(true);
    try {
      await api("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      toast(t("settings.changePassword"));
      setCurrent("");
      setNext("");
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }

  async function logoutAll() {
    try {
      await api("/api/auth/logout-all", { method: "POST" });
      toast(t("auth.loggedOut"));
      window.location.href = "/login";
    } catch {
      toast(t("err.generic"), "err");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h2 className="text-xl font-bold tracking-tight">{t("settings.title")}</h2>

      {/* Account */}
      <section className="panel mt-5 p-5">
        <div className="label">{t("settings.account")}</div>
        <div className="mt-3 flex items-center gap-4">
          <div
            className="flex size-14 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: "var(--c-accent-soft)", color: "var(--c-accent)" }}
          >
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className="size-full rounded-full object-cover" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{user.name}</div>
            <div className="truncate text-sm text-ink3" dir="ltr">
              {user.email}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="chip" data-active={user.provider === "google"}>
                {t("settings.provider")}: {user.provider === "google" ? "Google" : "Email"}
              </span>
              <span className="chip">{formatDate(user.createdAt, lang)}</span>
            </div>
          </div>
        </div>

        {user.provider !== "google" && (
          <a href="/api/auth/google?mode=link&next=/app/settings" className="btn btn-outline mt-4 w-full">
            <GoogleG />
            {t("settings.linkGoogle")}
          </a>
        )}
        {user.provider === "google" && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "var(--c-ok-soft)", color: "var(--c-ok)" }}
          >
            <ShieldCheck size={15} />
            {t("settings.linkedGoogle")}
          </div>
        )}
      </section>

      {/* Appearance */}
      <section className="panel mt-4 p-5">
        <div className="label">{t("settings.appearance")}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="chip" data-active={theme === "light"} onClick={() => setTheme("light")}>
            {t("common.light")}
          </button>
          <button className="chip" data-active={theme === "dark"} onClick={() => setTheme("dark")}>
            {t("common.dark")}
          </button>
          <span className="mx-2 w-px bg-line" />
          <button className="chip" data-active={lang === "ar"} onClick={() => setLang("ar")}>
            العربية
          </button>
          <button className="chip" data-active={lang === "en"} onClick={() => setLang("en")}>
            English
          </button>
        </div>
      </section>

      {/* Upload rules */}
      <section className="panel mt-4 px-5 py-2">
        <div className="label pt-3">{t("settings.uploadRules")}</div>
        <Toggle
          checked={user.wifiOnly}
          onChange={(v) => void patchPrefs({ wifiOnly: v })}
          label={t("upload.wifiOnly")}
        />
        <div className="h-px bg-line" />
        <Toggle
          checked={user.autoUpload}
          onChange={(v) => void patchPrefs({ autoUpload: v })}
          label={t("upload.autoUpload")}
          hint={t("upload.largeOk")}
        />
      </section>

      {/* Security */}
      <section className="panel mt-4 p-5">
        <div className="label">{t("settings.security")}</div>
        <p className="mt-2 text-sm leading-relaxed text-ink2">{t("settings.encrypted")}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink2">{t("settings.backup")}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="field"
            type="password"
            dir="ltr"
            placeholder={t("auth.password")}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <input
            className="field"
            type="password"
            dir="ltr"
            placeholder={t("auth.newPassword")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <button className="btn btn-outline mt-3 w-full" onClick={() => void changePassword()} disabled={busy}>
          {t("settings.changePassword")}
        </button>

        <button
          className="btn btn-ghost mt-3 w-full"
          style={{ color: "var(--c-danger)" }}
          onClick={() => void logoutAll()}
        >
          <LogOut size={15} />
          {t("settings.logoutAll")}
        </button>
      </section>

      <section className="panel mt-4 p-5">
        <div className="label">{t("storage.engine")}</div>
        <p className="mt-2 font-mono text-[12px] text-ink2">
          {t("storage.encryption")} · OAuth 2.0 + PKCE · HttpOnly / SameSite session cookie
        </p>
      </section>
    </div>
  );
}
