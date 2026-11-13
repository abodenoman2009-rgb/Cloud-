"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useApp } from "@/components/providers";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useApp();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink3">
      <Spinner />
      <span className="text-sm">{label ?? t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  image = "/images/empty-bay.jpg",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  image?: string;
}) {
  return (
    <div className="panel-flat relative overflow-hidden">
      <div className="relative h-40 w-full overflow-hidden sm:h-52">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover opacity-80"
          style={{ objectPosition: "50% 55%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--c-panel) 4%, transparent 65%), radial-gradient(120% 80% at 50% 0%, transparent 40%, var(--c-panel-soft, rgba(0,0,0,.2)))",
          }}
        />
      </div>
      <div className="relative -mt-10 px-6 pb-8 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        {hint && <p className="mx-auto mt-2 max-w-md text-sm text-ink2">{hint}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

/** Modal sheet used for previews, share links and confirmations. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useApp();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`panel animate-rise max-h-[88dvh] w-full overflow-y-auto rounded-b-none sm:rounded-b-[14px] ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-line bg-panel px-5 py-3.5">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-start"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-ink3">{hint}</span>}
      </span>
      <span
        className="relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors"
        style={{
          background: checked ? "var(--c-accent)" : "var(--c-panel-2)",
          borderColor: checked ? "var(--c-accent)" : "var(--c-line-strong)",
        }}
      >
        <span
          className="absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all"
          style={{ insetInlineStart: checked ? "calc(100% - 1.25rem)" : "0.15rem" }}
        />
      </span>
    </button>
  );
}

export function StatBlock({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="panel-flat px-4 py-3.5">
      <div className="label">{label}</div>
      <div
        className="tnum mt-1.5 font-mono text-xl font-semibold"
        style={{ color: accent ? "var(--c-accent)" : "var(--c-ink)" }}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink3">{sub}</div>}
    </div>
  );
}
