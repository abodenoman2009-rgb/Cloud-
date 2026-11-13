import { currentUser, fail, ok } from "@/lib/api";
import { clearSessionCookie, revokeAllSessions } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Signs the user out on every device by revoking all active sessions. */
export async function POST() {
  const user = await currentUser();
  if (!user) return fail(401, "unauthorized");
  await revokeAllSessions(user.id);
  const res = ok({ ok: true });
  clearSessionCookie(res);
  return res;
}

void NextResponse;
