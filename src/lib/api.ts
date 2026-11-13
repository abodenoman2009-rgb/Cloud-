import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { User } from "@/db/schema";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(status: number, code: string, message?: string): NextResponse {
  return NextResponse.json({ error: code, ...(message ? { message } : {}) }, { status });
}

export async function currentUser(): Promise<User | null> {
  try {
    return await getSessionUser();
  } catch {
    return null;
  }
}

/** Rejects cross-site state-changing requests (defense in depth beyond SameSite). */
export function badOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("host");
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}
