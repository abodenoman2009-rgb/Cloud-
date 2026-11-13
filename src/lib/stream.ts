import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getObjectStore } from "@/lib/storage";

type Target = { mime: string; storageKey: string; size: number; name: string };

function parseRange(header: string | null, total: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;
  let start: number;
  let end: number;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? total - 1 : Number(rawEnd);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) return null;
  return { start, end: Math.min(end, total - 1) };
}

/**
 * Streams an object straight from the store with HTTP Range support so
 * videos play from the cloud without downloading the original file.
 */
export async function streamObject(
  req: NextRequest,
  target: Target,
  opts: { download?: boolean } = {},
): Promise<NextResponse> {
  const store = getObjectStore();
  const range = parseRange(req.headers.get("range"), target.size);
  const got = await store.get(target.storageKey, range ?? undefined);
  if (!got) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const disposition = opts.download ? "attachment" : "inline";
  const headers = new Headers({
    "Content-Type": target.mime || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(target.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(range ? range.end - range.start + 1 : target.size),
  });

  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${target.size}`);
  }

  const web = Readable.toWeb(got.stream) as ReadableStream<Uint8Array>;
  return new NextResponse(web, { status: range ? 206 : 200, headers });
}
