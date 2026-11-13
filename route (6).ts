import { NextResponse } from "next/server";
import { clearSessionCookie, revokeCurrentSession } from "@/lib/auth/session";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  await revokeCurrentSession();
  const res = ok({ ok: true });
  clearSessionCookie(res);
  return res;
}
