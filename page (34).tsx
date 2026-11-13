"use client";

import Link from "next/link";
import { useApp } from "@/components/providers";
import { Brand } from "@/components/logo";
import { ArrowLeft, HardDrive, ShieldCheck, Wifi, Moon, Sun, Languages } from "lucide-react";

const FEATURES = ["hero.f1t", "hero.f1d", "hero.f2t", "hero.f2d", "hero.f3t", "hero.f3d", "hero.f4t", "hero.f4d"] as const;

export default function LandingPage() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const featurePairs = [
    { icon: HardDrive, a: FEATURES[0], b: FEATURES[1] },
    { icon: ShieldCheck, a: FEATURES[2], b: FEATURES[3] },
    { icon: Wifi, a: FEATURES[4], b: FEATURES[5] },
    { icon: ShieldCheck, a: FEATURES[6], b: FEATURES[7] },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Brand />
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              aria-label={t("common.language")}
            >
              <Languages size={15} />
              <span className="font-mono text-[11px]">{lang === "ar" ? "EN" : "ع"}</span>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={t("common.theme")}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <Link href="/login" className="btn btn-outline btn-sm">
              {t("nav.login")}
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              {t("nav.register")}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — asymmetric, image bleeding off the inline edge */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div className="animate-rise">
          <div className="flex items-center gap-2">
            <span className="led" />
            <span className="label">{t("brand.tag")}</span>
          </div>
          <h1 className="mt-5 text-[clamp(2.4rem,6vw,4.2rem)] font-bold leading-[1.05] tracking-tight">
            {t("hero.title")}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink2">{t("hero.sub")}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className="btn btn-primary">
              {t("hero.cta")}
              <ArrowLeft size={17} />
            </Link>
            <Link href="/login" className="btn btn-outline">
              {t("hero.ctaLogin")}
            </Link>
          </div>

          {/* Instrument-panel readout */}
          <div className="panel-flat mt-10 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="label">
                  {t("storage.used")} · {lang === "ar" ? "نموذج توضيحي" : "demo"}
                </div>
                <div className="tnum mt-1 font-mono text-3xl font-semibold" style={{ color: "var(--c-accent)" }}>
                  3.6 {lang === "ar" ? "ج.ب" : "GB"}
                  <span className="text-base font-normal text-ink3"> / 15 {lang === "ar" ? "ج.ب" : "GB"}</span>
                </div>
              </div>
              <div className="text-end">
                <div className="label">{t("storage.saved")}</div>
                <div className="tnum mt-1 font-mono text-lg font-semibold text-ok">2.1 {lang === "ar" ? "ج.ب" : "GB"}</div>
              </div>
            </div>
            <div className="gauge mt-4">
              <div className="gauge-fill" style={{ width: "24%" }} />
              <div className="gauge-ticks" />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-ink3">
              <span>sha256 verified</span>
              <span>chunk 8 MiB · resume on</span>
              <span>tls 1.3</span>
              <span>s3-compatible</span>
            </div>
          </div>
        </div>

        <div className="relative animate-rise">
          <div className="panel relative overflow-hidden p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-drive.jpg"
              alt="قرص تخزين خارجي من الألومنيوم"
              className="h-[300px] w-full object-cover sm:h-[420px]"
              style={{ objectPosition: "55% 50%" }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-32"
              style={{ background: "linear-gradient(to top, rgba(12,13,14,.82), transparent)" }}
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-2">
                <span className="led" />
                <span className="label" style={{ color: "rgba(255,255,255,.75)" }}>
                  encrypted · synced
                </span>
              </div>
              <span className="tnum font-mono text-xs" style={{ color: "rgba(255,255,255,.8)" }}>
                12,480 files
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial numbered list with hairlines — not a card grid */}
      <section className="border-y border-line bg-panel">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
            <h2 className="text-xl font-semibold">{t("upload.title")} · {t("space.title")}</h2>
            <span className="label">01 — 04</span>
          </div>
          <ul>
            {featurePairs.map((f, i) => (
              <li
                key={f.a}
                className="grid items-baseline gap-x-6 gap-y-1 border-b border-line py-6 md:grid-cols-[auto_0.9fr_1.1fr]"
              >
                <span className="tnum font-mono text-sm text-ink3">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex items-center gap-2.5 text-lg font-semibold">
                  <f.icon size={17} style={{ color: "var(--c-accent)" }} />
                  {t(f.a)}
                </span>
                <span className="text-sm leading-relaxed text-ink2">{t(f.b)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Free-up ledger teaser */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="panel p-6">
            <div className="label">{t("space.deviceFiles")}</div>
            <ul className="mt-4 space-y-2.5 font-mono text-[13px] text-ink2">
              {[
                ["IMG_4821.HEIC", "4.2 " + (lang === "ar" ? "م.ب" : "MB")],
                ["VID_0912.MP4", "318 " + (lang === "ar" ? "م.ب" : "MB")],
                ["Scan_0091.PDF", "1.1 " + (lang === "ar" ? "م.ب" : "MB")],
              ].map(([n, s]) => (
                <li key={n} className="flex items-center justify-between gap-3 border-b border-line pb-2">
                  <span className="truncate">{n}</span>
                  <span className="tnum text-ink3">{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-ink3">{t("space.disclaimer")}</p>
          </div>

          <div className="panel p-6" style={{ borderColor: "var(--c-accent)" }}>
            <div className="label" style={{ color: "var(--c-accent)" }}>
              {t("space.savings")}
            </div>
            <div className="tnum mt-3 font-mono text-5xl font-bold" style={{ color: "var(--c-accent)" }}>
              +1.9 {lang === "ar" ? "ج.ب" : "GB"}
            </div>
            <div className="mt-5 space-y-2 text-sm text-ink2">
              <div className="flex items-center gap-2">
                <span className="led" />
                {t("space.verified")}
              </div>
              <div className="flex items-center gap-2">
                <span className="led led-warn" />
                {t("space.notReady")}
              </div>
            </div>
            <Link href="/register" className="btn btn-primary mt-6 w-full">
              {t("space.scan")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-ink3 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Cloud Hard Drive</span>
          <span className="font-mono">
            Google OAuth 2.0 · PKCE · PostgreSQL · S3-compatible object storage
          </span>
        </div>
      </footer>
    </div>
  );
}
