"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/providers";
import { AuthShell } from "@/components/auth-shell";
import { Spinner } from "@/components/ui";

function VerifyForm() {
  const { api, setUser } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ user: unknown }>("/api/auth/verification", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      setUser(result.user as never);
      router.replace("/app");
    } catch (e2) {
      const reason = (e2 as { code?: string }).code;
      setError(reason === "code_expired" ? "انتهت صلاحية الرمز. أرسل رمزاً جديداً." : reason === "too_many_attempts" ? "تجاوزت عدد المحاولات المسموح. أرسل رمزاً جديداً." : reason === "invalid_code" ? "رمز التحقق غير صحيح. حاول مرة أخرى." : "تعذر التحقق. أعد المحاولة.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/auth/verification/resend", { method: "POST", body: JSON.stringify({ email }) });
      setSeconds(60);
      setCode("");
      setNotice("أرسلنا رمزاً جديداً إلى بريدك الإلكتروني. صالح لمدة 10 دقائق.");
    } catch (e2) {
      const reason = (e2 as { code?: string }).code;
      setError(reason === "resend_too_soon" ? "انتظر قبل طلب رمز جديد." : reason === "resend_limit" ? "وصلت إلى الحد الأقصى لإعادة الإرسال. حاول لاحقاً." : reason === "mail_failed" ? "تعذر إرسال الرسالة. حاول مرة أخرى." : reason === "email_not_configured" ? "خدمة البريد غير مهيأة على الخادم." : "تعذر إرسال الرمز. تحقق من البريد وحاول مرة أخرى.");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">تأكيد البريد الإلكتروني</h1>
      <p className="mt-2 text-sm text-ink2">أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى <span dir="ltr">{email}</span>. الرمز صالح لمدة 10 دقائق.</p>
      <form onSubmit={verify} className="mt-6 space-y-4">
        <label className="label mb-1.5 block" htmlFor="code">رمز التحقق</label>
        <input id="code" className="field text-center text-2xl tracking-[0.5em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
        {error && <p className="text-sm" style={{ color: "var(--c-danger)" }}>{error}</p>}
        {notice && <p className="text-sm" style={{ color: "var(--c-ok)" }}>{notice}</p>}
        <button className="btn btn-primary w-full" disabled={busy || code.length !== 6} type="submit">{busy && <Spinner />}تأكيد البريد</button>
      </form>
      <button className="btn btn-outline mt-3 w-full" disabled={resending || seconds > 0} onClick={resend} type="button">
        {resending && <Spinner />}{seconds > 0 ? `إعادة إرسال الرمز بعد ${seconds} ثانية` : "إعادة إرسال الرمز"}
      </button>
      <p className="mt-6 text-center text-sm text-ink2"><Link href="/login" className="font-semibold text-ink underline underline-offset-4">العودة لتسجيل الدخول</Link></p>
    </>
  );
}

export default function VerifyPage() {
  return <AuthShell kicker="email verification · secure account"><Suspense fallback={<div className="py-16 text-center text-ink3">جارٍ التحميل…</div>}><VerifyForm /></Suspense></AuthShell>;
}
