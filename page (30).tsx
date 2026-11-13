"use client";

import { useApp } from "@/components/providers";
import { Uploader } from "@/components/uploader";

export default function UploadPage() {
  const { t } = useApp();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h2 className="text-xl font-bold tracking-tight">{t("upload.title")}</h2>
        <p className="mt-1 text-sm text-ink2">{t("upload.sub")}</p>
      </header>
      <Uploader />
    </div>
  );
}
