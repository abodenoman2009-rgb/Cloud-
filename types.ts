export type PublicUser = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  provider: string;
  quotaBytes: number;
  autoUpload: boolean;
  wifiOnly: boolean;
  createdAt: string;
};

export type StorageStats = {
  authorized: boolean;
  quota: number;
  used: number;
  remaining: number;
  images: { count: number; size: number };
  videos: { count: number; size: number };
  others: { count: number; size: number };
  saved: number;
  storage: { driver: "s3" | "local"; label: string; bucket?: string };
};

export type ApiError = Error & { code?: string; status?: number };
