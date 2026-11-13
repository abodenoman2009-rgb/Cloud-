"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderOpen, ScanLine, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/providers";
import { Spinner } from "@/components/ui";
import { formatBytes } from "@/lib/util";
import { markCleared, readDevice, type DeviceEntry } from "@/lib/device";

type ScanRow = {
  localId: string | null;
  fileId: string;
  name: string;
  size: number;
  status: "ready" | "incomplete" | "missing" | "not_uploaded";
  verified: boolean;
  localCopyCleared: boolean;
};

type Result = {
  items: ScanRow[];
  savings: number;
  readyCount: number;
  blockedCount: number;
  verifiedCount: number;
};

const HOLD_MS = 1500;

/** Animated counter — the savings number rolls up after a scan. */
function useRoll(target: number) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const from = value;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

export function FreeUpConsole({ onCleared }: { onCleared: () => void }) {
  const { t, lang, api, toast } = useApp();
  const [phase, setPhase] = useState<"idle" | "scanning" | "result" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [holdPct, setHoldPct] = useState(0);
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const holdStart = useRef(0);
  const holdRaf = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const rolled = useRoll(result?.savings ?? 0);

  const stopHold = useCallback(() => {
    cancelAnimationFrame(holdRaf.current);
    setHolding(false);
    setHoldPct(0);
  }, []);

  const finishHold = useCallback(async () => {
    stopHold();
    if (!result) return;
    const ids = result.items.filter((i) => i.status === "ready" && !i.localCopyCleared).map((i) => i.fileId);
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await api<{ cleared: string[]; rejected: unknown[]; savings: number }>(
        "/api/space/confirm",
        { method: "POST", body: JSON.stringify({ fileIds: ids }) },
      );
      markCleared(res.cleared);
      setResult((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                res.cleared.includes(i.fileId) ? { ...i, localCopyCleared: true } : i,
              ),
              savings: res.savings,
            }
          : prev,
      );
      setPhase("done");
      toast(t("space.cleared"));
      onCleared();
    } catch {
      toast(t("err.generic"), "err");
    } finally {
      setBusy(false);
    }
  }, [api, onCleared, result, t, toast]);

  const startHold = useCallback(() => {
    if (busy) return;
    setHolding(true);
    holdStart.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - holdStart.current) / HOLD_MS);
      setHoldPct(p * 100);
      if (p >= 1) void finishHold();
      else holdRaf.current = requestAnimationFrame(tick);
    };
    holdRaf.current = requestAnimationFrame(tick);
  }, [busy, finishHold]);

  useEffect(() => () => cancelAnimationFrame(holdRaf.current), []);

  async function scan(extra?: FileList | null) {
    setPhase("scanning");
    setResult(null);
    try {
      const items: Array<{ localId?: string; fileId?: string; name: string; size: number }> = [];
      const device: DeviceEntry[] = readDevice();
      for (const d of device) {
        items.push({ localId: d.localId, fileId: d.fileId, name: d.name, size: d.size });
      }
      if (extra) {
        for (const f of Array.from(extra)) {
          items.push({ name: f.name, size: f.size });
        }
      }
      const res = await api<Result>("/api/space/analyze", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setResult(res);
      setPhase("result");
    } catch {
      toast(t("err.generic"), "err");
      setPhase("idle");
    }
  }

  const ready = (result?.items ?? []).filter((i) => i.status === "ready" && !i.localCopyCleared);
  const blocked = (result?.items ?? []).filter((i) => i.status !== "ready");

  return (
    <section id="freeup" className="panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <span className="led" />
            <span className="label">{t("space.title")}</span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{t("space.title")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink2">{t("space.sub")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void scan(e.target.files)}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={() => fileInput.current?.click()}
            disabled={phase === "scanning"}
          >
            <FolderOpen size={15} />
            {t("space.deviceFiles")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void scan(null)}
            disabled={phase === "scanning"}
          >
            {phase === "scanning" ? <Spinner /> : <ScanLine size={15} />}
            {t("space.scan")}
          </button>
        </div>
      </div>

      {/* Steps readout */}
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {[
          t("space.step1"),
          t("space.step2"),
          t("space.step3"),
          t("space.step4"),
        ].map((s, i) => {
          const active =
            phase === "scanning" ||
            (phase === "result" && i < 3) ||
            (phase === "done" && i < 4);
          return (
            <div key={s} className="flex items-center gap-2 bg-panel px-4 py-3">
              <span
                className={`led ${active ? "" : "led-idle"}`}
                style={{ background: active ? "var(--c-accent)" : undefined, boxShadow: active ? "0 0 8px var(--c-accent)" : undefined }}
              />
              <span className="truncate text-[12px] font-medium text-ink2">{s}</span>
            </div>
          );
        })}
      </div>

      {phase === "idle" && (
        <div className="px-5 py-8 text-center text-sm text-ink3 sm:px-6">
          {t("space.none")}
        </div>
      )}

      {phase === "scanning" && (
        <div className="flex items-center justify-center gap-3 px-6 py-10 text-sm text-ink2">
          <Spinner />
          {t("space.scanning")}
        </div>
      )}

      {(phase === "result" || phase === "done") && result && (
        <>
          <div className="grid gap-px bg-line sm:grid-cols-[1.1fr_1fr]">
            {/* Savings counter */}
            <div className="bg-panel px-5 py-6 sm:px-6">
              <div className="label">{t("space.savings")}</div>
              <div
                className="tnum mt-2 font-mono text-5xl font-bold sm:text-6xl"
                style={{ color: "var(--c-accent)" }}
              >
                {formatBytes(Math.round(rolled), lang)}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[12px] text-ink2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} style={{ color: "var(--c-ok)" }} />
                  {result.verifiedCount} {t("space.verified")}
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={14} style={{ color: "var(--c-warn)" }} />
                  {result.blockedCount} {t("space.notReady")}
                </span>
              </div>
              <p className="mt-4 max-w-sm text-[11.5px] leading-relaxed text-ink3">
                {t("space.disclaimer")}
              </p>
            </div>

            {/* Two ledgers */}
            <div className="bg-panel px-5 py-6 sm:px-6">
              <div className="label mb-2">{t("space.ready")} ({ready.length})</div>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto pe-1">
                {ready.length === 0 && <li className="text-sm text-ink3">{t("space.none")}</li>}
                {ready.slice(0, 40).map((r) => (
                  <li key={r.fileId} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="led" />
                      <span className="truncate font-mono">{r.name}</span>
                    </span>
                    <span className="tnum shrink-0 font-mono text-ink3">
                      {formatBytes(r.size, lang)}
                    </span>
                  </li>
                ))}
              </ul>

              {blocked.length > 0 && (
                <>
                  <div className="label mb-2 mt-4">{t("space.notReady")} ({blocked.length})</div>
                  <ul className="max-h-28 space-y-1.5 overflow-y-auto pe-1">
                    {blocked.slice(0, 30).map((r, idx) => (
                      <li
                        key={`${r.fileId || r.name}-${idx}`}
                        className="flex items-center justify-between gap-3 text-[13px] text-ink3"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="led led-warn" />
                          <span className="truncate font-mono">{r.name}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px]">
                          {r.status === "not_uploaded" ? "—" : formatBytes(r.size, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Hold-to-confirm — physical eject semantics */}
          <div className="flex flex-col items-stretch gap-3 border-t border-line px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            {phase === "done" ? (
              <div
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ background: "var(--c-ok-soft)", color: "var(--c-ok)" }}
              >
                <ShieldCheck size={16} />
                <span className="tnum font-mono">
                  {t("space.cleared")} · {formatBytes(result.savings, lang)}
                </span>
              </div>
            ) : (
              <button
                className="hold-btn btn btn-primary relative flex-1"
                onPointerDown={startHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
                disabled={busy || ready.length === 0}
                style={{ opacity: ready.length === 0 ? 0.5 : 1 }}
              >
                <span className="hold-fill" style={{ width: `${holdPct}%` }} />
                <span className="relative">
                  {busy ? <Spinner /> : holding ? t("space.holding") : t("space.hold")}
                </span>
              </button>
            )}
            <div className="text-center text-[11.5px] leading-relaxed text-ink3 sm:text-start">
              {t("space.confirmLocal")} · {ready.length} {t("common.files")}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
