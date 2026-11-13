"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { Brand } from "@/components/logo";
import { Moon, Sun, Languages } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";

const ERROR_MAP: Record<string, TranslationKey> = {
  google_not_configured: "oauth.notConfigured",
  access_denied: "oauth.accessDenied",
  invalid_state: "oauth.invalidState",
  callback_error: "oauth.callbackError",
  email_unverified: "oauth.emailUnverified",
  link_exists: "oauth.linkExists",
  account_exists: "oauth.accountExists",
  signin_required: "oauth.signinRequired",
};

const NOTICE_MAP: Record<string, TranslationKey> = {
  linked: "oauth.linked",
  success: "auth.registered",
  logged_out: "auth.loggedOut",
};

export function authErrorKey(code: string | null | undefined): TranslationKey | null {
  if (!code) return null;
  return ERROR_MAP[code] ?? null;
}

export function noticeKey(code: string | null | undefined): TranslationKey | null {
  if (!code) return null;
  return NOTICE_MAP[code] ?? null;
}

export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Controls() {
  const { lang, setLang, theme, setTheme, t } = useApp();
  return (
    <div className="flex items-center gap-1.5">
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        title={t("common.language")}
        aria-label={t("common.language")}
      >
        <Languages size={15} />
        <span className="font-mono text-[11px]">{lang === "ar" ? "EN" : "ع"}</span>
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={t("common.theme")}
        aria-label={t("common.theme")}
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}

export function AuthShell({
  children,
  kicker,
}: {
  children: ReactNode;
  kicker: string;
}) {
  const { t } = useApp();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.02fr_1fr]">
      <div className="relative flex flex-col px-6 py-7 sm:px-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-ink">
            <Brand />
          </Link>
          <Controls />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="label">{kicker}</p>
          {children}
        </div>

        <p className="mx-auto max-w-md text-center text-[11px] leading-relaxed text-ink3">
          {t("storage.encryption")} · OAuth 2.0 + PKCE · {t("hero.f4t")}
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-s border-line lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-drive.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "60% 50%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(255deg, rgba(10,11,12,0.15) 0%, rgba(10,11,12,0.72) 62%, rgba(10,11,12,0.9) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <div className="max-w-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="led" />
              <span className="label" style={{ color: "rgba(255,255,255,.7)" }}>
                storage online
              </span>
            </div>
            <p
              className="text-2xl font-semibold leading-snug"
              style={{ color: "#f4f1ea" }}
            >
              {t("hero.title")}
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(244,241,234,.72)" }}>
              {t("hero.sub")}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
