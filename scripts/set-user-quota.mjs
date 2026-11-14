import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply the per-user storage quota.");
}

// 1 TiB in bytes (1024 GiB). This upgrades existing accounts without deleting
// or modifying any stored files or account records.
const quotaBytes = 1_099_511_627_776;
const pool = new Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query(
    "UPDATE users SET quota_bytes = $1 WHERE quota_bytes IS DISTINCT FROM $1",
    [quotaBytes],
  );
  console.log(`Applied 1 TiB storage quota to ${result.rowCount ?? 0} user account(s).`);
} finally {
  await pool.end();
}
