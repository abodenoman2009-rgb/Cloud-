export function kindOf(mime: string): "image" | "video" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function formatBytes(bytes: number, lang: "ar" | "en" = "ar"): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return lang === "ar" ? "٠ بايت" : "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  const digits = value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1);
  const num = lang === "ar" ? toArabicDigits(digits) : digits;
  const unit = lang === "ar" ? unitAr(units[i]) : units[i];
  return `${num} ${unit}`;
}

function unitAr(u: string): string {
  switch (u) {
    case "B":
      return "بايت";
    case "KB":
      return "ك.ب";
    case "MB":
      return "م.ب";
    case "GB":
      return "ج.ب";
    default:
      return "ت.ب";
  }
}

export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

export function formatNumber(n: number, lang: "ar" | "en" = "ar"): string {
  const s = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(n);
  return lang === "ar" ? s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]) : s;
}

export function formatDate(iso: string | Date, lang: "ar" | "en" = "ar"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string | Date, lang: "ar" | "en" = "ar"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDuration(seconds: number, lang: "ar" | "en" = "ar"): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return lang === "ar" ? toArabicDigits(`${mm}:${ss}`) : `${mm}:${ss}`;
}

export function percentOf(used: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (used / total) * 100));
}
