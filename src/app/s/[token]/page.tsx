"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { Brand } from "@/components/logo";
import { Loading } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/util";
import { Download, ShieldCheck } from "lucide-react";

type Shared = {
  file: {
    id: string;
    name: string;
    size: number;
    kind: "image" | "video" | "other";
    mime: string;
    contentUrl: string;
    createdAt: string;
  };
  expiresAt: string | null;
  downloads: number;
};

export default function SharePage() {
  const { t, lang } = useApp();
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<Shared | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/shares/${params.token}`);
        if (!res.ok) throw new Error();
        setData((await res.json()) as Shared);
      } catch {
        setMissing(true);
      }
    })();
  }, [params.token]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Brand />
          <span className="label">secure link</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {missing ? (
          <div className="panel p-8 text-center">
            <p className="text-base font-semibold">{t("share.notFound")}</p>
            <p className="mt-2 text-sm text-ink3">{t("share.expired")}</p>
          </div>
        ) : !data ? (
          <Loading />
        ) : (
          <>
            <h1 className="text-xl font-bold">{t("share.title")}</h1>
            <p className="mt-1 text-sm text-ink2">{t("share.sub")}</p>

            <div className="panel mt-5 overflow-hidden">
              {data.file.kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.file.contentUrl} alt={data.file.name} className="max-h-[52dvh] w-full object-contain bg-black/5" />
              )}
              {data.file.kind === "video" && (
                <video src={data.file.contentUrl} controls playsInline className="max-h-[52dvh] w-full" />
              )}
              {data.file.kind === "other" && (
                <div className="px-6 py-16 text-center font-mono text-sm text-ink2">
                  {data.file.name}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{data.file.name}</div>
                  <div className="tnum mt-0.5 font-mono text-[11px] text-ink3">
                    {formatBytes(data.file.size, lang)} · {formatDate(data.file.createdAt, lang)} ·{" "}
                    {data.downloads} ↓
                  </div>
                </div>
                <a className="btn btn-primary" href={`${data.file.contentUrl}?dl=1`}>
                  <Download size={16} />
                  {t("share.download")}
                </a>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-ink3">
              <ShieldCheck size={14} style={{ color: "var(--c-ok)" }} />
              {t("storage.encryption")}
              {data.expiresAt && ` · ${formatDate(data.expiresAt, lang)}`}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
