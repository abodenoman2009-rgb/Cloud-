"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { StoragePanel } from "@/components/storage-panel";
import { FreeUpConsole } from "@/components/free-up";
import { Loading } from "@/components/ui";
import { fileDto } from "@/lib/serialize";
import { formatBytes } from "@/lib/util";
import type { StorageStats } from "@/lib/types";

type FileRow = ReturnType<typeof fileDto>;

export default function DashboardPage() {
  const { t, lang, api } = useApp();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [recent, setRecent] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([
        api<StorageStats>("/api/storage"),
        api<{ files: FileRow[] }>("/api/files?limit=8"),
      ]);
      setStats(s);
      setRecent(f.files);
    } catch {
      /* handled by api() */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <StoragePanel stats={stats} />

      <div className="mt-6">
        <FreeUpConsole onCleared={() => void load()} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4 border-b border-line pb-3">
          <h2 className="text-base font-semibold">{t("gallery.title")}</h2>
          <Link href="/app/gallery" className="text-sm text-ink2 underline underline-offset-4">
            {t("common.all")} →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="panel-flat px-6 py-10 text-center">
            <p className="text-sm font-semibold">{t("common.empty")}</p>
            <p className="mt-1 text-sm text-ink3">{t("common.emptyHint")}</p>
            <Link href="/app/upload" className="btn btn-primary mt-5 inline-flex">
              {t("upload.choose")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {recent.map((f) => (
              <Link key={f.id} href="/app/gallery" className="tile group">
                {f.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.contentUrl} alt={f.name} loading="lazy" />
                ) : f.kind === "video" ? (
                  <video src={f.contentUrl} muted playsInline preload="metadata" />
                ) : (
                  <div className="flex h-full items-center justify-center font-mono text-[11px] text-ink3">
                    {f.name.split(".").pop()?.toUpperCase()}
                  </div>
                )}
                <span
                  className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-2 py-1.5 font-mono text-[10px] text-white"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,.8), rgba(0,0,0,0))" }}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="tnum shrink-0">{formatBytes(f.size, lang)}</span>
                </span>
                {f.localCopyCleared && (
                  <span
                    className="absolute top-1.5 start-1.5 size-2 rounded-full"
                    style={{ background: "var(--c-ok)", boxShadow: "0 0 6px var(--c-ok)" }}
                    title={t("gallery.localCleared")}
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
