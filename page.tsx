"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { EmptyState, Loading, Sheet } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/util";
import { Folder, FolderPlus, Trash2 } from "lucide-react";

type Album = { id: string; name: string; kind: string; createdAt: string; count: number };
type FileDtoLike = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "video" | "other";
  contentUrl: string;
  localCopyCleared: boolean;
  createdAt: string;
};

export default function AlbumsPage() {
  const { t, lang, api, toast } = useApp();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"album" | "folder">("album");
  const [open, setOpen] = useState<Album | null>(null);
  const [files, setFiles] = useState<FileDtoLike[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api<{ albums: Album[] }>("/api/albums");
      setAlbums(res.albums);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    try {
      await api("/api/albums", { method: "POST", body: JSON.stringify({ name, kind }) });
      toast(t("common.done"));
      setCreating(false);
      setName("");
      await load();
    } catch {
      toast(t("err.generic"), "err");
    }
  }

  async function remove(a: Album) {
    if (!window.confirm(t("albums.deleteConfirm"))) return;
    try {
      await api(`/api/albums/${a.id}`, { method: "DELETE" });
      await load();
    } catch {
      toast(t("err.generic"), "err");
    }
  }

  async function openAlbum(a: Album) {
    setOpen(a);
    try {
      const res = await api<{ files: FileDtoLike[] }>(`/api/files?albumId=${a.id}&limit=400`);
      setFiles(res.files);
    } catch {
      setFiles([]);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("albums.title")}</h2>
          <p className="mt-1 text-sm text-ink2">
            {albums.length} · {t("nav.albums")}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
          <FolderPlus size={15} />
          {t("albums.new")}
        </button>
      </header>

      <div className="mt-5">
        {albums.length === 0 ? (
          <EmptyState title={t("albums.empty")} hint={t("common.emptyHint")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((a) => (
              <div key={a.id} className="panel-flat group p-4">
                <button className="flex w-full items-start gap-3 text-start" onClick={() => void openAlbum(a)}>
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "var(--c-accent-soft)", color: "var(--c-accent)" }}
                  >
                    <Folder size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.name}</span>
                    <span className="tnum mt-0.5 block font-mono text-[11px] text-ink3">
                      {a.count} {t("albums.count")} · {formatDate(a.createdAt, lang)}
                    </span>
                  </span>
                </button>
                <div className="mt-3 flex justify-end">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void remove(a)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title={t("albums.new")}>
        <div className="space-y-4">
          <input
            className="field"
            placeholder={t("albums.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="chip"
              data-active={kind === "album"}
              onClick={() => setKind("album")}
            >
              {t("nav.albums")}
            </button>
            <button className="chip" data-active={kind === "folder"} onClick={() => setKind("folder")}>
              {t("albums.folder")}
            </button>
          </div>
          <button className="btn btn-primary w-full" onClick={() => void create()}>
            {t("common.save")}
          </button>
        </div>
      </Sheet>

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name} wide>
        {files.length === 0 ? (
          <p className="text-sm text-ink3">{t("common.empty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {files.map((f) => (
              <div key={f.id} className="tile">
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
                  className="absolute inset-x-0 bottom-0 px-2 py-1 font-mono text-[10px] text-white"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,.8), rgba(0,0,0,0))" }}
                >
                  <span className="block truncate">{f.name}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 font-mono text-[11px] text-ink3">
          {formatBytes(files.reduce((s, f) => s + f.size, 0), lang)}
        </div>
      </Sheet>
    </div>
  );
}
