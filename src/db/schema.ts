import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Cloud Hard Drive — core schema.
 * Binary payloads are NEVER stored in the database; only metadata lives here.
 * Blobs go through the object store (S3 compatible / server object volume).
 */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    emailNorm: text("email_norm").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    picture: text("picture"),
    googleId: text("google_id"),
    provider: text("provider").notNull().default("email"),
    emailVerified: boolean("email_verified").notNull().default(false),
    quotaBytes: bigint("quota_bytes", { mode: "number" }).notNull().default(15_000_000_000),
    autoUpload: boolean("auto_upload").notNull().default(false),
    wifiOnly: boolean("wifi_only").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_norm_uq").on(t.emailNorm),
    uniqueIndex("users_google_id_uq").on(t.googleId),
  ],
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    resendAvailableAt: timestamp("resend_available_at", { withTimezone: true }).notNull(),
    resendWindowStartedAt: timestamp("resend_window_started_at", { withTimezone: true }).notNull().defaultNow(),
    resendCount: integer("resend_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_verifications_user_uq").on(t.userId),
    index("email_verifications_expires_idx").on(t.expiresAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("album"), // album | folder
    coverFileId: uuid("cover_file_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("albums_user_idx").on(t.userId)],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    kind: text("kind").notNull().default("other"), // image | video | other
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256"),
    verified: boolean("verified").notNull().default(false),
    localCopyCleared: boolean("local_copy_cleared").notNull().default(false),
    deviceName: text("device_name"),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("files_user_created_idx").on(t.userId, t.createdAt),
    index("files_user_kind_idx").on(t.userId, t.kind),
    uniqueIndex("files_user_sha_uq").on(t.userId, t.sha256),
  ],
);

export const albumFiles = pgTable(
  "album_files",
  {
    albumId: uuid("album_id").notNull(),
    fileId: uuid("file_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("album_files_uq").on(t.albumId, t.fileId),
    index("album_files_file_idx").on(t.fileId),
  ],
);

export const shares = pgTable(
  "shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id").notNull(),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    downloads: integer("downloads").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("shares_token_uq").on(t.tokenHash), index("shares_file_idx").on(t.fileId)],
);

export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    chunkSize: integer("chunk_size").notNull(),
    chunksTotal: integer("chunks_total").notNull(),
    receivedChunks: integer("received_chunks").notNull().default(0),
    tempDir: text("temp_dir").notNull(),
    status: text("status").notNull().default("pending"), // pending | completed | aborted
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("upload_sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_resets_token_uq").on(t.tokenHash)],
);

export type User = typeof users.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type AlbumRow = typeof albums.$inferSelect;
export type UploadSessionRow = typeof uploadSessions.$inferSelect;
