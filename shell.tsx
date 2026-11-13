"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Folder,
  Gauge,
  Images,
  LogOut,
  Moon,
  Settings,
  Sun,
  Languages,
  Upload,
} from "lucide-react";
import { useApp } from "@/components/providers";
import { Logo } from "@/components/logo";
import type { TranslationKey } from "@/lib/i18n";

const NAV: Array<{ href: string; key: TranslationKey; icon: typeof Gauge }> = [
  { href: "/app", key: "nav.dashboard", icon: Gauge },
  { href: "/app/gallery", key: "nav.gallery", icon: Images },
  { href: "/app/upload", key: "nav.upload", icon: Upload },
  { href: "/app/albums", key: "nav.albums", icon: Folder },
  { href: "/app/settings", key: "nav.settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, user, setUser, theme, setTheme, lang, setLang, toast } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  const activeHref = NAV.filter((n) => pathname.startsWith(n.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const title =
    NAV.find((n) => n.href === activeHref)?.key &&
    t(NAV.find((n) => n.href === activeHref)!.key);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setUser(null);
    toast(t("auth.loggedOut"));
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh">
      {/* Vertical drive-bay rail (desktop) */}
      <nav className="fixed inset-y-0 start-0 z-40 hidden w-[86px] flex-col items-center border-e border-line bg-panel py-5 lg:flex">
        <Link href="/" aria-label={t("brand.name")} className="text-ink">
          <Logo size={32} />
        </Link>
        <div className="mt-8 flex flex-1 flex-col items-center gap-1.5">
          {NAV.map((n) => {
            const active = n.href === activeHref;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="group flex w-[68px] flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 transition-colors"
                style={{
                  background: active ? "var(--c-accent-soft)" : "transparent",
                  color: active ? "var(--c-accent)" : "var(--c-ink-2)",
                }}
              >
                <n.icon size={19} />
                <span className="text-[10.5px] font-semibold leading-none">{t(n.key)}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="led" title="online" />
          <span className="label text-[9px]">sync</span>
        </div>
      </nav>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/88 backdrop-blur-md lg:ps-[86px]">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="lg:hidden">
              <Logo size={26} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
              <span className="label hidden sm:block">{t("brand.name")}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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

            <div className="relative">
              <button
                className="ms-1 flex size-9 items-center justify-center rounded-full border border-line bg-panel2 text-xs font-bold"
                onClick={() => setMenu((v) => !v)}
                aria-label={t("nav.profile")}
              >
                {user?.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.picture} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  <span>{(user?.name ?? "?").trim().charAt(0).toUpperCase()}</span>
                )}
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="panel absolute end-0 top-11 z-20 w-60 p-2">
                    <div className="px-2 py-2">
                      <div className="truncate text-sm font-semibold">{user?.name}</div>
                      <div className="truncate text-xs text-ink3" dir="ltr">
                        {user?.email}
                      </div>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link
                      href="/app/settings"
                      className="block rounded-lg px-2 py-2 text-sm hover:bg-panel2"
                      onClick={() => setMenu(false)}
                    >
                      {t("nav.settings")}
                    </Link>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-panel2"
                      style={{ color: "var(--c-danger)" }}
                      onClick={logout}
                    >
                      <LogOut size={15} />
                      {t("nav.logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pb-24 lg:ps-[86px] lg:pb-8">{children}</main>

      {/* Bottom bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const active = n.href === activeHref;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--c-accent)" : "var(--c-ink-2)" }}
            >
              <n.icon size={18} />
              <span className="text-[10px] font-semibold">{t(n.key)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
