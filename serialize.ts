import type { FileRow } from "@/db/schema";

export type FileDto = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "other";
  verified: boolean;
  localCopyCleared: boolean;
  deviceName: string | null;
  createdAt: string;
  contentUrl: string;
};

export function fileDto(row: FileRow): FileDto {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    kind: row.kind as FileDto["kind"],
    verified: row.verified,
    localCopyCleared: row.localCopyCleared,
    deviceName: row.deviceName,
    createdAt: row.createdAt.toISOString(),
    contentUrl: `/api/files/${row.id}/content`,
  };
}
