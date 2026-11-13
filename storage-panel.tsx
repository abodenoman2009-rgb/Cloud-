"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/providers";
import { formatBytes, formatNumber, percentOf } from "@/lib/util";
import type { StorageStats } from "@/lib/types";

export function StoragePanel({ stats, onOpen }: { stats: StorageStats | null; onOpen?: () => void }) {
  const { t, lang } = useApp();
  const pct = stats ? percentOf(stats.used, stats.quota) : 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setShown(pct), 60);
    return () => window.clearTimeout(id);
  }, [pct]);

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 sm:px-6">
        <div>
          <div className="label">{t("storage.title")}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="tnum font-mono text-4xl font-bold sm:text-5xl"
              style={{ color: "var(--c-accent)" }}
            >
              {stats ? formatBytes(stats.used, lang) : "—"}
            </span>
            <span className="tnum font-mono text-base text-ink3">
              / {stats ? formatBytes(stats.quota, lang) : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="led" />
          <span className="label">
            {stats?.storage.driver === "s3"
              ? t("storage.s3Engine")
              : t("storage.localEngine")}
            {stats?.storage.bucket ? ` · ${stats.storage.bucket}` : ""}
          </span>
        </div>
      </div>

      <div className="px-5 pt-5 sm:px-6">
        <div className="gauge">
          <div
            className={`gauge-fill ${pct >= 95 ? "is-full" : ""}`}
            style={{ width: `${shown}%` }}
          />
          <div className="gauge-ticks" />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-ink3">
          <span className="tnum">0%</span>
          <span className="tnum" style={{ color: "var(--c-ink-2)" }}>
            {formatNumber(Math.round(pct), lang)}%
          </span>
          <span className="tnum">100%</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
        <Metric label={t("storage.total")} value={stats ? formatBytes(stats.quota, lang) : "—"} />
        <Metric label={t("storage.used")} value={stats ? formatBytes(stats.used, lang) : "—"} />
        <Metric label={t("storage.remaining")} value={stats ? formatBytes(stats.remaining, lang) : "—"} />
        <Metric
          label={t("storage.saved")}
          value={stats ? formatBytes(stats.saved, lang) : "—"}
          accent
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[12px] text-ink2">
          <span>
            <b className="tnum text-ink">{stats ? formatNumber(stats.images.count, lang) : "—"}</b>{" "}
            {t("storage.photos")}
          </span>
          <span>
            <b className="tnum text-ink">{stats ? formatNumber(stats.videos.count, lang) : "—"}</b>{" "}
            {t("storage.videos")}
          </span>
          <span>
            <b className="tnum text-ink">{stats ? formatNumber(stats.others.count, lang) : "—"}</b>{" "}
            {t("storage.others")}
          </span>
        </div>
        {onOpen && (
          <button className="btn btn-outline btn-sm" onClick={onOpen}>
            {t("space.title")} →
          </button>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-panel px-5 py-3.5">
      <div className="label">{label}</div>
      <div
        className="tnum mt-1 font-mono text-[15px] font-semibold"
        style={{ color: accent ? "var(--c-ok)" : "var(--c-ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function RecentStrip({ href = "/app/gallery" }: { href?: string }) {
  return (
    <Link href={href} className="btn btn-ghost btn-sm">
      →
    </Link>
  );
}
