"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { Lightbox } from "@/components/lightbox";
import { EmptyState, Sheet, Spinner } from "@/components/ui";
import { formatBytes } from "@/lib/util";
import type { TranslationKey } from "@/lib/i18n";
import { Check, Download, FolderPlus, Link2, Search, Share2, Trash2, X } from "lucide-react";

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

type Sort = "date" | "date_asc" | "size" | "size_asc" | "name";
const SORTS: Array<{ key: Sort; label: TranslationKey }> = [
  { key: "date", label: "gallery.byDate" },
  { key: "date_asc", label: "gallery.byOld" },
  { key: "size", label: "gallery.bySizeBig" },
  { key: "size_asc", label: "gallery.bySizeSmall" },
  { key: "name", label: "gallery.byName" },
];
const KINDS: Array<{ key: string; label: TranslationKey }> = [
  { key: "", label: "common.all" },
  { key: "image", label: "common.images" },
  { key: "video", label: "common.videos" },
  { key: "other", label: "common.files" },
];

export default function GalleryPage() {
  const { t, lang, api, toast } = useApp();
  const [files, setFiles] = useState<FileDtoLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [albumSheet, setAlbumSheet] = useState(false);
  const [albums, setAlbums] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const params = new URLSearchParams({ limit: "400" });
      if (q) params.set("q", q);
      if (kind) params.set("kind", kind);
      params.set("sort", sort);
      const res = await api<{ files: FileDtoLike[] }>(`/api/files?${params.toString()}`);
      if (id === seq.current) setFiles(res.files);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [api, q, kind, sort]);

  useEffect(() => {
    const h = window.setTimeout(() => void load(), q ? 260 : 0);
    return () => window.clearTimeout(h);
  }, [load, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function shareSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await api<{ url: string | null }>(`/api/files/${ids[0]}/share`, {
        method: "POST",
        body: JSON.stringify({ days: 7 }),
      });
      setShareUrl(res.url ? `${window.location.origin}${res.url}` : null);
      toast(t("gallery.shareCreated"));
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }

  async function downloadSelected() {
    for (const id of selected) {
      window.open(`/api/files/${id}/content?dl=1`, "_blank");
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  async function deleteSelected() {
    if (!window.confirm(`${t("common.delete")} (${selected.size})?`)) return;
    setBusy(true);
    try {
      for (const id of selected) {
        await api(`/api/files/${id}`, { method: "DELETE" });
      }
      setSelected(new Set());
      setSelectMode(false);
      toast(t("common.delete"));
      await load();
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }

  async function openAlbums() {
    try {
      const res = await api<{ albums: Array<{ id: string; name: string; count: number }> }>(
        "/api/albums",
      );
      setAlbums(res.albums);
      setAlbumSheet(true);
    } catch {
      toast(t("err.generic"), "err");
    }
  }

  async function addToAlbum(albumId: string) {
    setBusy(true);
    try {
      await api(`/api/albums/${albumId}`, {
        method: "PATCH",
        body: JSON.stringify({ addFileIds: [...selected] }),
      });
      toast(t("gallery.addToAlbum"));
      setAlbumSheet(false);
      setSelected(new Set());
      setSelectMode(false);
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("gallery.title")}</h2>
          <p className="mt-1 text-sm text-ink2">{t("gallery.sub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn btn-sm ${selectMode ? "btn-primary" : "btn-outline"}`}
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected(new Set());
            }}
          >
            {t("gallery.selectMode")}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[210px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-ink3"
          />
          <input
            className="field ps-9"
            placeholder={t("gallery.searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {KINDS.map((k) => (
          <button key={k.key || "all"} className="chip" data-active={kind === k.key} onClick={() => setKind(k.key)}>
            {t(k.label)}
          </button>
        ))}
        <select
          className="field w-auto text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label={t("common.sort")}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(s.label)}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3 py-6 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-[10px]" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={q ? t("gallery.emptySearch") : t("common.empty")}
            hint={q ? undefined : t("common.emptyHint")}
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((f, i) => {
            const isSel = selected.has(f.id);
            return (
              <div
                key={f.id}
                className="tile group"
                style={isSel ? { borderColor: "var(--c-accent)", boxShadow: "0 0 0 2px var(--c-accent-soft)" } : undefined}
                onClick={() => (selectMode ? toggle(f.id) : setLightbox(i))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && (selectMode ? toggle(f.id) : setLightbox(i))}
              >
                {f.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.contentUrl} alt={f.name} loading="lazy" />
                ) : f.kind === "video" ? (
                  <>
                    <video src={f.contentUrl} muted playsInline preload="metadata" />
                    <span className="absolute bottom-1.5 end-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10px] text-white">
                      ▶
                    </span>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 font-mono text-[11px] text-ink3">
                    <span>{f.name.split(".").pop()?.toUpperCase()}</span>
                  </div>
                )}

                {selectMode && (
                  <span
                    className="absolute top-1.5 start-1.5 flex size-5 items-center justify-center rounded-full border"
                    style={{
                      background: isSel ? "var(--c-accent)" : "rgba(0,0,0,.45)",
                      borderColor: isSel ? "var(--c-accent)" : "rgba(255,255,255,.6)",
                      color: "var(--c-accent-ink)",
                    }}
                  >
                    {isSel && <Check size={12} />}
                  </span>
                )}
                {f.localCopyCleared && (
                  <span
                    className="absolute top-1.5 end-1.5 size-2 rounded-full"
                    style={{ background: "var(--c-ok)", boxShadow: "0 0 6px var(--c-ok)" }}
                    title={t("gallery.localCleared")}
                  />
                )}
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-2 py-1.5 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,0))" }}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="tnum shrink-0">{formatBytes(f.size, lang)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Selection action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-50 mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2.5 shadow-xl lg:bottom-4">
          <span className="tnum font-mono text-xs text-ink2">
            {selected.size} {t("common.itemsSelected")}
          </span>
          <button className="btn btn-outline btn-sm" onClick={() => void downloadSelected()}>
            <Download size={14} />
            {t("common.download")}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => void shareSelected()} disabled={busy}>
            <Share2 size={14} />
            {t("common.share")}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => void openAlbums()} disabled={busy}>
            <FolderPlus size={14} />
            {t("gallery.addToAlbum")}
          </button>
          <button
            className="btn btn-sm"
            style={{ color: "var(--c-danger)" }}
            onClick={() => void deleteSelected()}
            disabled={busy}
          >
            <Trash2 size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            <X size={14} />
          </button>
        </div>
      )}

      {lightbox !== null && files[lightbox] && (
        <Lightbox
          files={files}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
          onChanged={() => void load()}
        />
      )}

      <Sheet open={albumSheet} onClose={() => setAlbumSheet(false)} title={t("gallery.addToAlbum")}>
        {albums.length === 0 ? (
          <p className="text-sm text-ink3">{t("albums.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {albums.map((a) => (
              <li key={a.id}>
                <button
                  className="btn btn-outline w-full justify-between"
                  onClick={() => void addToAlbum(a.id)}
                  disabled={busy}
                >
                  <span>{a.name}</span>
                  <span className="tnum font-mono text-xs text-ink3">
                    {a.count} {t("albums.count")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={Boolean(shareUrl)} onClose={() => setShareUrl(null)} title={t("gallery.shareLink")}>
        <p className="text-sm text-ink2">{t("gallery.shareExpires")}</p>
        <div className="mt-3 flex gap-2">
          <input className="field font-mono text-xs" dir="ltr" readOnly value={shareUrl ?? ""} />
          <button
            className="btn btn-primary"
            onClick={() => {
              void navigator.clipboard?.writeText(shareUrl ?? "");
              toast(t("common.copied"));
            }}
          >
            <Link2 size={15} />
          </button>
        </div>
        {busy && <Spinner className="mt-3 text-ink3" />}
      </Sheet>

      <div className="tnum mt-6 text-center font-mono text-[11px] text-ink3">
        {files.length} {t("common.files")} ·{" "}
        {formatBytes(files.reduce((s, f) => s + f.size, 0), lang)}
      </div>
    </div>
  );
}
