"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isLang, translate, type Lang, type TranslationKey } from "@/lib/i18n";
import type { PublicUser } from "@/lib/types";

type Theme = "light" | "dark";

type Toast = { id: number; message: string; tone: "ok" | "err" };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (k: TranslationKey) => string;
  user: PublicUser | null;
  userLoading: boolean;
  setUser: (u: PublicUser | null) => void;
  reloadUser: () => Promise<void>;
  toast: (message: string, tone?: "ok" | "err") => void;
  api: <T>(url: string, init?: RequestInit) => Promise<T>;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside <Providers>");
  return ctx;
}

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [theme, setThemeState] = useState<Theme>("light");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    try {
      const storedLang = localStorage.getItem("chd_lang");
      if (isLang(storedLang)) setLangState(storedLang);
      const storedTheme = localStorage.getItem("chd_theme");
      if (storedTheme === "dark" || storedTheme === "light") setThemeState(storedTheme);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setThemeState("dark");
    } catch {
      /* storage blocked */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("chd_lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("chd_theme", t);
    } catch {
      /* ignore */
    }
  }, []);

  const toast = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3800);
  }, []);

  const reloadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = (await res.json()) as { user: PublicUser | null };
      setUser(json.user);
    } catch {
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadUser();
  }, [reloadUser]);

  const api = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });
      const json = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        const err = new Error(String(json.error ?? "error")) as Error & {
          code?: string;
          status?: number;
        };
        err.code = json.error;
        err.status = res.status;
        if (res.status === 401) setUser(null);
        throw err;
      }
      return json;
    },
    [],
  );

  const t = useCallback((k: TranslationKey) => translate(lang, k), [lang]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      theme,
      setTheme,
      t,
      user,
      userLoading,
      setUser,
      reloadUser,
      toast,
      api,
    }),
    [lang, setLang, theme, setTheme, t, user, userLoading, reloadUser, toast, api],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((x) => (
          <div
            key={x.id}
            className="animate-rise pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg"
            style={{
              background: "var(--c-panel)",
              borderColor: x.tone === "err" ? "var(--c-danger)" : "var(--c-line-strong)",
              color: x.tone === "err" ? "var(--c-danger)" : "var(--c-ink)",
            }}
          >
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: x.tone === "err" ? "var(--c-danger)" : "var(--c-ok)" }}
            />
            {x.message}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
