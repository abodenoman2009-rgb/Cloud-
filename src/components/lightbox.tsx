"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { Sheet, Spinner } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/util";
import { Check, Copy, Download, Link2, Trash2, X } from "lucide-react";

type FileDtoLike = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "other";
  verified: boolean;
  localCopyCleared: boolean;
  createdAt: string;
  contentUrl: string;
};

export function Lightbox({
  files,
  index,
  onClose,
  onIndex,
  onChanged,
}: {
  files: FileDtoLike[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  onChanged: () => void;
}) {
  const { t, lang, api, toast } = useApp();
  const [share, setShare] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = files[index];

  const step = useCallback(
    (dir: number) => {
      if (!files.length) return;
      onIndex((index + dir + files.length) % files.length);
    },
    [files.length, index, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(-1);
      if (e.key === "ArrowLeft") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  if (!file) return null;

  async function doShare() {
    setBusy(true);
    try {
      const res = await api<{ url: string | null; expiresAt: string | null; token: string | null }>(
        `/api/files/${file!.id}/share`,
        { method: "POST", body: JSON.stringify({ days: 7 }) },
      );
      const url = res.url
        ? `${window.location.origin}${res.url}`
        : `${window.location.origin}/app/gallery`;
      setShare(url);
      toast(t("gallery.shareCreated"));
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!window.confirm(t("common.delete") + "?")) return;
    setBusy(true);
    try {
      await api(`/api/files/${file!.id}`, { method: "DELETE" });
      toast(t("common.delete"));
      onChanged();
      if (files.length <= 1) onClose();
      else onIndex(Math.min(index, files.length - 2));
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-black/92 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{file.name}</div>
          <div className="tnum font-mono text-[11px] text-white/55">
            {formatBytes(file.size, lang)} · {formatDate(file.createdAt, lang)} ·{" "}
            {file.localCopyCleared ? t("gallery.localCleared") : t("gallery.localKept")}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-sm"
            style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
            onClick={() => window.open(`${file.contentUrl}?dl=1`, "_blank")}
          >
            <Download size={15} />
            <span className="hidden sm:inline">{t("common.download")}</span>
          </button>
          <button
            className="btn btn-sm"
            style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
            onClick={() => void doShare()}
            disabled={busy}
          >
            <Link2 size={15} />
            <span className="hidden sm:inline">{t("common.share")}</span>
          </button>
          <button
            className="btn btn-sm"
            style={{ background: "rgba(248,113,113,.2)", color: "#fca5a5" }}
            onClick={() => void doDelete()}
            disabled={busy}
          >
            <Trash2 size={15} />
          </button>
          <button
            className="btn btn-sm"
            style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4">
        <button
          className="absolute start-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          onClick={() => step(-1)}
          aria-label="prev"
        >
          ‹
        </button>

        <div className="flex max-h-full max-w-5xl items-center justify-center">
          {file.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.contentUrl}
              alt={file.name}
              className="max-h-[74dvh] max-w-full rounded-lg object-contain"
            />
          )}
          {file.kind === "video" && (
            <video
              key={file.id}
              src={file.contentUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[74dvh] max-w-full rounded-lg"
            />
          )}
          {file.kind === "other" && (
            <div className="rounded-lg bg-white/10 px-8 py-12 font-mono text-sm text-white/80">
              {file.name}
              <div className="mt-3 text-center text-xs text-white/50">
                <a href={`${file.contentUrl}?dl=1`} className="underline">
                  {t("common.download")}
                </a>
              </div>
            </div>
          )}
        </div>

        <button
          className="absolute end-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
          onClick={() => step(1)}
          aria-label="next"
        >
          ›
        </button>
      </div>

      <Sheet open={Boolean(share)} onClose={() => setShare(null)} title={t("gallery.shareLink")}>
        <p className="text-sm text-ink2">{t("gallery.shareExpires")}</p>
        <div className="mt-3 flex gap-2">
          <input className="field font-mono text-xs" dir="ltr" readOnly value={share ?? ""} />
          <button
            className="btn btn-primary"
            onClick={() => {
              void navigator.clipboard?.writeText(share ?? "");
              toast(t("common.copied"));
            }}
          >
            <Copy size={15} />
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-ink3">
          <Check size={13} style={{ color: "var(--c-ok)" }} />
          {t("storage.encryption")}
        </div>
      </Sheet>
    </div>
  );
}
