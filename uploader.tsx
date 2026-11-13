"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { Toggle } from "@/components/ui";
import { formatBytes } from "@/lib/util";
import { addDeviceEntry } from "@/lib/device";
import { CloudUpload, Pause, Play, Trash2, Wifi, WifiOff } from "lucide-react";

type Status =
  | "queued"
  | "uploading"
  | "processing"
  | "done"
  | "duplicate"
  | "paused"
  | "error";

type Item = {
  key: string;
  file: File;
  name: string;
  size: number;
  mime: string;
  status: Status;
  sent: number;
  speed: number;
  uploadId?: string;
  chunkSize?: number;
  chunksTotal?: number;
  received: Set<number>;
  fileId?: string;
  error?: string;
};

const CONCURRENCY = 3;

/** Friendly device label stored with each file (no fingerprinting). */
function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Web";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Web";
}

export function Uploader() {
  const { t, lang, api, toast, user, setUser } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoUpload, setAutoUpload] = useState(false);
  const [online, setOnline] = useState(true);
  const [cellular, setCellular] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pauseRef = useRef(false);
  const activeRef = useRef(0);
  const queueRef = useRef<Item[]>([]);

  useEffect(() => {
    if (user) {
      setWifiOnly(user.wifiOnly);
      setAutoUpload(user.autoUpload);
    }
  }, [user]);

  const savePrefs = useCallback(
    async (patch: { wifiOnly?: boolean; autoUpload?: boolean }) => {
      try {
        const res = await api<{ user: NonNullable<typeof user> }>("/api/settings", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setUser(res.user);
      } catch {
        toast(t("err.generic"), "err");
      }
    },
    [api, setUser, t, toast],
  );

  // Network awareness: pause on disconnect, resume automatically on reconnect.
  useEffect(() => {
    const off = () => {
      setOnline(false);
      setItems((prev) => prev.map((i) => (i.status === "uploading" ? { ...i, status: "paused" } : i)));
    };
    const on = () => {
      setOnline(true);
      toast(t("upload.reconnect"));
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    const conn = (navigator as unknown as { connection?: { type?: string } }).connection;
    if (conn?.type === "cellular") setCellular(true);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [t, toast]);

  const patchItem = useCallback((key: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const enqueue = useCallback((files: FileList | File[] | null | undefined) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setItems((prev) => [
      ...prev,
      ...list.map((f, idx) => ({
        key: `${Date.now()}_${idx}_${f.name}`,
        file: f,
        name: f.name,
        size: f.size,
        mime: f.type || "application/octet-stream",
        status: "queued" as Status,
        sent: 0,
        speed: 0,
        received: new Set<number>(),
      })),
    ]);
  }, []);

  // Drag & drop anywhere on the page + paste — "auto upload new media".
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        enqueue(e.dataTransfer.files);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files?.length) enqueue(e.clipboardData.files);
    };
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("paste", onPaste);
    };
  }, [enqueue]);

  const runItem = useCallback(
    async (item: Item) => {
      if (pauseRef.current || !navigator.onLine) {
        patchItem(item.key, { status: "paused" });
        return;
      }
      if (wifiOnly && cellular) {
        patchItem(item.key, { status: "error", error: "wifi_only" });
        return;
      }

      patchItem(item.key, { status: "uploading" });

      try {
        // 1) open (or resume) a server-side upload session
        let uploadId = item.uploadId;
        let chunkSize = item.chunkSize;
        let chunksTotal = item.chunksTotal;
        let received = item.received;

        if (!uploadId) {
          const init = await api<{
            uploadId: string;
            chunkSize: number;
            chunksTotal: number;
            duplicate?: boolean;
            file?: { id: string };
          }>("/api/uploads", {
            method: "POST",
            body: JSON.stringify({ name: item.name, mime: item.mime, size: item.size }),
          });
          if (init.duplicate) {
            patchItem(item.key, { status: "duplicate", fileId: init.file?.id });
            return;
          }
          uploadId = init.uploadId;
          chunkSize = init.chunkSize;
          chunksTotal = init.chunksTotal;
          patchItem(item.key, { uploadId, chunkSize, chunksTotal });
        }

        // 2) ask the server which slices already survived a disconnect
        if (received.size === 0) {
          const info = await api<{ received: number[]; chunkSize: number; chunksTotal: number }>(
            `/api/uploads/${uploadId}`,
          );
          received = new Set(info.received);
          chunkSize = info.chunkSize;
          chunksTotal = info.chunksTotal;
        }

        const total = chunksTotal as number;
        const cs = chunkSize as number;

        for (let i = 0; i < total; i++) {
          if (pauseRef.current || !navigator.onLine) {
            patchItem(item.key, { status: "paused" });
            return;
          }
          if (received.has(i)) continue;

          const start = i * cs;
          const end = Math.min(item.size, start + cs);
          const blob = item.file.slice(start, end);
          const sentBefore = item.sent;
          const t0 = performance.now();

          let attempt = 0;
          for (;;) {
            try {
              const res = await fetch(`/api/uploads/${uploadId}/chunk`, {
                method: "PUT",
                headers: { "x-chunk-index": String(i) },
                body: blob,
              });
              if (!res.ok) throw new Error(String(res.status));
              break;
            } catch (err) {
              attempt++;
              if (!navigator.onLine || attempt > 6) {
                patchItem(item.key, { status: "paused" });
                return;
              }
              // Exponential back-off, then continue the same slice — this is
              // what makes the upload survive flaky mobile networks.
              await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** attempt)));
              void err;
            }
          }

          received.add(i);
          const sent = sentBefore + (end - start);
          const seconds = Math.max(0.001, (performance.now() - t0) / 1000);
          const instant = (end - start) / seconds;
          const smooth = item.speed > 0 ? item.speed * 0.6 + instant * 0.4 : instant;
          item.speed = smooth;
          patchItem(item.key, { sent, speed: Math.round(smooth), received: new Set(received) });
          item.sent = sent;
        }

        // 3) assemble on the server, hash, dedupe, store, verify
        patchItem(item.key, { status: "processing" });
        const done = await api<{ duplicate: boolean; file: { id: string } }>(
          `/api/uploads/${uploadId}/complete`,
          {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "x-device-name": deviceLabel() },
          },
        );

        if (done.duplicate) {
          patchItem(item.key, { status: "duplicate", sent: item.size, fileId: done.file.id });
          toast(t("upload.duplicate"));
          return;
        }

        patchItem(item.key, { status: "done", sent: item.size, fileId: done.file.id });
        addDeviceEntry({
          fileId: done.file.id,
          name: item.name,
          size: item.size,
          mime: item.mime,
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        patchItem(item.key, {
          status: "error",
          error: code ?? "error",
        });
      }
    },
    [api, cellular, patchItem, t, toast, wifiOnly],
  );

  // Pump the queue with bounded concurrency.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pauseRef.current || !online) return;
      while (activeRef.current < CONCURRENCY) {
        const next = queueRef.current.shift();
        if (!next) break;
        activeRef.current++;
        void runItem(next).finally(() => {
          activeRef.current--;
        });
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [online, runItem]);

  useEffect(() => {
    for (const i of items) {
      if (i.status === "queued" && !queueRef.current.some((q) => q.key === i.key)) {
        queueRef.current.push(i);
      }
    }
  }, [items]);

  function startAll() {
    pauseRef.current = false;
    setItems((prev) =>
      prev.map((i) =>
        i.status === "paused" || i.status === "error" || i.status === "queued"
          ? { ...i, status: "queued" }
          : i,
      ),
    );
  }

  function pauseAll() {
    pauseRef.current = true;
    setItems((prev) =>
      prev.map((i) => (i.status === "uploading" ? { ...i, status: "paused" } : i)),
    );
  }

  function remove(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const totalSize = items.reduce((s, i) => s + i.size, 0);
  const sentSize = items.reduce((s, i) => s + i.sent, 0);
  const pct = totalSize ? Math.round((sentSize / totalSize) * 100) : 0;
  const active = items.filter((i) => i.status === "uploading" || i.status === "processing").length;
  const finished = items.filter((i) => i.status === "done" || i.status === "duplicate").length;

  return (
    <div className="space-y-5">
      <section className="panel p-5 sm:p-6">
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors"
          style={{ borderColor: "var(--c-line-strong)", background: "var(--c-panel-2)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            enqueue(e.dataTransfer.files);
          }}
        >
          <CloudUpload size={30} style={{ color: "var(--c-accent)" }} />
          <p className="mt-3 text-sm font-semibold">{t("upload.drop")}</p>
          <button className="btn btn-primary mt-4" onClick={() => inputRef.current?.click()}>
            {t("upload.choose")}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              enqueue(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="mt-4 max-w-md text-[11.5px] leading-relaxed text-ink3">{t("upload.largeOk")}</p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="panel-flat px-3">
            <Toggle
              checked={wifiOnly}
              onChange={(v) => {
                setWifiOnly(v);
                void savePrefs({ wifiOnly: v });
              }}
              label={t("upload.wifiOnly")}
            />
          </div>
          <div className="panel-flat px-3">
            <Toggle
              checked={autoUpload}
              onChange={(v) => {
                setAutoUpload(v);
                void savePrefs({ autoUpload: v });
              }}
              label={t("upload.autoUpload")}
            />
          </div>
        </div>

        {!online && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{ background: "var(--c-warn-soft)", borderColor: "var(--c-warn)", color: "var(--c-warn)" }}
          >
            <WifiOff size={15} />
            {t("upload.offline")}
          </div>
        )}
        {online && cellular && wifiOnly && (
          <div
            className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
            style={{ background: "var(--c-warn-soft)", borderColor: "var(--c-warn)", color: "var(--c-warn)" }}
          >
            <Wifi size={15} />
            {t("upload.wifiOnly")}
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="label">{t("upload.queue")}</span>
              <span className="tnum font-mono text-sm text-ink2">
                {finished}/{items.length} · {formatBytes(sentSize, lang)} / {formatBytes(totalSize, lang)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-outline btn-sm" onClick={startAll}>
                <Play size={14} />
                {t("upload.start")}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={pauseAll}>
                <Pause size={14} />
                {t("upload.pause")}
              </button>
            </div>
          </div>

          <div className="px-5 pt-4">
            <div className="gauge">
              <div className="gauge-fill" style={{ width: `${pct}%` }} />
              <div className="gauge-ticks" />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-ink3">
              <span className="tnum">{pct}%</span>
              <span className="tnum">
                {active > 0 ? `${active} ${t("upload.uploading")}` : t("upload.done")} ·{" "}
                {formatBytes(totalSize - sentSize, lang)} {t("storage.remaining")}
              </span>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-line border-t border-line">
            {items.map((i) => {
              const ip = i.size ? Math.round((i.sent / i.size) * 100) : 0;
              return (
                <li key={i.key} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{i.name}</span>
                      <span className="tnum shrink-0 font-mono text-[11px] text-ink3">
                        {formatBytes(i.size, lang)}
                      </span>
                    </div>
                    <div className="progress mt-2">
                      <i
                        style={{
                          width: `${i.status === "duplicate" || i.status === "done" ? 100 : ip}%`,
                          background:
                            i.status === "error"
                              ? "var(--c-danger)"
                              : i.status === "duplicate"
                                ? "var(--c-warn)"
                                : undefined,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ink3">
                      <span
                        style={{
                          color:
                            i.status === "done"
                              ? "var(--c-ok)"
                              : i.status === "error"
                                ? "var(--c-danger)"
                                : i.status === "duplicate"
                                  ? "var(--c-warn)"
                                  : undefined,
                        }}
                      >
                        {i.status === "uploading"
                          ? `${t("upload.uploading")} ${ip}%`
                          : i.status === "processing"
                            ? t("upload.processing")
                            : i.status === "done"
                              ? t("upload.done")
                              : i.status === "duplicate"
                                ? t("upload.duplicate")
                                : i.status === "paused"
                                  ? t("upload.resume")
                                  : i.status === "error"
                                    ? t("upload.failed")
                                    : t("upload.queue")}
                      </span>
                      <span className="tnum">
                        {i.speed > 0 && (i.status === "uploading" || i.status === "paused")
                          ? `${formatBytes(i.speed, lang)}/s`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => remove(i.key)}
                    aria-label={t("upload.remove")}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
